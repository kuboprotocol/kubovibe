// KUBO Vibe Code Agent — prompt -> plan -> real GitHub commits, streamed step by step (SSE).
// DeepSeek-only (sem fallback Kimi/Puter/Groq), com roteador de complexidade,
// cobrança de créditos em tempo real e checkpoints persistidos para rollback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callDeepSeek, classifyComplexity } from "../_shared/deepseekRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GH_API = "https://api.github.com";

const CREDIT_COST = { flash: 1, pro: 4 } as const;

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

const SYSTEM = `Você é o KUBO Vibe Code Agent, um engenheiro de software sênior (nível top 100) trabalhando num repositório Vite + React + TypeScript + Tailwind.
Responda em JSON ESTRITO apenas:
{"summary":"resumo curto do plano","actions":[{"type":"read_file","path":"src/..","reason":".."},{"type":"edit_file","path":"src/..","reason":"..","content":"CONTEÚDO COMPLETO do novo arquivo"},{"type":"message","reason":"nota para o usuário"}]}
Regras: sempre dê o conteúdo FINAL COMPLETO do arquivo em edit_file (nunca diffs ou placeholders), código pronto para produção, zero TODO, zero catch vazio, reaproveite os design tokens existentes, nomeação precisa, avise quando algo depender de uma credencial ou decisão do usuário.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
  const userId = userRes.user.id;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: {
    prompt?: string;
    mode?: "preview" | "apply";
    apply?: Array<{ path: string; content: string }>;
    revertSha?: string;
    revertCheckpointId?: string;
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

      const chargeCredits = async (amount: number, reason: string, metadata: Record<string, unknown>) => {
        const { data, error } = await admin.rpc("execute_atomic_credit_deduction", {
          _user_id: userId,
          _amount: amount,
          _reason: reason,
          _category: "vibe_code_agent",
          _metadata: metadata,
          _idempotency_key: `vibe-${userId}-${crypto.randomUUID()}`,
        });
        if (error) throw new Error(error.message ?? "credit_deduction_failed");
        const balanceAfter = (data as { balance_after?: number })?.balance_after;
        send({ kind: "credits", status: "success", title: `-${amount} créditos`, creditsCharged: amount, balanceAfter });
        return balanceAfter;
      };

      try {
        const { repo } = ghEnv();

        if (body.revertCheckpointId || body.revertSha) {
          let sha = body.revertSha;
          if (body.revertCheckpointId) {
            const { data: cp, error } = await admin
              .from("vibe_checkpoints")
              .select("id, commit_sha")
              .eq("id", body.revertCheckpointId)
              .eq("user_id", userId)
              .maybeSingle();
            if (error || !cp) throw new Error("checkpoint_not_found");
            sha = cp.commit_sha;
          }
          if (!sha) throw new Error("missing_sha_or_checkpoint");

          send({ kind: "commit", status: "running", title: `Revertendo ${sha.slice(0, 7)}` });
          const files = await revertCommit(sha);
          send({
            kind: "commit",
            status: "success",
            title: `Revertido ${sha.slice(0, 7)}`,
            detail: files.join(", "),
          });

          if (body.revertCheckpointId) {
            await admin.from("vibe_checkpoints").insert({
              user_id: userId,
              project_repo: repo,
              commit_sha: sha,
              parent_sha: null,
              summary: `Revertido: checkpoint anterior`,
              files_changed: files,
              credits_spent: 0,
              reverted_checkpoint_id: body.revertCheckpointId,
            });
          }

          send({ kind: "done", status: "success", title: "Revert concluído" });
          controller.close();
          return;
        }

        if (body.apply?.length) {
          const tier = classifyComplexity(body.apply.map((f) => f.path).join(" "));
          const cost = CREDIT_COST[tier];
          await chargeCredits(cost, "vibe_code_agent:apply", { tier, files: body.apply.length });

          const committedFiles: string[] = [];
          let lastSha: string | undefined;
          for (const file of body.apply) {
            send({ kind: "commit", status: "running", title: `Commitando ${file.path}`, path: file.path });
            const sha = await writeFile(file.path, file.content, `vibe: update ${file.path}`);
            lastSha = sha ?? lastSha;
            committedFiles.push(file.path);
            send({
              kind: "commit",
              status: "success",
              title: `Commitado ${file.path}`,
              path: file.path,
              commitSha: sha,
            });
          }

          if (lastSha) {
            const { data: checkpoint } = await admin
              .from("vibe_checkpoints")
              .insert({
                user_id: userId,
                project_repo: repo,
                commit_sha: lastSha,
                summary: `Aplicado: ${committedFiles.join(", ")}`,
                files_changed: committedFiles,
                credits_spent: cost,
                model_used: tier,
              })
              .select("id")
              .single();
            send({ kind: "checkpoint", status: "success", title: "Checkpoint salvo", checkpointId: checkpoint?.id, commitSha: lastSha });
          }

          send({ kind: "done", status: "success", title: "Alterações aplicadas" });
          controller.close();
          return;
        }

        const prompt = (body.prompt ?? "").trim();
        if (!prompt) throw new Error("prompt_required");
        const mode = body.mode === "apply" ? "apply" : "preview";

        const tier = classifyComplexity(prompt);
        const estimatedCost = CREDIT_COST[tier];
        send({
          kind: "estimate",
          status: "success",
          title: `Estimativa: ${estimatedCost} crédito(s) (modelo ${tier})`,
          tier,
          estimatedCost,
        });

        send({ kind: "thinking", status: "running", title: "Analisando o pedido" });
        const llm = await callDeepSeek({
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: prompt },
          ],
          json: true,
          tier,
          max_tokens: 6000,
          temperature: 0.2,
        });
        send({
          kind: "thinking",
          status: "success",
          title: "Análise concluída",
          detail: `${llm.provider} · ${llm.model} (${llm.tier})`,
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
          title: plan.summary || "Plano pronto",
          detail: `${plan.actions?.length ?? 0} ação(ões)`,
        });

        if (mode === "apply") {
          await chargeCredits(estimatedCost, "vibe_code_agent:direct_apply", { tier, prompt: prompt.slice(0, 200) });
        }

        const committedFiles: string[] = [];
        let lastSha: string | undefined;

        for (const action of plan.actions ?? []) {
          if (action.type === "message") {
            send({ kind: "message", status: "success", title: action.reason ?? "Nota" });
            continue;
          }
          if (!action.path) continue;

          if (action.type === "read_file") {
            send({ kind: "read_file", status: "running", title: `Lendo ${action.path}`, path: action.path });
            const file = await readFile(action.path);
            send({
              kind: "read_file",
              status: "success",
              title: `Lido ${action.path}`,
              path: action.path,
              detail: `${file.content.split("\n").length} linhas`,
            });
            continue;
          }

          if (action.type === "edit_file" && typeof action.content === "string") {
            send({ kind: "edit_file", status: "running", title: `Editando ${action.path}`, path: action.path });
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
              lastSha = sha ?? lastSha;
              committedFiles.push(action.path);
              send({
                kind: "commit",
                status: "success",
                title: `Commitado ${action.path}`,
                path: action.path,
                detail: action.reason,
                diff,
                commitSha: sha,
              });
            }
          }
        }

        if (mode === "apply" && lastSha) {
          const { data: checkpoint } = await admin
            .from("vibe_checkpoints")
            .insert({
              user_id: userId,
              project_repo: repo,
              commit_sha: lastSha,
              summary: plan.summary || committedFiles.join(", "),
              files_changed: committedFiles,
              credits_spent: estimatedCost,
              model_used: tier,
            })
            .select("id")
            .single();
          send({ kind: "checkpoint", status: "success", title: "Checkpoint salvo", checkpointId: checkpoint?.id, commitSha: lastSha });
        }

        send({
          kind: "done",
          status: "success",
          title: mode === "preview" ? "Preview pronto — revise e aplique" : "Todas as alterações commitadas",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "internal_error";
        console.error("[vibe-code-agent]", message);
        send({ kind: "error", status: "failed", title: "Agente parou", detail: message });
      } finally {
        try {
          controller.close();
        } catch {
          /* já fechado */
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
