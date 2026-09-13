//! KUBO Local Agent daemon.
//!
//! Exposes a localhost REST API consumed by the VS Code / Cursor extension.
//! Code runs on the user's own hardware; only AI actions are charged, through
//! the same credit ledger as the cloud sessions.
//!
//! Security: every route except `/health` requires the `X-Kubo-Secret` header
//! to match the secret generated on first boot and stored in `agent.json`
//! (readable only by the current OS user). Without this, any web page open in
//! the user's browser could hit `http://127.0.0.1:43117/run` and execute
//! arbitrary commands on their machine — the extension reads the same secret
//! from disk, since it runs as the same OS user.

mod ledger;
mod runner;
mod state;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use state::AppState;
use std::net::SocketAddr;

// Talk to the Supabase project directly. `kubovibe.dev` does not proxy
// `/functions/v1/*` today — pointing here avoids a silent 404 in production.
const DEFAULT_API_BASE: &str = "https://sccizjlpwezsgaxkclot.supabase.co";
const DEFAULT_PORT: u16 = 43117;

#[derive(Serialize)]
struct Health {
    ok: bool,
    version: &'static str,
    workspace: Option<String>,
    paired: bool,
}

#[derive(Deserialize)]
struct RunRequest {
    command: String,
    project_id: Option<String>,
    #[serde(default)]
    confirmed: bool,
}

#[derive(Deserialize)]
struct AiRequest {
    action: ledger::Action,
    prompt: Option<String>,
    project_id: Option<String>,
}

#[derive(Deserialize)]
struct PairRequest {
    workspace: String,
    project_id: Option<String>,
    access_token: String,
}

fn check_secret(state: &AppState, headers: &HeaderMap) -> bool {
    let expected = state.local_secret();
    if expected.is_empty() {
        return false;
    }
    headers
        .get("x-kubo-secret")
        .and_then(|v| v.to_str().ok())
        .map(|got| got == expected)
        .unwrap_or(false)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let state = AppState::load(
        std::env::var("KUBO_API_BASE").unwrap_or_else(|_| DEFAULT_API_BASE.to_string()),
    )?;

    tracing::info!(
        "kubo-agent local secret ready — the VS Code/Cursor extension reads it from the same config file"
    );

    let app = Router::new()
        .route("/health", get(health))
        .route("/pair", post(pair))
        .route("/run", post(run))
        .route("/ai", post(ai))
        .with_state(state);

    let port: u16 = std::env::var("KUBO_AGENT_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("kubo-agent listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

/// Unauthenticated on purpose — the extension needs to know the daemon is
/// alive before it has ever paired. Reveals no secrets, no workspace content.
async fn health(State(state): State<AppState>) -> Json<Health> {
    Json(Health {
        ok: true,
        version: env!("CARGO_PKG_VERSION"),
        workspace: state.workspace_path(),
        paired: !state.access_token().is_empty(),
    })
}

/// First-run pairing: the extension prompts the user to pick a workspace
/// folder and signs them in with their existing KUBO account, then sends the
/// access token + folder here once. Requires the local secret like every
/// other route below.
async fn pair(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PairRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !check_secret(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "ok": false, "error": "invalid_secret" })));
    }
    match state.set_workspace_and_project(req.workspace.clone(), req.project_id, req.access_token) {
        Ok(()) => {
            state.audit("pair", &serde_json::json!({ "workspace": req.workspace }));
            (StatusCode::OK, Json(serde_json::json!({ "ok": true })))
        }
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "ok": false, "error": err.to_string() }))),
    }
}

/// Terminal / git execution — free, runs locally. Destructive commands
/// (rm -rf, git push --force, drop table, ...) are blocked unless the
/// request explicitly sets `confirmed: true`.
async fn run(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<RunRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !check_secret(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "ok": false, "error": "invalid_secret" })));
    }

    let output = runner::execute(&state, &req.command, req.confirmed).await;

    if let Some(reason) = output.needs_confirmation {
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "ok": false,
                "needs_confirmation": true,
                "reason": reason,
            })),
        );
    }

    let _ = ledger::charge(
        &state.api_base,
        &state.access_token(),
        ledger::Action::TerminalCommand,
        req.project_id,
    )
    .await;
    (StatusCode::OK, Json(serde_json::json!({ "ok": output.ok, "logs": output.logs })))
}

/// AI action — billed against the shared credit ledger before executing.
async fn ai(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<AiRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !check_secret(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "ok": false, "error": "invalid_secret" })));
    }

    match ledger::charge(&state.api_base, &state.access_token(), req.action, req.project_id).await {
        Ok(res) if res.ok => {
            state.audit("ai", &serde_json::json!({ "action": req.action, "charged": req.action.cost() }));
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "charged": req.action.cost(),
                "balance_after": res.balance_after,
                "prompt": req.prompt,
            })))
        }
        Ok(res) => (StatusCode::PAYMENT_REQUIRED, Json(serde_json::json!({
            "ok": false,
            "error": res.error.unwrap_or_else(|| "insufficient credits".into())
        }))),
        Err(err) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "ok": false, "error": err.to_string() }))),
    }
}
