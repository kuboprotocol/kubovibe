use crate::state::AppState;
use tokio::process::Command;

pub struct RunOutput {
    pub ok: bool,
    pub logs: String,
}

/// Executes a shell command inside the linked workspace. Local execution is
/// free — no credit is charged for terminal or git operations.
pub async fn execute(state: &AppState, command: &str) -> RunOutput {
    let cwd = state.workspace_path().unwrap_or_else(|| ".".to_string());

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("powershell");
        c.args(["-NoProfile", "-Command", command]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("sh");
        c.args(["-lc", command]);
        c
    };

    match cmd.current_dir(cwd).output().await {
        Ok(out) => RunOutput {
            ok: out.status.success(),
            logs: format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            ),
        },
        Err(err) => RunOutput { ok: false, logs: err.to_string() },
    }
}
