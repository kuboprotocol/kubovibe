// Lightweight health check across every AI provider configured for the Creative panel.
// Returns latency + status for each provider so the UI can render a status board.
import { corsHeaders } from "../_shared/cors.ts";

type Status = { status: "ok" | "error" | "missing"; latency_ms?: number; message?: string; model?: string };

async function timed<T>(fn: () => Promise<Response>): Promise<{ res: Response | null; ms: number; err?: string }> {
  const t0 = Date.now();
  try {
    const res = await fn();
    return { res, ms: Date.now() - t0 };
  } catch (e) {
    return { res: null, ms: Date.now() - t0, err: e instanceof Error ? e.message : String(e) };
  }
}

async function ping(name: string, key: string | undefined, exec: () => Promise<Response>): Promise<Status> {
  if (!key) return { status: "missing", message: `${name.toUpperCase()}_API_KEY not configured` };
  const { res, ms, err } = await timed(exec);
  if (!res) return { status: "error", latency_ms: ms, message: err ?? "network_error" };
  if (!res.ok) return { status: "error", latency_ms: ms, message: `HTTP ${res.status}` };
  return { status: "ok", latency_ms: ms };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const GROQ = Deno.env.get("GROQ_API_KEY");
  const OR = Deno.env.get("OPENROUTER_API_KEY");
  const LK = Deno.env.get("LOVABLE_API_KEY");
  const SUNO = Deno.env.get("SUNO_API_KEY");
  const BYTEZ = Deno.env.get("BYTEZ_API_KEY");
  const MOONSHOT = Deno.env.get("MOONSHOT_API_KEY");
  const SUNO_BASE = Deno.env.get("SUNO_API_BASE") ?? "https://apibox.erweima.ai";

  const [groq, openrouter, lovable, suno, bytez, moonshot] = await Promise.all([
    ping("groq", GROQ, () => fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${GROQ}` },
    })),
    ping("openrouter", OR, () => fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${OR}` },
    })),
    ping("lovable", LK, () => fetch("https://ai.gateway.lovable.dev/v1/models", {
      headers: { Authorization: `Bearer ${LK}` },
    })),
    ping("suno", SUNO, () => fetch(`${SUNO_BASE}/api/v1/generate/credit`, {
      headers: { Authorization: `Bearer ${SUNO}` },
    })),
    ping("bytez", BYTEZ, () => fetch("https://api.bytez.com/models/v2/Qwen/Qwen3-4B", {
      method: "POST",
      headers: { Authorization: BYTEZ!, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "ping" }] }),
    })),
    ping("moonshot", MOONSHOT, () => fetch("https://api.moonshot.cn/v1/models", {
      headers: { Authorization: `Bearer ${MOONSHOT}` },
    })),
  ]);

  const body = {
    checked_at: new Date().toISOString(),
    groq, openrouter, lovable, suno, bytez, moonshot,
  };
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
