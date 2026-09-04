// KUBO container orchestrator adapter.
// Drivers:
//   - "e2b"  : real ephemeral sandboxes on E2B (E2B_API_KEY)
//   - "http" : any self-hosted runner exposing /containers (KUBO_CONTAINER_API_URL + KUBO_CONTAINER_API_KEY)
//   - null   : not configured — callers must surface this instead of faking a build.

const E2B_API_KEY = Deno.env.get("E2B_API_KEY");
const E2B_TEMPLATE = Deno.env.get("E2B_TEMPLATE_ID") ?? "base";
const E2B_DOMAIN = Deno.env.get("E2B_DOMAIN") ?? "e2b.app";
const E2B_API = `https://api.${E2B_DOMAIN}`;
const ENVD_PORT = 49983;

const CONTAINER_API_URL = Deno.env.get("KUBO_CONTAINER_API_URL");
const CONTAINER_API_KEY = Deno.env.get("KUBO_CONTAINER_API_KEY");

export type OrchestratorDriver = "e2b" | "http" | null;

export function orchestratorDriver(): OrchestratorDriver {
  if (E2B_API_KEY) return "e2b";
  if (CONTAINER_API_URL && CONTAINER_API_KEY) return "http";
  return null;
}

export type Provisioned = {
  container_ref: string;
  preview_url: string | null;
  terminal_url: string | null;
  driver: OrchestratorDriver;
};

export type ExecResult = {
  logs: string;
  exit_code: number;
  preview_url?: string | null;
};

/** `e2b:<sandboxId>:<accessToken?>` keeps everything the exec call needs in one column. */
function parseE2bRef(ref: string): { sandboxId: string; token: string | null } | null {
  if (!ref.startsWith("e2b:")) return null;
  const [, sandboxId, token] = ref.split(":");
  return sandboxId ? { sandboxId, token: token || null } : null;
}

function e2bHost(sandboxId: string, port: number) {
  return `https://${port}-${sandboxId}.${E2B_DOMAIN}`;
}

/** Connect streaming frames: 1 byte flags + 4 bytes big-endian length + JSON payload. */
function decodeConnectStream(buf: Uint8Array): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 0;
  while (offset + 5 <= buf.byteLength) {
    const length = view.getUint32(offset + 1);
    const start = offset + 5;
    const end = start + length;
    if (end > buf.byteLength) break;
    const text = new TextDecoder().decode(buf.subarray(start, end));
    try {
      out.push(JSON.parse(text));
    } catch {
      // ignore malformed frame
    }
    offset = end;
  }
  return out;
}

function b64ToText(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
  } catch {
    return value;
  }
}

async function e2bCreate(sessionId: string, projectId: string, userId: string, timeoutSeconds: number): Promise<Provisioned> {
  const res = await fetch(`${E2B_API}/sandboxes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": E2B_API_KEY! },
    body: JSON.stringify({
      templateID: E2B_TEMPLATE,
      timeout: timeoutSeconds,
      metadata: { session_id: sessionId, project_id: projectId, user_id: userId },
    }),
  });
  if (!res.ok) {
    throw new Error(`e2b_provision_failed_${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const sandboxId: string = data.sandboxID ?? data.sandboxId ?? data.id;
  const clientId: string | undefined = data.clientID ?? data.clientId;
  const fullId = clientId && !String(sandboxId).includes("-") ? `${sandboxId}-${clientId}` : String(sandboxId);
  const token: string = data.envdAccessToken ?? "";
  return {
    container_ref: `e2b:${fullId}:${token}`,
    preview_url: `${e2bHost(fullId, 3000)}`,
    terminal_url: null,
    driver: "e2b",
  };
}

async function e2bExec(ref: string, command: string, timeoutMs: number): Promise<ExecResult> {
  const parsed = parseE2bRef(ref);
  if (!parsed) throw new Error("invalid_container_ref");
  const { sandboxId, token } = parsed;

  const headers: Record<string, string> = {
    "Content-Type": "application/connect+json",
    "Connect-Protocol-Version": "1",
  };
  if (token) headers["X-Access-Token"] = token;

  const payload = JSON.stringify({
    process: {
      cmd: "/bin/bash",
      args: ["-l", "-c", command],
      cwd: "/home/user",
      envs: {},
    },
  });
  const body = new Uint8Array(5 + new TextEncoder().encode(payload).length);
  const encoded = new TextEncoder().encode(payload);
  new DataView(body.buffer).setUint32(1, encoded.length);
  body.set(encoded, 5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${e2bHost(sandboxId, ENVD_PORT)}/process.Process/Start`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const raw = new Uint8Array(await res.arrayBuffer());
    if (!res.ok) {
      throw new Error(`e2b_exec_failed_${res.status}: ${new TextDecoder().decode(raw).slice(0, 300)}`);
    }
    let logs = "";
    let exitCode = 0;
    for (const frame of decodeConnectStream(raw)) {
      const event = (frame as any).event ?? frame;
      const data = event?.data ?? event?.event?.data;
      if (data) logs += b64ToText(data.stdout) + b64ToText(data.stderr);
      const end = event?.end ?? event?.event?.end;
      if (end && typeof end.exitCode === "number") exitCode = end.exitCode;
      if ((frame as any).error) {
        logs += `\n${(frame as any).error.message ?? "stream error"}`;
        exitCode = exitCode || 1;
      }
    }
    return { logs, exit_code: exitCode };
  } finally {
    clearTimeout(timer);
  }
}

async function e2bKill(ref: string) {
  const parsed = parseE2bRef(ref);
  if (!parsed) return;
  await fetch(`${E2B_API}/sandboxes/${encodeURIComponent(parsed.sandboxId)}`, {
    method: "DELETE",
    headers: { "X-API-KEY": E2B_API_KEY! },
  }).catch(() => undefined);
}

export async function provisionContainer(
  sessionId: string,
  projectId: string,
  userId: string,
  timeoutSeconds = 900,
): Promise<Provisioned> {
  const driver = orchestratorDriver();
  if (driver === "e2b") return e2bCreate(sessionId, projectId, userId, timeoutSeconds);
  if (driver === "http") {
    const res = await fetch(`${CONTAINER_API_URL}/containers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONTAINER_API_KEY}` },
      body: JSON.stringify({ session_id: sessionId, project_id: projectId, user_id: userId }),
    });
    if (!res.ok) throw new Error(`container_provision_failed_${res.status}`);
    const data = await res.json();
    return {
      container_ref: String(data.container_ref ?? data.id),
      preview_url: data.preview_url ?? null,
      terminal_url: data.terminal_url ?? null,
      driver: "http",
    };
  }
  return { container_ref: `pending:${sessionId}`, preview_url: null, terminal_url: null, driver: null };
}

export async function execInContainer(ref: string, command: string, kind: string, timeoutMs = 240_000): Promise<ExecResult> {
  if (ref.startsWith("pending:")) throw new Error("orchestrator_not_configured");
  if (ref.startsWith("e2b:")) return e2bExec(ref, command, timeoutMs);
  const res = await fetch(`${CONTAINER_API_URL}/containers/${encodeURIComponent(ref)}/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONTAINER_API_KEY}` },
    body: JSON.stringify({ command, kind }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    logs: String((data as any).logs ?? (data as any).output ?? ""),
    exit_code: Number((data as any).exit_code ?? (res.ok ? 0 : 1)),
    preview_url: (data as any).preview_url ?? null,
  };
}

export async function destroyContainer(ref: string) {
  if (!ref || ref.startsWith("pending:")) return;
  try {
    if (ref.startsWith("e2b:")) return await e2bKill(ref);
    if (CONTAINER_API_URL && CONTAINER_API_KEY) {
      await fetch(`${CONTAINER_API_URL}/containers/${encodeURIComponent(ref)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${CONTAINER_API_KEY}` },
      });
    }
  } catch (err) {
    console.error("[orchestrator] destroy failed", err);
  }
}
