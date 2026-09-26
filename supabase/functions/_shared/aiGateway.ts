// KUBO AI Gateway (futuro VERTAL AI Gateway).
//
// Camada única entre os agentes e os provedores de IA. O chamador informa o
// TIPO de tarefa, nunca o modelo:
//
//   TASK → ROUTER → MODEL → RESULT
//
// Princípio de economia: cada tipo de tarefa vai para o modelo mais barato
// que a resolve bem. O tier "pro" (raciocínio) só é usado em planejamento,
// arquitetura e tarefas complexas, ou quando o próprio pedido é complexo.
//
// Além do roteamento, o gateway faz:
//   • compressão de contexto: não manda o histórico inteiro, só o que cabe
//     no orçamento da tarefa (system + mensagens mais recentes);
//   • cache de respostas determinísticas (temperatura baixa, sem chat);
//   • retry controlado: 1 nova tentativa em 429/5xx/rede, depois o próximo
//     provedor da cadeia; erros 4xx do pedido não trocam de provedor;
//   • custo estimado por execução (tabela de preços sobrescrevível por env).
//
// Os IDs de modelo vêm de env porque os provedores renomeiam modelos com
// frequência; os valores padrão são os atuais da API oficial da DeepSeek.

import { classifyComplexity } from "./deepseekRouter.ts";

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export const TASK_KINDS = [
  "chat",
  "classify",
  "docs",
  "marketing",
  "code",
  "debug",
  "plan",
  "architecture",
  "complex",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export type Tier = "flash" | "pro";

export interface RouteSpec {
  /** Tier base; "auto" decide pela complexidade do pedido. */
  tier: Tier | "auto";
  temperature: number;
  maxTokens: number;
  /** Orçamento de contexto (em caracteres, ~4 chars/token). */
  contextChars: number;
  /** Respostas podem ser reaproveitadas do cache. */
  cacheable: boolean;
  /** O que o usuário vê no painel de atividade. */
  label: string;
}

export const ROUTES: Record<TaskKind, RouteSpec> = {
  chat:         { tier: "flash", temperature: 0.7, maxTokens: 2000, contextChars: 24_000, cacheable: false, label: "Conversa" },
  classify:     { tier: "flash", temperature: 0,   maxTokens: 300,  contextChars: 6_000,  cacheable: true,  label: "Classificação" },
  docs:         { tier: "flash", temperature: 0.3, maxTokens: 4000, contextChars: 32_000, cacheable: true,  label: "Documentação" },
  marketing:    { tier: "flash", temperature: 0.8, maxTokens: 3000, contextChars: 16_000, cacheable: false, label: "Marketing" },
  code:         { tier: "auto",  temperature: 0.2, maxTokens: 6000, contextChars: 60_000, cacheable: true,  label: "Código" },
  debug:        { tier: "auto",  temperature: 0.1, maxTokens: 4000, contextChars: 60_000, cacheable: true,  label: "Debug" },
  plan:         { tier: "pro",   temperature: 0.2, maxTokens: 4000, contextChars: 40_000, cacheable: true,  label: "Planejamento" },
  architecture: { tier: "pro",   temperature: 0.2, maxTokens: 6000, contextChars: 40_000, cacheable: true,  label: "Arquitetura" },
  complex:      { tier: "pro",   temperature: 0.2, maxTokens: 8000, contextChars: 80_000, cacheable: false, label: "Tarefa complexa" },
};

export function isTaskKind(v: unknown): v is TaskKind {
  return typeof v === "string" && (TASK_KINDS as readonly string[]).includes(v);
}

// Inferência do tipo de tarefa quando o chamador não informa. Ordem importa:
// o primeiro grupo que casar vence.
const KIND_RULES: Array<{ kind: TaskKind; patterns: RegExp[] }> = [
  { kind: "architecture", patterns: [/arquitetur/i, /\barchitecture\b/i, /\bstack\b/i, /modelagem de dados/i, /database schema/i] },
  { kind: "plan",         patterns: [/\bplano\b/i, /planej/i, /\bplan\b/i, /roadmap/i, /passo a passo/i, /quebr(e|ar) em tarefas/i] },
  { kind: "debug",        patterns: [/\berro\b/i, /\berror\b/i, /\bbug\b/i, /stack ?trace/i, /exception/i, /n[aã]o funciona/i, /quebrou/i, /\bfix\b/i, /corrig/i] },
  { kind: "code",         patterns: [/c[oó]digo/i, /\bcode\b/i, /fun[cç][aã]o/i, /componente/i, /\bapi\b/i, /endpoint/i, /typescript|javascript|python|react|sql\b/i, /refator/i] },
  { kind: "docs",         patterns: [/document(a[cç][aã]o|ation)/i, /\breadme\b/i, /tutorial/i, /resum(o|ir|a)/i, /\bsummar/i] },
  { kind: "marketing",    patterns: [/marketing/i, /an[uú]ncio/i, /\bcopy\b/i, /landing/i, /\bpost\b/i, /instagram|facebook|whatsapp|tiktok/i, /e-?mail de venda/i] },
];

export function inferTaskKind(text: string): TaskKind {
  for (const rule of KIND_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.kind;
  }
  return "chat";
}

export function resolveTier(kind: TaskKind, text: string): Tier {
  const t = ROUTES[kind].tier;
  return t === "auto" ? classifyComplexity(text) : t;
}

// ─── Compressão de contexto ──────────────────────────────────────────────

const TRUNCATION_MARK = "\n…[trecho omitido pelo gateway para economizar contexto]…\n";

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const keep = Math.max(0, max - TRUNCATION_MARK.length);
  const head = Math.ceil(keep * 0.6);
  return text.slice(0, head) + TRUNCATION_MARK + text.slice(text.length - (keep - head));
}

/**
 * Mantém todas as mensagens `system` e as mensagens mais recentes que cabem
 * em `budget` caracteres. A última mensagem sempre entra (cortada no meio se
 * for maior que o orçamento). A ordem original é preservada.
 */
export function compressContext(messages: Msg[], budget: number): { messages: Msg[]; dropped: number } {
  if (messages.length === 0) return { messages, dropped: 0 };
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");

  // System prompts têm no máximo 1/3 do orçamento.
  const systemBudget = Math.floor(budget / 3);
  const perSystem = system.length ? Math.floor(systemBudget / system.length) : 0;
  const keptSystem = system.map((m) => ({ ...m, content: clip(m.content, perSystem) }));
  let remaining = budget - keptSystem.reduce((n, m) => n + m.content.length, 0);

  const keptRest: Msg[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    if (keptRest.length === 0) {
      const content = clip(m.content, Math.max(remaining, 200));
      keptRest.unshift({ ...m, content });
      remaining -= content.length;
      continue;
    }
    if (m.content.length > remaining) break;
    keptRest.unshift(m);
    remaining -= m.content.length;
  }
  return { messages: [...keptSystem, ...keptRest], dropped: rest.length - keptRest.length };
}

// ─── Custo ───────────────────────────────────────────────────────────────

/** USD por 1M de tokens. Estimativa; sobrescreva com AI_GATEWAY_PRICES (JSON). */
const DEFAULT_PRICES: Record<string, { input: number; output: number }> = {
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "deepseek/deepseek-chat": { input: 0.3, output: 1.2 },
  "deepseek/deepseek-r1": { input: 0.6, output: 2.4 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
};

export function priceTable(): Record<string, { input: number; output: number }> {
  const raw = Deno.env.get("AI_GATEWAY_PRICES");
  if (!raw) return DEFAULT_PRICES;
  try {
    return { ...DEFAULT_PRICES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PRICES;
  }
}

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export function estimateCostUsd(model: string, usage: Usage | null | undefined, prices = priceTable()): number {
  const p = prices[model];
  if (!p || !usage) return 0;
  const cost = ((usage.prompt_tokens ?? 0) * p.input + (usage.completion_tokens ?? 0) * p.output) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}

// ─── Provedores ──────────────────────────────────────────────────────────

export interface Provider {
  name: string;
  url: string;
  key: string;
  model: string;
}

type Env = (k: string) => string | undefined;

/**
 * Cadeia de provedores por tier. DeepSeek oficial é sempre o primeiro (mais
 * barato); o OpenRouter com o mesmo modelo DeepSeek só entra se o oficial
 * estiver fora do ar. Groq entra apenas para tarefas flash.
 */
export function providerChain(tier: Tier, env: Env = (k) => Deno.env.get(k)): Provider[] {
  const ds = env("DEEPSEEK_API_KEY");
  const or = env("OPENROUTER_API_KEY");
  const groq = env("GROQ_API_KEY");
  const chain: Provider[] = [];
  if (ds) {
    chain.push({
      name: "deepseek_official",
      url: "https://api.deepseek.com/chat/completions",
      key: ds,
      model: tier === "pro"
        ? env("DEEPSEEK_MODEL_PRO") ?? "deepseek-reasoner"
        : env("DEEPSEEK_MODEL_FLASH") ?? "deepseek-chat",
    });
  }
  if (or) {
    chain.push({
      name: "openrouter_deepseek",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: or,
      model: tier === "pro" ? "deepseek/deepseek-r1" : "deepseek/deepseek-chat",
    });
  }
  if (groq && tier === "flash") {
    chain.push({
      name: "groq_llama",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      model: "llama-3.3-70b-versatile",
    });
  }
  return chain;
}

// ─── Cache ───────────────────────────────────────────────────────────────

export async function cacheKey(kind: TaskKind, model: string, messages: Msg[], json: boolean): Promise<string> {
  const payload = JSON.stringify({ v: 1, kind, model, json, messages });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface GatewayCache {
  get(key: string): Promise<string | null>;
  set(key: string, content: string, meta: { kind: TaskKind; model: string }): Promise<void>;
}

// ─── Execução ────────────────────────────────────────────────────────────

export interface GatewayRequest {
  messages: Msg[];
  kind?: TaskKind;
  /** Força o tier (ex.: o agente escala para "pro" depois de falhar no "flash"). */
  tier?: Tier;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Desliga o cache para esta chamada. */
  noCache?: boolean;
}

export interface GatewayResult {
  content: string;
  kind: TaskKind;
  tier: Tier;
  provider: string;
  model: string;
  cached: boolean;
  usage: Usage | null;
  costUsd: number;
  durationMs: number;
  attempts: string[];
  droppedMessages: number;
}

export class GatewayError extends Error {
  constructor(message: string, readonly status: number, readonly attempts: string[]) {
    super(message);
  }
}

export interface GatewayDeps {
  fetch?: typeof fetch;
  env?: Env;
  cache?: GatewayCache | null;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function runGateway(req: GatewayRequest, deps: GatewayDeps = {}): Promise<GatewayResult> {
  const doFetch = deps.fetch ?? fetch;
  const env = deps.env ?? ((k: string) => Deno.env.get(k));
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const started = Date.now();

  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const kind = req.kind ?? inferTaskKind(lastUser);
  const route = ROUTES[kind];
  const tier = req.tier ?? resolveTier(kind, lastUser);
  const { messages, dropped } = compressContext(req.messages, route.contextChars);
  const temperature = req.temperature ?? route.temperature;
  const json = !!req.json;

  const chain = providerChain(tier, env);
  if (chain.length === 0) throw new GatewayError("missing_secret:DEEPSEEK_API_KEY", 503, []);

  const useCache = route.cacheable && !req.noCache && temperature <= 0.3 && !!deps.cache;
  const primaryModel = chain[0].model;
  const key = useCache ? await cacheKey(kind, primaryModel, messages, json) : null;
  if (key && deps.cache) {
    const hit = await deps.cache.get(key).catch(() => null);
    if (hit !== null) {
      return {
        content: hit, kind, tier, provider: chain[0].name, model: primaryModel, cached: true,
        usage: null, costUsd: 0, durationMs: Date.now() - started, attempts: ["cache:hit"], droppedMessages: dropped,
      };
    }
  }

  const attempts: string[] = [];
  for (const p of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const body: Record<string, unknown> = {
        model: p.model,
        messages,
        temperature,
        max_tokens: req.maxTokens ?? route.maxTokens,
      };
      if (json) body.response_format = { type: "json_object" };
      let r: Response;
      try {
        r = await doFetch(p.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        attempts.push(`${p.name}:network`);
        if (attempt === 0) { await sleep(400); continue; }
        break;
      }
      if (r.ok) {
        const data = await r.json();
        const content: string = data?.choices?.[0]?.message?.content ?? "";
        const usage: Usage | null = data?.usage ?? null;
        attempts.push(`${p.name}:ok`);
        if (key && deps.cache && content) {
          await deps.cache.set(key, content, { kind, model: p.model }).catch(() => {});
        }
        return {
          content, kind, tier, provider: p.name, model: p.model, cached: false, usage,
          costUsd: estimateCostUsd(p.model, usage), durationMs: Date.now() - started,
          attempts, droppedMessages: dropped,
        };
      }
      attempts.push(`${p.name}:${r.status}`);
      await r.body?.cancel().catch(() => {});
      if (!RETRYABLE.has(r.status)) {
        // Erro do pedido (400/401/402/422…): outro provedor não resolveria
        // um pedido inválido, mas resolve chave inválida ou sem saldo.
        if (r.status === 401 || r.status === 402 || r.status === 403) break;
        throw new GatewayError(`provider_rejected:${p.name}:${r.status}`, 502, attempts);
      }
      if (attempt === 0) await sleep(r.status === 429 ? 1000 : 400);
    }
  }
  throw new GatewayError("all_providers_failed", 503, attempts);
}
