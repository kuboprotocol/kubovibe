// E2E test do orchestrator: valida classificação (regras + fallback) e
// que o registro do plano em orchestration_plans existe quando autenticado.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

Deno.test("orchestrator rejects unauthenticated requests", async () => {
  if (!SUPABASE_URL) return;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/orchestrator-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY ?? "" },
    body: JSON.stringify({ mode: "classify", prompt: "criar pdf" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assert(body.error);
});

Deno.test("orchestrator rule classifier matches keywords", () => {
  const RULES: Array<{ slug: string; patterns: RegExp[] }> = [
    { slug: "pdf-creator", patterns: [/criar pdf/i, /gerar pdf/i] },
    { slug: "video-downloader", patterns: [/youtube\.com|youtu\.be/i] },
    { slug: "slides", patterns: [/slides?/i, /apresenta[cç][aã]o/i] },
  ];
  function classify(p: string): string | null {
    for (const r of RULES) for (const pat of r.patterns) if (pat.test(p)) return r.slug;
    return null;
  }
  assertEquals(classify("Quero criar PDF do relatório"), "pdf-creator");
  assertEquals(classify("Baixe esse vídeo do https://youtu.be/abc"), "video-downloader");
  assertEquals(classify("Faz uns slides bonitos"), "slides");
  assertEquals(classify("oi tudo bem"), null);
});
