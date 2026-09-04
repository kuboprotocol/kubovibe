//! Credit ledger — mirrors `src/lib/anywhereConfig.ts` in the web app.
//! Local execution is billed per AI action only; terminal and git are free.

use anyhow::Result;
use serde::{Deserialize, Serialize};

pub const CHAT_MESSAGE: i32 = 1;
pub const CODE_EDIT: i32 = 2;
pub const AGENT_RUN: i32 = 4;
pub const TERMINAL_COMMAND: i32 = 0;
pub const GIT_OPERATION: i32 = 0;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    ChatMessage,
    CodeEdit,
    AgentRun,
    TerminalCommand,
    GitOperation,
}

impl Action {
    pub fn cost(self) -> i32 {
        match self {
            Action::ChatMessage => CHAT_MESSAGE,
            Action::CodeEdit => CODE_EDIT,
            Action::AgentRun => AGENT_RUN,
            Action::TerminalCommand => TERMINAL_COMMAND,
            Action::GitOperation => GIT_OPERATION,
        }
    }

    pub fn reason(self) -> &'static str {
        match self {
            Action::ChatMessage => "local_agent_chat",
            Action::CodeEdit => "local_agent_edit",
            Action::AgentRun => "local_agent_run",
            Action::TerminalCommand => "local_agent_terminal",
            Action::GitOperation => "local_agent_git",
        }
    }
}

#[derive(Debug, Serialize)]
struct DeductRequest<'a> {
    action: &'a str,
    amount: i32,
    reason: &'a str,
    category: &'a str,
    idempotency_key: String,
    project_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeductResponse {
    pub ok: bool,
    pub balance_after: Option<i64>,
    pub error: Option<String>,
}

/// Charges the same ledger the admin panels read (`credit_transactions`).
/// The daemon never writes to the database directly — it calls the
/// `local-agent-usage` edge function with the user's access token.
pub async fn charge(
    api_base: &str,
    access_token: &str,
    action: Action,
    project_id: Option<String>,
) -> Result<DeductResponse> {
    if action.cost() == 0 {
        return Ok(DeductResponse { ok: true, balance_after: None, error: None });
    }

    let body = DeductRequest {
        action: action.reason(),
        amount: action.cost(),
        reason: action.reason(),
        category: "local_agent",
        idempotency_key: uuid::Uuid::new_v4().to_string(),
        project_id,
    };

    let res = reqwest::Client::new()
        .post(format!("{api_base}/functions/v1/local-agent-usage"))
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await?
        .json::<DeductResponse>()
        .await?;

    Ok(res)
}
