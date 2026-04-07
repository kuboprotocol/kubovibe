import { supabase } from "@/integrations/supabase/client";

export type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-code`;
const CLONE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clone-site`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("You must be logged in.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function processStream(
  resp: Response,
  onDelta: (deltaText: string) => void,
  onDone: () => void,
  onError?: (error: string) => void
) {
  if (!resp.ok) {
    let errorMessage = `Error ${resp.status}`;
    try {
      const errorData = await resp.json();
      if (typeof errorData?.error === "string" && errorData.error.trim()) {
        errorMessage = errorData.error;
      }
    } catch {
      const fallbackText = await resp.text().catch(() => "");
      if (fallbackText.trim()) errorMessage = fallbackText;
    }

    if (resp.status === 402 && errorMessage === `Error ${resp.status}`) {
      errorMessage = "Sem créditos suficientes no serviço de IA. Tente um prompt menor ou recarregue os créditos.";
    }
    if (resp.status === 429 && errorMessage === `Error ${resp.status}`) {
      errorMessage = "Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.";
    }

    onError?.(errorMessage);
    return;
  }

  if (!resp.body) { onError?.("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
  mode,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
  mode?: string;
}) {
  const headers = await getAuthHeaders().catch((e) => {
    onError?.(e.message);
    return null;
  });
  if (!headers) return;

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, mode: mode || 'flow' }),
  });

  await processStream(resp, onDelta, onDone, onError);
}

export async function streamClone({
  url,
  onDelta,
  onDone,
  onError,
}: {
  url: string;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  const headers = await getAuthHeaders().catch((e) => {
    onError?.(e.message);
    return null;
  });
  if (!headers) return;

  const resp = await fetch(CLONE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });

  await processStream(resp, onDelta, onDone, onError);
}
