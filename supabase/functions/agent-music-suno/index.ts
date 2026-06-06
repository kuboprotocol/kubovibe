// Music AI (Suno) — composição musical via Suno API.
// Inicia a geração e devolve o task_id; cliente faz polling em /agent-music-suno/status (futuro).
import { runAgent, getSecret } from "../_shared/agentRuntime.ts";

interface MusicInput {
  prompt?: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  duration?: number; // segundos
}

Deno.serve((req) =>
  runAgent("music-suno", req, async ({ input }) => {
    const { prompt, style = "cinematic", title, instrumental = false } =
      input as MusicInput;
    if (!prompt) throw new Error("invalid_prompt");

    const resp = await fetch("https://apibox.erweima.ai/api/v1/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecret("SUNO_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        style,
        title: title ?? prompt.slice(0, 40),
        customMode: true,
        instrumental,
        model: "V4",
        callBackUrl: "https://example.com/noop",
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`suno_${resp.status}:${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    const taskId = data?.data?.taskId ?? data?.taskId ?? null;
    if (!taskId) throw new Error("no_task_id_returned");

    return {
      output: {
        provider: "suno",
        task_id: taskId,
        status: "queued_external",
        poll_hint: "use Suno /generate/record-info?taskId=<task_id> to poll results",
        prompt,
        style,
        instrumental,
      },
    };
  })
);
