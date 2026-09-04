use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

/// Persisted in the OS config dir (`%APPDATA%\kubo\agent.json` on Windows).
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub access_token: String,
    pub workspace: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub api_base: String,
    config: Arc<RwLock<AgentConfig>>,
}

impl AppState {
    pub fn load(api_base: String) -> Result<Self> {
        let config = Self::read_config().unwrap_or_default();
        Ok(Self { api_base, config: Arc::new(RwLock::new(config)) })
    }

    fn config_path() -> Option<std::path::PathBuf> {
        directories::ProjectDirs::from("dev", "kubovibe", "kubo-agent")
            .map(|d| d.config_dir().join("agent.json"))
    }

    fn read_config() -> Option<AgentConfig> {
        let path = Self::config_path()?;
        let raw = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    pub fn access_token(&self) -> String {
        self.config.read().map(|c| c.access_token.clone()).unwrap_or_default()
    }

    pub fn workspace_path(&self) -> Option<String> {
        self.config.read().ok().and_then(|c| c.workspace.clone())
    }
}
