// KUBO Vibe Code — roteador DeepSeek-only.
//
// Decisão do produto: o agente de código (Vibe Code) fala SOMENTE com a API
// oficial da DeepSeek. Sem fallback para Kimi/Puter/Groq/Lovable — se a
// DeepSeek falhar, o erro aparece direto na timeline do agente, sem mascarar
// com outro modelo (evita silenciosamente trocar de "cérebro" no meio de uma
// tarefa e o dev não perceber).
//
// Roteamento por complexidade: a maioria das ações (chat, edição pontual,
// leitura de arquivo) usa o tier "flash" (barato). Só tarefas classificadas
// como complexas (refatoração ampla, arquitetura, múltiplos arquivos, debug
// profundo) sobem para o tier "pro". Os nomes de modelo são configuráveis via
// env porque a DeepSeek já renomeou os IDs de modelo mais de uma vez em 2026
// — não travar isso no código.

type Msg = { role: "system" | "user" | "assistant"; content: string };

export interface DeepSeekCallOptions {
  messages: Msg[];
  /** Força um tier específico; se omitido, classifica automaticamente pelo texto do usuário. */
  tier?: "flash" | "pro";
  /** Texto usado para classificar complexidade quando `tier` não é informado. */
  classifyOn?: string;
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
}

export interface DeepSeekResult {
  content: string;
  provider: "deepseek_official";
  model: string;
  tier: "flash" | "pro";
  usage: unknown;
}

const COMPLEX_KEYWORDS = [
  "refator", "refactor", "arquitetur", "architecture", "migrar", "migration",
  "redesenh", "redesign", "multi-arquivo", "multi-file", "debug profundo",
  "deep debug", "performance crítica", "security audit", "auditoria de segurança",
  "reescrever", "rewrite", "estrutura de dados", "database schema",
];

/** Heurística simples de classificação — MVP; refinar com telemetria de uso real depois. */
export function classifyComplexity(text: string): "flash" | "pro" {
  const normalized = text.toLowerCase();
  const hasComplexKeyword = COMPLEX_KEYWORDS.some((k) => normalized.includes(k));
  const isLong = text.length > 1200;
  return hasComplexKeyword || isLong ? "pro" : "flash";
}

function modelIdFor(tier: "flash" | "pro"): string {
  return tier === "pro"
    ? Deno.env.get("DEEPSEEK_MODEL_PRO") ?? "deepseek-reasoner"
    : Deno.env.get("DEEPSEEK_MODEL_FLASH") ?? "deepseek-chat";
}

export async function callDeepSeek(opts: DeepSeekCallOptions): Promise<DeepSeekResult> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("missing_secret:DEEPSEEK_API_KEY");

  const tier = opts.tier ?? classifyComplexity(opts.classifyOn ?? opts.messages.at(-1)?.content ?? "");
  const model = modelIdFor(tier);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.max_tokens ?? 6000,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`deepseek_${r.status}:${txt.slice(0, 300)}`);
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return { content, provider: "deepseek_official", model, tier, usage: data?.usage ?? null };
}
