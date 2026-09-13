use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

/// Persisted in the OS config dir (`%APPDATA%\kubo\agent.json` on Windows).
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub access_token: String,
    pub workspace: Option<String>,
    pub project_id: Option<String>,
    /// Shared secret the extension must send back on every request. Generated
    /// once on first boot and persisted to a file only the current OS user can
    /// read — this is what stops a random web page (or another local user)
    /// from hitting the daemon's localhost port and running commands.
    #[serde(default)]
    pub local_secret: String,
}

#[derive(Clone)]
pub struct AppState {
    pub api_base: String,
    config: Arc<RwLock<AgentConfig>>,
}

impl AppState {
    pub fn load(api_base: String) -> Result<Self> {
        let mut config = Self::read_config().unwrap_or_default();
        if config.local_secret.is_empty() {
            config.local_secret = uuid::Uuid::new_v4().to_string();
            let _ = Self::write_config(&config);
        }
        Ok(Self { api_base, config: Arc::new(RwLock::new(config)) })
    }

    fn config_path() -> Option<std::path::PathBuf> {
        // Deliberately NOT the OS-specific `directories::ProjectDirs` convention:
        // the VS Code/Cursor extension (Node/TypeScript) needs to read this same
        // file directly to get `local_secret` before it can call the API at all
        // (bootstrap problem). A flat `~/.kubovibe/agent.json` is trivial to
        // replicate exactly on both sides — `os.homedir()` in Node, `BaseDirs`
        // here — with zero risk of the two implementations drifting apart.
        directories::BaseDirs::new().map(|d| d.home_dir().join(".kubovibe").join("agent.json"))
    }

    fn read_config() -> Option<AgentConfig> {
        let path = Self::config_path()?;
        let raw = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    fn write_config(config: &AgentConfig) -> Result<()> {
        let path = Self::config_path().ok_or_else(|| anyhow::anyhow!("no config dir"))?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, serde_json::to_string_pretty(config)?)?;
        // Best-effort: restrict to the owning user on Unix (0600). No-op on Windows —
        // ACLs there already default to the user's profile folder.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }

    pub fn local_secret(&self) -> String {
        self.config.read().map(|c| c.local_secret.clone()).unwrap_or_default()
    }

    pub fn set_workspace_and_project(&self, workspace: String, project_id: Option<String>, access_token: String) -> Result<()> {
        let mut cfg = self.config.write().map_err(|_| anyhow::anyhow!("lock poisoned"))?;
        cfg.workspace = Some(workspace);
        cfg.project_id = project_id;
        cfg.access_token = access_token;
        Self::write_config(&cfg)
    }

    pub fn access_token(&self) -> String {
        self.config.read().map(|c| c.access_token.clone()).unwrap_or_default()
    }

    pub fn workspace_path(&self) -> Option<String> {
        self.config.read().ok().and_then(|c| c.workspace.clone())
    }

    pub fn project_id(&self) -> Option<String> {
        self.config.read().ok().and_then(|c| c.project_id.clone())
    }

    /// Appends one audit line (JSON) to `agent.log` next to `agent.json`.
    /// Best-effort — never fails the request if logging itself fails.
    pub fn audit(&self, event: &str, detail: &serde_json::Value) {
        let Some(mut path) = Self::config_path() else { return };
        path.set_file_name("agent.log");
        let line = serde_json::json!({
            "ts": chrono_now(),
            "event": event,
            "detail": detail,
        });
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            use std::io::Write;
            let _ = writeln!(f, "{line}");
        }
    }
}

fn chrono_now() -> String {
    // Avoids pulling in the `chrono` crate for one timestamp: RFC3339-ish via
    // std, good enough for a local audit log a human will read.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}
