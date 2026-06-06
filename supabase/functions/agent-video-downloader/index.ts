// Video Downloader — valida URL e retorna metadados oEmbed quando disponível.
// MVP: não armazena binário; entrega metadados + link de stream público.
import { runAgent } from "../_shared/agentRuntime.ts";

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "unknown";
}

Deno.serve((req) =>
  runAgent("video-downloader", req, async ({ input }) => {
    const { url } = input as { url?: string };
    if (!url || !/^https?:\/\//i.test(url)) throw new Error("invalid_url");
    const platform = detectPlatform(url);

    let metadata: Record<string, unknown> = { url, platform };
    try {
      if (platform === "youtube") {
        const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (o.ok) metadata = { ...metadata, ...(await o.json()) };
      } else if (platform === "vimeo") {
        const o = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
        if (o.ok) metadata = { ...metadata, ...(await o.json()) };
      }
    } catch { /* ignore */ }

    return {
      output: {
        platform,
        metadata,
        note: "MVP: retornamos metadados oEmbed. Download binário requer worker dedicado.",
      },
    };
  })
);
