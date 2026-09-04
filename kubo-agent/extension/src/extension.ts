import * as vscode from "vscode";

type Action = "chat_message" | "code_edit" | "agent_run" | "terminal_command";

const COST: Record<Action, number> = {
  chat_message: 1,
  code_edit: 2,
  agent_run: 4,
  terminal_command: 0,
};

function baseUrl(): string {
  const port = vscode.workspace.getConfiguration("kubo").get<number>("agentPort", 43117);
  return `http://127.0.0.1:${port}`;
}

function projectId(): string | undefined {
  return vscode.workspace.getConfiguration("kubo").get<string>("projectId") || undefined;
}

async function call(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function aiAction(action: Action, prompt?: string) {
  const out = await call("/ai", { action, prompt, project_id: projectId() });
  if (!out.ok) {
    vscode.window.showErrorMessage(`KUBO: ${out.error ?? "request failed"}`);
    return;
  }
  vscode.window.showInformationMessage(
    `KUBO: ${COST[action]} credit(s) charged. Balance: ${out.balance_after ?? "—"}`,
  );
}

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.text = "$(pulse) KUBO";
  status.command = "kubo.status";
  status.show();
  context.subscriptions.push(status);

  context.subscriptions.push(
    vscode.commands.registerCommand("kubo.status", async () => {
      try {
        const res = await fetch(`${baseUrl()}/health`);
        const data = await res.json();
        vscode.window.showInformationMessage(
          `KUBO Local Agent v${data.version} — workspace: ${data.workspace ?? "not linked"}`,
        );
      } catch {
        vscode.window.showErrorMessage("KUBO Local Agent is not running.");
      }
    }),

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
      if (!command) return;
      const out = await call("/run", { command, project_id: projectId() });
      const channel = vscode.window.createOutputChannel("KUBO");
      channel.appendLine(out.logs ?? "");
      channel.show();
    }),
  );
}

export function deactivate() {}
