import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

type Action = "chat_message" | "code_edit" | "agent_run" | "terminal_command";

const COST: Record<Action, number> = {
  chat_message: 1,
  code_edit: 2,
  agent_run: 4,
  terminal_command: 0,
};

interface AgentConfig {
  access_token?: string;
  workspace?: string;
  project_id?: string;
  local_secret?: string;
}

// Mirrors daemon/src/state.rs — deliberately a flat, easy-to-replicate path
// instead of an OS-specific convention, since both sides must agree on it
// exactly with zero room for drift.
function configPath(): string {
  return path.join(os.homedir(), ".kubovibe", "agent.json");
}

function readConfig(): AgentConfig | null {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return null;
  }
}

function baseUrl(): string {
  const port = vscode.workspace.getConfiguration("kubo").get<number>("agentPort", 43117);
  return `http://127.0.0.1:${port}`;
}

function projectId(): string | undefined {
  return vscode.workspace.getConfiguration("kubo").get<string>("projectId") || readConfig()?.project_id || undefined;
}

async function call(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<any> {
  const secret = readConfig()?.local_secret;
  if (!secret) {
    throw new Error(
      "KUBO Local Agent has no paired secret yet. Run \u201cKUBO: Pair this workspace\u201d first.",
    );
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Kubo-Secret": secret },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  return res.json();
}

let statusItem: vscode.StatusBarItem | undefined;

/** Atualiza a barra de status com o saldo do Vibe Bank (best-effort). */
async function refreshBalance() {
  if (!statusItem) return;
  try {
    const out = await call("/balance", undefined, "GET");
    statusItem.text = out.ok && out.balance != null ? `$(pulse) KUBO \u00b7 ${out.balance} cr` : "$(pulse) KUBO";
  } catch {
    statusItem.text = "$(pulse) KUBO";
  }
}

async function updateAgent() {
  try {
    const check = await call("/update", undefined, "GET");
    if (!check.ok) throw new Error(check.error ?? "update check failed");
    if (!check.update?.available) {
      vscode.window.showInformationMessage(
        check.update?.current
          ? `KUBO Local Agent is up to date (${check.update.current}).`
          : "This KUBO Local Agent is a local build \u2014 auto-update is disabled.",
      );
      return;
    }
    const choice = await vscode.window.showInformationMessage(
      `KUBO Local Agent ${check.update.latest} is available (current: ${check.update.current}). Update now?`,
      "Update",
    );
    if (choice !== "Update") return;
    const out = await call("/update/apply");
    if (!out.ok) throw new Error(out.error ?? "update failed");
    vscode.window.showInformationMessage(`KUBO Local Agent updated to ${out.update?.latest}. Restarting\u2026`);
  } catch (err) {
    vscode.window.showErrorMessage(`KUBO: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function aiAction(action: Action, prompt?: string) {
  try {
    const out = await call("/ai", { action, prompt, project_id: projectId() });
    if (!out.ok) {
      vscode.window.showErrorMessage(`KUBO: ${out.error ?? "request failed"}`);
      return;
    }
    vscode.window.showInformationMessage(
      `KUBO: ${COST[action]} credit(s) charged. Balance: ${out.balance_after ?? "\u2014"}`,
    );
    refreshBalance();
  } catch (err) {
    vscode.window.showErrorMessage(`KUBO: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Runs a command; if the daemon flags it as destructive, asks the user to confirm before resending. */
async function runCommand(command: string) {
  const channel = vscode.window.createOutputChannel("KUBO");
  try {
    let out = await call("/run", { command, project_id: projectId(), confirmed: false });

    if (out.needs_confirmation) {
      const choice = await vscode.window.showWarningMessage(
        `This command looks destructive: ${out.reason}. Run it anyway?`,
        { modal: true },
        "Run anyway",
      );
      if (choice !== "Run anyway") {
        channel.appendLine(`Blocked (not confirmed): ${command}`);
        channel.show();
        return;
      }
      out = await call("/run", { command, project_id: projectId(), confirmed: true });
    }

    channel.appendLine(out.logs ?? out.error ?? "");
    channel.show();
  } catch (err) {
    vscode.window.showErrorMessage(`KUBO: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function pairWorkspace() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage("Open a folder first, then pair it with KUBO.");
    return;
  }
  const workspace = folders[0].uri.fsPath;

  const accessToken = await vscode.window.showInputBox({
    prompt: "Paste your Local Agent token (generate one at kubovibe.dev/download \u2192 \u201cGerar token do Local Agent\u201d)",
    placeHolder: "kubo_la_\u2026",
    password: true,
    ignoreFocusOut: true,
  });
  if (!accessToken) return;

  const secret = readConfig()?.local_secret;
  if (!secret) {
    vscode.window.showErrorMessage(
      "KUBO Local Agent daemon hasn't started yet (no secret found). Start it first, then retry pairing.",
    );
    return;
  }

  const res = await fetch(`${baseUrl()}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kubo-Secret": secret },
    body: JSON.stringify({ workspace, project_id: projectId(), access_token: accessToken }),
  });
  const data = await res.json();
  if (data.ok) {
    vscode.window.showInformationMessage(`KUBO: paired to ${workspace}`);
    refreshBalance();
  } else {
    vscode.window.showErrorMessage(`KUBO: pairing failed \u2014 ${data.error ?? "unknown error"}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.text = "$(pulse) KUBO";
  status.command = "kubo.status";
  status.show();
  context.subscriptions.push(status);
  statusItem = status;
  refreshBalance();

  context.subscriptions.push(
    vscode.commands.registerCommand("kubo.status", async () => {
      try {
        const res = await fetch(`${baseUrl()}/health`);
        const data = await res.json();
        vscode.window.showInformationMessage(
          `KUBO Local Agent v${data.version}${data.release ? ` (${data.release})` : ""} \u2014 workspace: ${data.workspace ?? "not linked"} \u2014 paired: ${data.paired ? "yes" : "no"}`,
        );
      } catch {
        vscode.window.showErrorMessage("KUBO Local Agent is not running.");
      }
    }),

    vscode.commands.registerCommand("kubo.pair", () => pairWorkspace()),

    vscode.commands.registerCommand("kubo.update", () => updateAgent()),

    vscode.commands.registerCommand("kubo.chat", async () => {
      const prompt = await vscode.window.showInputBox({ prompt: "Ask the KUBO agent (1 credit)" });
      if (prompt) await aiAction("chat_message", prompt);
    }),

    vscode.commands.registerCommand("kubo.edit", async () => {
      const prompt = await vscode.window.showInputBox({ prompt: "Describe the edit (2 credits)" });
      if (prompt) await aiAction("code_edit", prompt);
    }),

    vscode.commands.registerCommand("kubo.run", async () => {
      const prompt = await vscode.window.showInputBox({ prompt: "Agent task (4 credits)" });
      if (prompt) await aiAction("agent_run", prompt);
    }),

    vscode.commands.registerCommand("kubo.terminal", async () => {
      const command = await vscode.window.showInputBox({ prompt: "Command to run locally (free)" });
      if (command) await runCommand(command);
    }),
  );
}

export function deactivate() {}
