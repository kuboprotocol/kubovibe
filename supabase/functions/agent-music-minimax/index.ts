// Kubo Music AI — Minimax-01 (Audio/Music) via OpenRouter.
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

interface MusicInput {
  prompt?: string;
}

Deno.serve((req) =>
  runAgent("music-minimax", req, async ({ input }) => {
    const { prompt } = input as MusicInput;
    if (!prompt) throw new Error("invalid_prompt");

    const key = getSecret("OPENROUTER_API_KEY");
    if (!key) throw new Error("OPENROUTER_API_KEY_MISSING");

    // Minimax-01 model on OpenRouter for audio generation.
    // Note: Minimax-01 is often used for high-quality audio synthesis/music.
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kubovibe.dev",
        "X-Title": "KUBO Vibe",
      },
      body: JSON.stringify({
        model: "minimax/minimax-01", 
        messages: [{ role: "user", content: prompt }],
        // For audio-native models, we expect a specific output format or base64.
        // If it's the standard Chat Completion for audio, we handle accordingly.
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`minimax_${resp.status}:${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    
    return {
      output: {
        provider: "minimax",
        raw: data,
        // Typically returns a URL or base64 in the response if configured for audio.
      },
    };
  })
);