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
mod onboard;
mod runner;
mod state;
mod update;

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
    /// Tag da release (ex.: `nightly-7`) — `None` em builds locais.
    release: Option<&'static str>,
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

    // `kubo-agent --onboard [caminho/pra/extensao.vsix]` — modo usado pelo
    // instalador logo após copiar os arquivos: detecta VS Code/Cursor/Trae
    // e instala a extensão automaticamente, sem precisar do daemon rodando
    // como serviço ainda. Imprime um resumo legível e sai.
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("--onboard") {
        let default_vsix = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("kubo-vibe.vsix")))
            .unwrap_or_else(|| std::path::PathBuf::from("kubo-vibe.vsix"));
        let vsix_path = args.get(2).map(std::path::PathBuf::from).unwrap_or(default_vsix);

        let editors = onboard::detect_editors();
        if editors.is_empty() {
            println!("Nenhum editor compatível encontrado (VS Code, Cursor ou Trae).");
            println!("Isso não é um erro — o app standalone do KUBO Vibe continua funcionando normalmente.");
            return Ok(());
        }

        println!("Editores encontrados: {}", editors.iter().map(|e| e.name).collect::<Vec<_>>().join(", "));
        let (_, results) = onboard::onboard_all(&vsix_path);
        for r in results {
            let mark = if r.ok { "OK" } else { "FALHOU" };
            println!("[{mark}] {}: {}", r.editor, r.detail);
        }
        return Ok(());
    }

    update::cleanup_leftovers();

    let state = AppState::load(
        std::env::var("KUBO_API_BASE").unwrap_or_else(|_| DEFAULT_API_BASE.to_string()),
    )?;

    tracing::info!(
        "kubo-agent local secret ready — the VS Code/Cursor extension reads it from the same config file"
    );

    let app = Router::new()
        .route("/health", get(health))
        .route("/onboard", get(onboard_status).post(onboard_install))
        .route("/pair", post(pair))
        .route("/run", post(run))
        .route("/ai", post(ai))
        .route("/balance", get(balance))
        .route("/update", get(update_check))
        .route("/update/apply", post(update_apply))
        .with_state(state);

    // Checagem passiva no boot: só avisa no log, nunca troca o binário sem
    // o usuário pedir (POST /update/apply, disparado pela extensão).
    tokio::spawn(async {
        match update::check().await {
            Ok(info) if info.available => tracing::info!(
                "nova versão do KUBO Local Agent disponível: {:?} (atual: {:?})",
                info.latest,
                info.current
            ),
            Ok(_) => {}
            Err(err) => tracing::debug!("checagem de atualização falhou: {err}"),
        }
    });

    let port: u16 = std::env::var("KUBO_AGENT_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("kubo-agent listening on http://{addr}");

    let listener = bind_with_retry(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

/// Logo após um auto-update, o processo novo sobe enquanto o antigo ainda
/// está liberando a porta — tenta de novo por alguns segundos em vez de
/// morrer com "address in use".
async fn bind_with_retry(addr: SocketAddr) -> anyhow::Result<tokio::net::TcpListener> {
    let mut last_err = None;
    for _ in 0..20 {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => return Ok(l),
            Err(err) => {
                last_err = Some(err);
                tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            }
        }
    }
    Err(last_err.map(Into::into).unwrap_or_else(|| anyhow::anyhow!("bind failed")))
}

/// GET /onboard — lista editores compatíveis já detectados no PC, sem
/// instalar nada ainda. É o que a UI do instalador chama pra mostrar
/// "Encontramos VS Code e Cursor — quer integrar?" antes do clique.
/// Sem autenticação por secret de propósito: é só leitura, não expõe nada
/// sensível, e roda antes de existir qualquer pareamento.
async fn onboard_status() -> Json<serde_json::Value> {
    let editors = onboard::detect_editors();
    Json(serde_json::json!({ "editors": editors }))
}

#[derive(Deserialize)]
struct OnboardInstallRequest {
    /// Caminho para o .vsix da extensão; se omitido, procura
    /// `kubo-vibe.vsix` ao lado do executável do daemon (é onde o
    /// instalador real deixa ele).
    vsix_path: Option<String>,
}

/// POST /onboard — dispara a instalação de fato ("Integrar com um clique").
async fn onboard_install(Json(req): Json<OnboardInstallRequest>) -> Json<serde_json::Value> {
    let default_vsix = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("kubo-vibe.vsix")))
        .unwrap_or_else(|| std::path::PathBuf::from("kubo-vibe.vsix"));
    let vsix_path = req.vsix_path.map(std::path::PathBuf::from).unwrap_or(default_vsix);

    let (editors, results) = onboard::onboard_all(&vsix_path);
    Json(serde_json::json!({ "editors": editors, "results": results }))
}

/// Unauthenticated on purpose — the extension needs to know the daemon is
/// alive before it has ever paired. Reveals no secrets, no workspace content.
async fn health(State(state): State<AppState>) -> Json<Health> {
    Json(Health {
        ok: true,
        version: env!("CARGO_PKG_VERSION"),
        release: update::current_tag(),
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

/// GET /balance — saldo atual no Vibe Bank + últimos gastos do agent local.
async fn balance(State(state): State<AppState>, headers: HeaderMap) -> (StatusCode, Json<serde_json::Value>) {
    if !check_secret(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "ok": false, "error": "invalid_secret" })));
    }
    match ledger::balance(&state.api_base, &state.access_token()).await {
        Ok(v) => (StatusCode::OK, Json(v)),
        Err(err) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "ok": false, "error": err.to_string() }))),
    }
}

/// GET /update — há versão nova publicada no GitHub?
async fn update_check(State(state): State<AppState>, headers: HeaderMap) -> (StatusCode, Json<serde_json::Value>) {
    if !check_secret(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "ok": false, "error": "invalid_secret" })));
    }
    match update::check().await {
        Ok(info) => (StatusCode::OK, Json(serde_json::json!({ "ok": true, "update": info }))),
        Err(err) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "ok": false, "error": err.to_string() }))),
    }
}

/// POST /update/apply — baixa, troca o executável e reinicia o daemon com o
/// binário novo. Exige o secret: trocar o executável é tão sensível quanto
/// rodar um comando.
async fn update_apply(State(state): State<AppState>, headers: HeaderMap) -> (StatusCode, Json<serde_json::Value>) {
    if !check_secret(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "ok": false, "error": "invalid_secret" })));
    }
    let info = match update::check().await {
        Ok(info) if info.available => info,
        Ok(info) => return (StatusCode::OK, Json(serde_json::json!({ "ok": true, "updated": false, "update": info }))),
        Err(err) => return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "ok": false, "error": err.to_string() }))),
    };

    match update::apply(&info).await {
        Ok(exe) => {
            state.audit("self_update", &serde_json::json!({ "from": info.current, "to": info.latest }));
            // Responde primeiro, depois sobe o binário novo e encerra este.
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                let args: Vec<String> = std::env::args().skip(1).collect();
                if let Err(err) = std::process::Command::new(&exe).args(args).spawn() {
                    tracing::error!("atualizado, mas falhou ao reiniciar: {err} — reinicie o agent manualmente");
                }
                std::process::exit(0);
            });
            (StatusCode::OK, Json(serde_json::json!({ "ok": true, "updated": true, "update": info })))
        }
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "ok": false, "error": err.to_string() }))),
    }
}
