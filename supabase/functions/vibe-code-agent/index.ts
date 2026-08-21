// KUBO Vibe Code Agent — prompt -> plan -> real GitHub commits, streamed step by step (SSE).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callLlm } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GH_API = "https://api.github.com";

interface PlanAction {
  type: "read_file" | "edit_file" | "message";
  path?: string;
  reason?: string;
  content?: string;
}

interface Plan {
  summary: string;
  actions: PlanAction[];
}

function ghEnv() {
  const token = Deno.env.get("GITHUB_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO");
  const branch = Deno.env.get("GITHUB_BRANCH") ?? "main";
  if (!token) throw new Error("missing_secret:GITHUB_TOKEN");
  if (!repo) throw new Error("missing_secret:GITHUB_REPO");
  return { token, repo, branch };
}

async function gh(path: string, init: RequestInit = {}) {
  const { token } = ghEnv();
  const r = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`github_${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function b64decode(s: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)),
  );
}
function b64encode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function readFile(path: string) {
  const { repo, branch } = ghEnv();
  try {
    const data = await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
    return { content: b64decode(data.content ?? ""), sha: data.sha as string };
  } catch (e) {
    if (String(e).includes("github_404")) return { content: "", sha: undefined };
    throw e;
  }
}

async function writeFile(path: string, content: string, message: string) {
  const { repo, branch } = ghEnv();
  const existing = await readFile(path);
  const res = await gh(`/repos/${repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: b64encode(content),
      branch,
      ...(existing.sha ? { sha: existing.sha } : {}),
    }),
  });
  return res.commit?.sha as string | undefined;
}

/** Revert a single commit by restoring each touched file to its parent state. */
async function revertCommit(sha: string) {
  const { repo } = ghEnv();
  const commit = await gh(`/repos/${repo}/commits/${sha}`);
  const parent = commit.parents?.[0]?.sha;
  if (!parent) throw new Error("commit_has_no_parent");
  const files: Array<{ filename: string; status: string }> = commit.files ?? [];
  for (const f of files) {
    let previous = "";
    try {
      const prev = await gh(
        `/repos/${repo}/contents/${encodeURI(f.filename)}?ref=${parent}`,
      );
      previous = b64decode(prev.content ?? "");
    } catch {
      previous = "";
    }
    await writeFile(f.filename, previous, `revert: ${f.filename} (${sha.slice(0, 7)})`);
  }
  return files.map((f) => f.filename);
}

/** Minimal line-based unified diff (no external deps in Deno runtime). */
function makeDiff(oldText: string, newText: string, path: string) {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const out: string[] = [`--- a/${path}`, `+++ b/${path}`];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) out.push(`-${a[i]}`);
    if (b[i] !== undefined) out.push(`+${b[i]}`);
  }
  return out.join("\n");
}

const SYSTEM = `You are the KUBO Vibe Code Agent. You turn a developer request into a concrete file-edit plan for a Vite + React + TypeScript + Tailwind repository.
Reply with STRICT JSON only:
{"summary":"short plan summary","actions":[{"type":"read_file","path":"src/..","reason":".."},{"type":"edit_file","path":"src/..","reason":"..","content":"FULL new file content"},{"type":"message","reason":"note to the user"}]}
Rules: always give the FULL final file content for edit_file (never diffs or placeholders), keep code production-ready, no TODOs, use existing design tokens, English UI strings.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth — always validate the JWT server side.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "missing_authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    prompt?: string;
    mode?: "preview" | "apply";
    apply?: Array<{ path: string; content: string }>;
    revertSha?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json_body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let seq = 0;
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ id: `s${++seq}`, ...event })}\n\n`),
        );

      try {
        // 1) Per-step undo
        if (body.revertSha) {
          send({ kind: "commit", status: "running", title: `Reverting ${body.revertSha.slice(0, 7)}` });
          const files = await revertCommit(body.revertSha);
          send({
            kind: "commit",
            status: "success",
            title: `Reverted ${body.revertSha.slice(0, 7)}`,
            detail: files.join(", "),
          });
          send({ kind: "done", status: "success", title: "Revert complete" });
          controller.close();
          return;
        }

        // 2) Apply a previously previewed set of edits
        if (body.apply?.length) {
          for (const file of body.apply) {
            send({ kind: "commit", status: "running", title: `Committing ${file.path}`, path: file.path });
            const sha = await writeFile(file.path, file.content, `vibe: update ${file.path}`);
            send({
              kind: "commit",
              status: "success",
              title: `Committed ${file.path}`,
              path: file.path,
              commitSha: sha,
            });
          }
          send({ kind: "done", status: "success", title: "Changes applied" });
          controller.close();
          return;
        }

        const prompt = (body.prompt ?? "").trim();
        if (!prompt) throw new Error("prompt_required");
        const mode = body.mode === "apply" ? "apply" : "preview";

        // 3) Reasoning
        send({ kind: "thinking", status: "running", title: "Analyzing the request" });
        const llm = await callLlm({
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
          json: true,
          prefer: "deepseek",
          max_tokens: 6000,
          temperature: 0.3,
        });
        send({
          kind: "thinking",
          status: "success",
          title: "Analysis complete",
          detail: `${llm.provider} · ${llm.model}`,
        });

        let plan: Plan;
        try {
          const raw = llm.content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
          plan = JSON.parse(raw);
        } catch {
          throw new Error("plan_parse_failed");
        }

        send({
          kind: "plan",
          status: "success",
          title: plan.summary || "Plan ready",
          detail: `${plan.actions?.length ?? 0} action(s)`,
        });

        // 4) Execute
        for (const action of plan.actions ?? []) {
          if (action.type === "message") {
            send({ kind: "message", status: "success", title: action.reason ?? "Note" });
            continue;
          }
          if (!action.path) continue;

          if (action.type === "read_file") {
            send({ kind: "read_file", status: "running", title: `Reading ${action.path}`, path: action.path });
            const file = await readFile(action.path);
            send({
              kind: "read_file",
              status: "success",
              title: `Read ${action.path}`,
              path: action.path,
              detail: `${file.content.split("\n").length} lines`,
            });
            continue;
          }

          if (action.type === "edit_file" && typeof action.content === "string") {
            send({ kind: "edit_file", status: "running", title: `Editing ${action.path}`, path: action.path });
            const current = await readFile(action.path);
            const diff = makeDiff(current.content, action.content, action.path);

            if (mode === "preview") {
              send({
                kind: "diff",
                status: "success",
                title: `Preview ${action.path}`,
                path: action.path,
                detail: action.reason,
                diff,
                proposedContent: action.content,
              });
            } else {
              const sha = await writeFile(
                action.path,
                action.content,
                `vibe: ${action.reason ?? `update ${action.path}`}`,
              );
              send({
                kind: "commit",
                status: "success",
                title: `Committed ${action.path}`,
                path: action.path,
                detail: action.reason,
                diff,
                commitSha: sha,
              });
            }
          }
        }

        send({
          kind: "done",
          status: "success",
          title: mode === "preview" ? "Preview ready — review and apply" : "All changes committed",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "internal_error";
        console.error("[vibe-code-agent]", message);
        send({ kind: "error", status: "failed", title: "Agent stopped", detail: message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
