// Dedicated Groq edge function for the Creative panel.
// Supports two actions:
//   - "chat":       streamed chat completion (llama-3.3-70b-versatile by default)
//   - "transcribe": audio transcription via Groq Whisper Large v3
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, deductCredits, recordAsset, sanitizeError } from "../_shared/creative.ts";

const CHAT_COST = 1;
const TRANSCRIBE_COST = 2;

const ALLOWED_CHAT = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return j(401, { error: "Unauthorized" });

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return j(503, { error: "groq_unavailable" });

  const idempotencyKey = req.headers.get("X-Idempotency-Key") ?? undefined;
  try {
    const ct = req.headers.get("content-type") ?? "";

    // Transcription (multipart)
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return j(400, { error: "file required" });

      const ded = await deductCredits(user.id, TRANSCRIBE_COST, "creative_groq_transcribe", { size: file.size }, user.email, idempotencyKey);
      if (!ded.ok) return j((ded as any).status ?? 402, { error: ded.error });

      const upstream = new FormData();
      upstream.append("file", file, file.name || "audio.webm");
      upstream.append("model", "whisper-large-v3");
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: upstream,
      });
      const data = await r.json();
      if (!r.ok) return j(r.status, { error: data?.error?.message || "transcribe_failed" });
      recordAsset(user.id, {
        tool: "groq_transcribe",
        output_text: data?.text ?? "",
        credits_spent: TRANSCRIBE_COST,
        metadata: { provider: "groq", model: "whisper-large-v3" },
      }).catch(() => {});
      return j(200, { ok: true, text: data?.text ?? "", provider: "groq" });
    }

    // Chat (JSON)
    const body = await req.json();
    const messages = body?.messages;
    const model = ALLOWED_CHAT.has(body?.model) ? body.model : "llama-3.3-70b-versatile";
    const stream = body?.stream !== false;
    if (!Array.isArray(messages) || messages.length === 0) return j(400, { error: "messages required" });

    const ded = await deductCredits(user.id, CHAT_COST, "creative_groq_chat", { model }, user.email, idempotencyKey);
    if (!ded.ok) return j((ded as any).status ?? 402, { error: ded.error });

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream,
        temperature: body?.temperature ?? 0.7,
        max_tokens: body?.max_tokens ?? 2000,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return j(r.status, { error: "groq_failed", details: txt.slice(0, 500) });
    }
    if (stream && r.body) {
      recordAsset(user.id, {
        tool: "groq_chat",
        prompt: String(messages[messages.length - 1]?.content ?? "").slice(0, 1000),
        credits_spent: CHAT_COST,
        metadata: { provider: "groq", model },
      }).catch(() => {});
      return new Response(r.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Provider": "groq", "X-Model": model },
      });
    }
    const data = await r.json();
    return j(200, { ok: true, ...data, provider: "groq" });
  } catch (e) {
    console.error("[creative-groq] error:", e);
    return j(500, { error: sanitizeError(e) });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
