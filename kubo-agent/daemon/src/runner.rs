use crate::state::AppState;
use tokio::process::Command;

pub struct RunOutput {
    pub ok: bool,
    pub logs: String,
    /// Set when the command matched a destructive pattern and was NOT run
    /// because the caller didn't pass `confirmed: true`.
    pub needs_confirmation: Option<&'static str>,
}

/// Patterns that delete data, rewrite git history, or wipe a disk/DB.
/// Intentionally simple (substring match, case-insensitive) — the goal is to
/// catch the common destructive commands a chat-driven agent might propose,
/// not to sandbox arbitrary shell input perfectly.
const DESTRUCTIVE_PATTERNS: &[(&str, &str)] = &[
    ("rm -rf", "Apaga arquivos/pastas recursivamente e sem confirmação do SO"),
    ("rm -r ", "Apaga pastas recursivamente"),
    ("del /f", "Força exclusão de arquivos no Windows"),
    ("rd /s", "Remove diretórios recursivamente no Windows"),
    ("git push --force", "Sobrescreve o histórico remoto do Git"),
    ("git push -f", "Sobrescreve o histórico remoto do Git"),
    ("git reset --hard", "Descarta mudanças locais não commitadas"),
    ("git clean -fd", "Apaga arquivos não rastreados pelo Git"),
    ("drop table", "Apaga uma tabela inteira do banco"),
    ("drop database", "Apaga um banco de dados inteiro"),
    ("format ", "Formata um disco"),
    ("mkfs", "Formata um disco (Linux)"),
];

fn destructive_match(command: &str) -> Option<&'static str> {
    let lower = command.to_lowercase();
    DESTRUCTIVE_PATTERNS
        .iter()
        .find(|(pattern, _)| lower.contains(pattern))
        .map(|(_, reason)| *reason)
}

/// Executes a shell command inside the linked workspace. Local execution is
/// free — no credit is charged for terminal or git operations. Destructive
/// commands are blocked unless the caller explicitly confirms (the extension
/// shows a warning dialog and resends with `confirmed: true`).
pub async fn execute(state: &AppState, command: &str, confirmed: bool) -> RunOutput {
    if let Some(reason) = destructive_match(command) {
        if !confirmed {
            state.audit("run_blocked_needs_confirmation", &serde_json::json!({ "command": command, "reason": reason }));
            return RunOutput { ok: false, logs: String::new(), needs_confirmation: Some(reason) };
        }
    }

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

    let output = match cmd.current_dir(&cwd).output().await {
        Ok(out) => RunOutput {
            ok: out.status.success(),
            logs: format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            ),
            needs_confirmation: None,
        },
        Err(err) => RunOutput { ok: false, logs: err.to_string(), needs_confirmation: None },
    };

    state.audit(
        "run",
        &serde_json::json!({ "command": command, "cwd": cwd, "ok": output.ok }),
    );
    output
}
