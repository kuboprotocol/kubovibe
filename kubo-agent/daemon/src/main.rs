//! KUBO Local Agent daemon.
//!
//! Exposes a localhost REST + WebSocket API consumed by the VS Code / Cursor
//! extension. Code runs on the user's own hardware; only AI actions are
//! charged, through the same credit ledger as the cloud sessions.

mod ledger;
mod runner;
mod state;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use state::AppState;
use std::net::SocketAddr;

const DEFAULT_PORT: u16 = 43117;
const DEFAULT_API_BASE: &str = "https://kubovibe.dev/api";

#[derive(Serialize)]
struct Health {
    ok: bool,
    version: &'static str,
    workspace: Option<String>,
}

#[derive(Deserialize)]
struct RunRequest {
    command: String,
    project_id: Option<String>,
}

#[derive(Deserialize)]
struct AiRequest {
    action: ledger::Action,
    prompt: Option<String>,
    project_id: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let state = AppState::load(
        std::env::var("KUBO_API_BASE").unwrap_or_else(|_| DEFAULT_API_BASE.to_string()),
    )?;

    let app = Router::new()
        .route("/health", get(health))
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

async fn health(State(state): State<AppState>) -> Json<Health> {
    Json(Health {
        ok: true,
        version: env!("CARGO_PKG_VERSION"),
        workspace: state.workspace_path(),
    })
}

/// Terminal / git execution — free, runs locally.
async fn run(State(state): State<AppState>, Json(req): Json<RunRequest>) -> Json<serde_json::Value> {
    let output = runner::execute(&state, &req.command).await;
    let _ = ledger::charge(
        &state.api_base,
        &state.access_token(),
        ledger::Action::TerminalCommand,
        req.project_id,
    )
    .await;
    Json(serde_json::json!({ "ok": output.ok, "logs": output.logs }))
}

/// AI action — billed against the shared credit ledger before executing.
async fn ai(State(state): State<AppState>, Json(req): Json<AiRequest>) -> Json<serde_json::Value> {
    match ledger::charge(&state.api_base, &state.access_token(), req.action, req.project_id).await {
        Ok(res) if res.ok => Json(serde_json::json!({
            "ok": true,
            "charged": req.action.cost(),
            "balance_after": res.balance_after,
            "prompt": req.prompt,
        })),
        Ok(res) => Json(serde_json::json!({
            "ok": false,
            "error": res.error.unwrap_or_else(|| "insufficient credits".into())
        })),
        Err(err) => Json(serde_json::json!({ "ok": false, "error": err.to_string() })),
    }
}
