// Puter.js AI helpers — free, key-less AI (chat, image, speech, video)
// Docs: https://docs.puter.com/llms.txt
import { puter } from "@heyputer/puter.js";

/** Models routed through Puter.js. Prefixed in the UI with `puter/`. */
export const PUTER_MODELS = [
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano (Puter)" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini (Puter)" },
  { id: "o3-mini", label: "OpenAI o3-mini (Puter)" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4 (Puter)" },
  { id: "deepseek-chat", label: "DeepSeek Chat (Puter)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Puter)" },
  { id: "x-ai/grok-4", label: "xAI Grok 4 (Puter)" },
] as const;

export const PUTER_PREFIX = "puter/";

export const isPuterModel = (model: string) =>
  model.startsWith(PUTER_PREFIX) || model.includes("kimi");

/** Strips the `puter/` routing prefix before sending the id to Puter. */
export const toPuterModelId = (model: string) =>
  model.startsWith(PUTER_PREFIX) ? model.slice(PUTER_PREFIX.length) : model;

type ChatOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

/** Streaming chat. Calls `onDelta` for each chunk and resolves with the full text. */
export async function puterChatStream(
  prompt: string,
  options: ChatOptions,
  onDelta: (fullText: string) => void,
): Promise<string> {
  const resp = await puter.ai.chat(prompt, {
    ...options,
    model: toPuterModelId(options.model ?? "gpt-5.4-nano"),
    stream: true,
  });
  let fullText = "";
  for await (const part of resp as any) {
    if (part?.text) {
      fullText += part.text;
      onDelta(fullText);
    }
  }
  return fullText;
}

/** Non-streaming chat. Returns the plain text answer. */
export async function puterChat(prompt: string, options: ChatOptions = {}): Promise<string> {
  const resp: any = await puter.ai.chat(prompt, {
    ...options,
    model: toPuterModelId(options.model ?? "gpt-5.4-nano"),
  });
  return resp?.message?.content ?? resp?.text ?? String(resp ?? "");
}

/** Lists the chat models/providers Puter currently exposes. */
export const puterListModels = () => (puter.ai as any).listModels();

/** Text to image. Resolves with an `<img>` element. */
export const puterTxt2Img = (prompt: string, options?: Record<string, unknown>) =>
  (puter.ai as any).txt2img(prompt, options);

/**
 * Text to image returning the image `src` (data URL).
 * `testMode` uses Puter's free test images and does not consume API credits.
 */
export async function puterTxt2ImgUrl(prompt: string, testMode = false): Promise<string> {
  const img: HTMLImageElement = await (puter.ai as any).txt2img(prompt, testMode);
  const src = img?.src ?? "";
  if (!src) throw new Error("Puter txt2img não retornou imagem");
  return src;
}


/** OCR — extracts text from an image URL or File. */
export const puterImg2Txt = (source: string | File) => (puter.ai as any).img2txt(source);

/** Text to speech. Resolves with an HTMLAudioElement. */
export const puterTxt2Speech = (text: string, options?: Record<string, unknown>) =>
  (puter.ai as any).txt2speech(text, options);

export const puterListTtsEngines = () => (puter.ai as any).txt2speech.listEngines();
export const puterListTtsVoices = () => (puter.ai as any).txt2speech.listVoices();

/** Voice conversion — speech in one voice to another voice. */
export const puterSpeech2Speech = (source: File | Blob | string, options?: Record<string, unknown>) =>
  (puter.ai as any).speech2speech(source, options);

/** Transcribes or translates an audio recording into text. */
export const puterSpeech2Txt = (source: File | Blob | string, options?: Record<string, unknown>) =>
  (puter.ai as any).speech2txt(source, options);

/** Short video generation (OpenAI Sora models). */
export const puterTxt2Vid = (prompt: string, options?: Record<string, unknown>) =>
  (puter.ai as any).txt2vid(prompt, options);
