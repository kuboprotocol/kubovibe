import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cacheKey,
  compressContext,
  estimateCostUsd,
  GatewayError,
  inferTaskKind,
  providerChain,
  resolveTier,
  runGateway,
  type GatewayCache,
  type Msg,
} from "./aiGateway.ts";

const ENV: Record<string, string> = { DEEPSEEK_API_KEY: "ds", OPENROUTER_API_KEY: "or" };
const env = (k: string) => ENV[k];
const noSleep = () => Promise.resolve();

function okResponse(content: string, usage = { prompt_tokens: 1000, completion_tokens: 500 }) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });
}

function memoryCache(): GatewayCache & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: (k) => Promise.resolve(store.get(k) ?? null),
    set: (k, v) => { store.set(k, v); return Promise.resolve(); },
  };
}

Deno.test("inferTaskKind classifica pedidos comuns", () => {
  assertEquals(inferTaskKind("Crie a arquitetura de um marketplace"), "architecture");
  assertEquals(inferTaskKind("Monte um plano passo a passo"), "plan");
  assertEquals(inferTaskKind("Esse botão não funciona, deu erro"), "debug");
  assertEquals(inferTaskKind("Escreva um componente React de login"), "code");
  assertEquals(inferTaskKind("Faça um post para o Instagram"), "marketing");
  assertEquals(inferTaskKind("Escreva o README do projeto"), "docs");
  assertEquals(inferTaskKind("oi, tudo bem?"), "chat");
});

Deno.test("resolveTier: barato por padrão, pro só onde precisa", () => {
  assertEquals(resolveTier("chat", "qualquer coisa"), "flash");
  assertEquals(resolveTier("marketing", "x".repeat(5000)), "flash");
  assertEquals(resolveTier("plan", "curto"), "pro");
  assertEquals(resolveTier("code", "ajuste a cor do botão"), "flash");
  assertEquals(resolveTier("code", "refatore toda a arquitetura de dados"), "pro");
});

Deno.test("providerChain: DeepSeek oficial primeiro, Groq só no flash", () => {
  const all = (k: string) => ({ DEEPSEEK_API_KEY: "a", OPENROUTER_API_KEY: "b", GROQ_API_KEY: "c" } as Record<string, string>)[k];
  assertEquals(providerChain("flash", all).map((p) => p.name), ["deepseek_official", "openrouter_deepseek", "groq_llama"]);
  assertEquals(providerChain("pro", all).map((p) => p.name), ["deepseek_official", "openrouter_deepseek"]);
  assertEquals(providerChain("pro", all)[0].model, "deepseek-reasoner");
  assertEquals(providerChain("flash", () => undefined), []);
});

Deno.test("compressContext mantém system e as mensagens mais recentes", () => {
  const msgs: Msg[] = [
    { role: "system", content: "S" },
    { role: "user", content: "a".repeat(500) },
    { role: "assistant", content: "b".repeat(500) },
    { role: "user", content: "c".repeat(300) },
  ];
  const { messages, dropped } = compressContext(msgs, 900);
  assertEquals(messages[0], { role: "system", content: "S" });
  assertEquals(messages.at(-1)?.content, "c".repeat(300));
  assertEquals(dropped, 1);
  assert(messages.reduce((n, m) => n + m.content.length, 0) <= 900);
});

Deno.test("compressContext corta a última mensagem gigante no meio", () => {
  const { messages } = compressContext([{ role: "user", content: "x".repeat(10_000) }], 1000);
  assert(messages[0].content.length <= 1000);
  assert(messages[0].content.includes("omitido"));
});

Deno.test("estimateCostUsd usa a tabela de preços", () => {
  assertEquals(estimateCostUsd("deepseek-chat", { prompt_tokens: 1_000_000, completion_tokens: 0 }), 0.27);
  assertEquals(estimateCostUsd("modelo-desconhecido", { prompt_tokens: 10 }), 0);
  assertEquals(estimateCostUsd("deepseek-chat", null), 0);
});

Deno.test("cacheKey é estável e muda com o conteúdo", async () => {
  const m: Msg[] = [{ role: "user", content: "oi" }];
  assertEquals(await cacheKey("docs", "deepseek-chat", m, false), await cacheKey("docs", "deepseek-chat", m, false));
  assert(await cacheKey("docs", "deepseek-chat", m, false) !== await cacheKey("docs", "deepseek-chat", m, true));
});

Deno.test("runGateway: sucesso no primeiro provedor com custo e tentativas", async () => {
  const calls: string[] = [];
  const res = await runGateway(
    { messages: [{ role: "user", content: "oi" }] },
    { env, sleep: noSleep, fetch: (url) => { calls.push(String(url)); return Promise.resolve(okResponse("olá")); } },
  );
  assertEquals(res.content, "olá");
  assertEquals(res.kind, "chat");
  assertEquals(res.tier, "flash");
  assertEquals(res.provider, "deepseek_official");
  assertEquals(res.attempts, ["deepseek_official:ok"]);
  assert(res.costUsd > 0);
  assertEquals(calls.length, 1);
});

Deno.test("runGateway: 503 → retry → próximo provedor", async () => {
  const seq = [new Response("x", { status: 503 }), new Response("x", { status: 503 }), okResponse("via openrouter")];
  const res = await runGateway(
    { messages: [{ role: "user", content: "oi" }] },
    { env, sleep: noSleep, fetch: () => Promise.resolve(seq.shift()!) },
  );
  assertEquals(res.provider, "openrouter_deepseek");
  assertEquals(res.attempts, ["deepseek_official:503", "deepseek_official:503", "openrouter_deepseek:ok"]);
});

Deno.test("runGateway: 401 no oficial pula para o próximo sem retry", async () => {
  const seq = [new Response("x", { status: 401 }), okResponse("ok")];
  const res = await runGateway(
    { messages: [{ role: "user", content: "oi" }] },
    { env, sleep: noSleep, fetch: () => Promise.resolve(seq.shift()!) },
  );
  assertEquals(res.attempts, ["deepseek_official:401", "openrouter_deepseek:ok"]);
});

Deno.test("runGateway: 400 (pedido inválido) não troca de provedor", async () => {
  const err = await assertRejects(
    () => runGateway(
      { messages: [{ role: "user", content: "oi" }] },
      { env, sleep: noSleep, fetch: () => Promise.resolve(new Response("bad", { status: 400 })) },
    ),
    GatewayError,
  );
  assertEquals(err.attempts, ["deepseek_official:400"]);
});

Deno.test("runGateway: sem chave de provedor → 503 claro", async () => {
  const err = await assertRejects(
    () => runGateway({ messages: [{ role: "user", content: "oi" }] }, { env: () => undefined }),
    GatewayError,
  );
  assertEquals(err.status, 503);
  assertEquals(err.message, "missing_secret:DEEPSEEK_API_KEY");
});

Deno.test("runGateway: cache só para tarefas determinísticas", async () => {
  const cache = memoryCache();
  let calls = 0;
  const deps = { env, sleep: noSleep, cache, fetch: () => { calls++; return Promise.resolve(okResponse("doc")); } };
  const req = { kind: "docs" as const, messages: [{ role: "user" as const, content: "resuma" }] };
  const first = await runGateway(req, deps);
  const second = await runGateway(req, deps);
  assertEquals(first.cached, false);
  assertEquals(second.cached, true);
  assertEquals(second.costUsd, 0);
  assertEquals(calls, 1);

  await runGateway({ kind: "chat", messages: [{ role: "user", content: "oi" }] }, deps);
  await runGateway({ kind: "chat", messages: [{ role: "user", content: "oi" }] }, deps);
  assertEquals(calls, 3);
});
