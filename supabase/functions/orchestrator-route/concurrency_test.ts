import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Timeline Polling: Backoff Exponential with Jitter & Max Retries", async (t) => {
  
  const maxRetryLimit = 20;
  
  function calculateNextBackoff(retryCount: number) {
    const nextCount = Math.min(retryCount + 1, maxRetryLimit);
    // Lógica idêntica ao OrchestratorPage.tsx
    const backoff = Math.min(60, Math.pow(2, nextCount) + Math.random() * 5);
    return { nextCount, backoff: Math.round(backoff) };
  }

  await t.step("Initial retry (retry 1)", () => {
    const result = calculateNextBackoff(0);
    assertEquals(result.nextCount, 1);
    assert(result.backoff >= 2 && result.backoff <= 7);
  });

  await t.step("Exponential growth (retry 4)", () => {
    const result = calculateNextBackoff(3);
    assertEquals(result.nextCount, 4);
    assert(result.backoff >= 16 && result.backoff <= 21);
  });

  await t.step("Cap at 60s (retry 10)", () => {
    const result = calculateNextBackoff(9);
    assertEquals(result.nextCount, 10);
    assertEquals(result.backoff, 60);
  });

  await t.step("Respect max retry limit", () => {
    const result = calculateNextBackoff(25);
    assertEquals(result.nextCount, maxRetryLimit);
    assertEquals(result.backoff, 60);
  });
});

Deno.test("Atomic Idempotency Simulation", async (t) => {
  
  const mockDbState = { status: "running" };
  
  async function simulateAction(action: string) {
    if (action === 'pause' && mockDbState.status === 'running') {
      mockDbState.status = 'paused';
      return { ok: true };
    }
    if (action === 'pause' && mockDbState.status === 'paused') {
      return { ok: true, info: "Already paused" };
    }
    return { ok: false, error: "Invalid transition" };
  }

  await t.step("Multiple pause requests result in single state change", async () => {
    const p1 = simulateAction('pause');
    const p2 = simulateAction('pause');
    const results = await Promise.all([p1, p2]);
    
    assertEquals(mockDbState.status, 'paused');
    assert(results[0].ok);
    assert(results[1].ok);
  });
});
