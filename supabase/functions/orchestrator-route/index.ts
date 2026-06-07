// Orquestrador inteligente: classifica a intenção do usuário e roteia para o
// agente correto. Híbrido: regras explícitas primeiro, IA (Gemini) como fallback.
// Suporta dois modos:
//   { mode: "classify", prompt }              -> retorna { agent, confidence, source, reason }
//   { mode: "execute",  prompt, input? }      -> classifica + executa via agent-route
import { corsHeaders } from "../_shared/agentRuntime.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Regras explícitas (palavras-chave -> slug)
const RULES: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "video-downloader", patterns: [/baix(ar|e).*v[ií]deo/i, /download.*video/i, /youtube\.com|youtu\.be|tiktok\.com|instagram\.com/i] },
  { slug: "opusclip", patterns: [/opus\s*clip/i, /cort(ar|e).*v[ií]deo/i, /clip(es|s)/i, /viral.*video/i] },
  { slug: "short-video", patterns: [/v[ií]deo curto/i, /30 ?(s|seg|segundos)/i, /60 ?(s|seg|segundos)/i, /reels?/i, /shorts?/i] },
  { slug: "avatar-speaker", patterns: [/avatar falante/i, /avatar.*fala/i, /talking head/i] },
  { slug: "music-suno", patterns: [/m[uú]sica/i, /suno/i, /criar can[cç][aã]o/i, /trilha sonora/i] },
  { slug: "image-editor", patterns: [/editar (foto|imagem)/i, /cortar imagem/i, /baixar imagem/i, /image edit/i] },
  { slug: "pdf-creator", patterns: [/criar pdf/i, /gerar pdf/i, /pdf creator/i] },
  { slug: "doc-converter", patterns: [/converter (pdf|doc|docx)/i, /pdf para (doc|word)/i, /converter documento/i] },
  { slug: "docs-creator", patterns: [/criar (doc|word)/i, /documento word/i, /docx/i] },
  { slug: "slides", patterns: [/slides?/i, /apresenta[cç][aã]o/i, /\bppt\b|powerpoint/i, /pitch deck/i] },
  { slug: "nano-banana", patterns: [/nano banana/i, /conte[uú]do r[aá]pido/i] },
  { slug: "creative-panel", patterns: [/painel criativo/i, /creative panel/i] },
  { slug: "manus", patterns: [/pesquisar/i, /navegar/i, /automatizar/i, /manus/i, /web research/i] },
  { slug: "chat-agent", patterns: [/conversar/i, /\bchat\b/i, /pergunta/i, /d[uú]vida/i] },
];

type ClassifyOutcome = {
  agent: string;
  confidence: number;
  source: "rule" | "ai" | "fallback";
  reason: string;
};

function classifyByRules(prompt: string): ClassifyOutcome | null {
  for (const r of RULES) {
    for (const pat of r.patterns) {
      if (pat.test(prompt)) {
        return { agent: r.slug, confidence: 0.9, source: "rule", reason: `matched ${pat}` };
      }
    }
  }
  return null;
}

async function classifyByAI(prompt: string, slugs: string[]): Promise<ClassifyOutcome | null> {
  if (!LOVABLE_API_KEY) return null;
  const sys = `Você é o roteador do KUBO Creative Studio. Dado um pedido do usuário em PT-BR, escolha EXATAMENTE UM agente da lista a seguir. Responda APENAS em JSON: {"agent":"<slug>","reason":"<curta justificativa>"}.\nAgentes disponíveis: ${slugs.join(", ")}.`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    if (parsed?.agent && slugs.includes(parsed.agent)) {
      return { agent: parsed.agent, confidence: 0.75, source: "ai", reason: parsed.reason ?? "ai_classified" };
    }
  } catch (e) {
    console.error("[orchestrator] ai_classify_failed", e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) {
    return new Response(JSON.stringify({ error: "missing_authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // valida JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: { mode?: "classify" | "execute"; prompt?: string; input?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "missing_prompt" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const mode = body.mode ?? "classify";

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: registry } = await admin
    .from("agent_registry")
    .select("slug, name, edge_function, credit_cost, status")
    .neq("status", "disabled");
  const activeSlugs = (registry ?? []).map((r) => r.slug as string);

  // 1) regras
  let outcome = classifyByRules(prompt);
  // 2) IA fallback
  if (!outcome) outcome = await classifyByAI(prompt, activeSlugs);
  // 3) fallback final: chat-agent
  if (!outcome) outcome = { agent: "chat-agent", confidence: 0.3, source: "fallback", reason: "no_match" };

  // log de roteamento (best-effort)
  try {
    await admin.from("orchestration_plans").insert({
      user_id: userId,
      prompt,
      intent: outcome.agent,
      model: outcome.source === "ai" ? "google/gemini-3-flash-preview" : "rule-engine",
      capabilities: [outcome.agent],
      tasks: [{ agent: outcome.agent, source: outcome.source, reason: outcome.reason }],
      stack: { confidence: outcome.confidence, mode },
    });
  } catch (e) {
    console.error("[orchestrator] plan_log_failed", e);
  }

  if (mode === "classify") {
    return new Response(JSON.stringify({ ok: true, ...outcome }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // executa via agent-route (mantém débito atômico + audit trail do runtime existente)
  const upstream = await fetch(`${FUNCTIONS_URL}/agent-route`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "x-request-id": req.headers.get("x-request-id") ?? crypto.randomUUID(),
    },
    body: JSON.stringify({
      agent: outcome.agent,
      input: { prompt, ...(body.input ?? {}) },
    }),
  });
  const text = await upstream.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

  return new Response(JSON.stringify({ ok: upstream.ok, routing: outcome, result: parsed }), {
    status: upstream.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
