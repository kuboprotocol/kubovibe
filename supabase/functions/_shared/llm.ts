// Shared LLM caller: prefers OpenRouter with Kimi (moonshotai/kimi-k2) — the
// project's default "cheap + strong" text model — and falls back through
// DeepSeek official → Groq → Lovable AI Gateway (Gemini).
//
// The order is chosen so:
//   • Kimi handles slides / chat / agents (per project spec).
//   • DeepSeek official API handles heavy code / SaaS generation.
//   • Groq is used where ultra-low latency matters.
//   • Lovable Gemini is the last-resort fallback that always works.
//
// Bytez has been RETIRED from the stack.

type Msg = { role: "system" | "user" | "assistant"; content: string };

export interface LlmCallOptions {
  messages: Msg[];
  /** Preset preference: "kimi" | "deepseek" | "groq". Default: "kimi". */
  prefer?: "kimi" | "deepseek" | "groq";
  temperature?: number;
  max_tokens?: number;
  /** If true, sends `response_format: { type: "json_object" }`. */
  json?: boolean;
}

interface Provider {
  name: string;
  url: string;
  key: string;
  model: string;
}

function buildChain(prefer: "kimi" | "deepseek" | "groq"): Provider[] {
  const OR = Deno.env.get("OPENROUTER_API_KEY");
  const DS = Deno.env.get("DEEPSEEK_API_KEY");
  const GROQ = Deno.env.get("GROQ_API_KEY");
  const LK = Deno.env.get("LOVABLE_API_KEY");

  const kimi: Provider | null = OR
    ? { name: "openrouter_kimi", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "moonshotai/kimi-k2" }
    : null;
  const deepseek: Provider | null = DS
    ? { name: "deepseek_official", url: "https://api.deepseek.com/chat/completions", key: DS, model: "deepseek-chat" }
    : null;
  const deepseekOR: Provider | null = OR
    ? { name: "openrouter_deepseek", url: "https://openrouter.ai/api/v1/chat/completions", key: OR, model: "deepseek/deepseek-chat" }
    : null;
  const groq: Provider | null = GROQ
    ? { name: "groq_llama", url: "https://api.groq.com/openai/v1/chat/completions", key: GROQ, model: "llama-3.3-70b-versatile" }
    : null;
  const lovable: Provider | null = LK
    ? { name: "lovable_gemini", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LK, model: "google/gemini-2.5-flash" }
    : null;

  const order: (Provider | null)[] =
    prefer === "deepseek"
      ? [deepseek, deepseekOR, kimi, groq, lovable]
      : prefer === "groq"
      ? [groq, kimi, deepseek, deepseekOR, lovable]
      : [kimi, groq, deepseek, deepseekOR, lovable];

  return order.filter((p): p is Provider => !!p);
}

export interface LlmResult {
  content: string;
  provider: string;
  model: string;
  usage: unknown;
}

export async function callLlm(opts: LlmCallOptions): Promise<LlmResult> {
  const chain = buildChain(opts.prefer ?? "kimi");
  if (chain.length === 0) throw new Error("no_llm_provider_configured");

  const failures: string[] = [];
  for (const p of chain) {
    try {
      const body: Record<string, unknown> = {
        model: p.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? 2000,
      };
      if (opts.json) body.response_format = { type: "json_object" };

      const r = await fetch(p.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        failures.push(`${p.name}:${r.status}`);
        console.warn(`[llm] ${p.name} failed ${r.status}`);
        continue;
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      return { content, provider: p.name, model: p.model, usage: data?.usage ?? null };
    } catch (e) {
      failures.push(`${p.name}:err`);
      console.warn(`[llm] ${p.name} threw`, e);
    }
  }
  throw new Error(`all_providers_failed: ${failures.join(",")}`);
}
