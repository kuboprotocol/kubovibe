import { describe, it, expect } from 'vitest'
import { AI_TASKS, AI_TASK_LABEL, summarizeRuns, type AiGatewayRun } from '@/lib/aiGateway'

function run(p: Partial<AiGatewayRun>): AiGatewayRun {
  return {
    id: crypto.randomUUID(), project_id: null, task_kind: 'chat', tier: 'flash', provider: 'deepseek_official',
    model: 'deepseek-chat', cached: false, status: 'ok', error: null, prompt_tokens: 100, completion_tokens: 50,
    cost_usd: 0.001, duration_ms: 800, created_at: new Date().toISOString(), ...p,
  }
}

describe('AI Gateway (cliente)', () => {
  it('toda tarefa tem rótulo em português', () => {
    for (const t of AI_TASKS) expect(AI_TASK_LABEL[t]).toBeTruthy()
  })

  it('summarizeRuns soma custo e tokens só das execuções ok', () => {
    const t = summarizeRuns([
      run({}),
      run({ tier: 'pro', cost_usd: 0.004 }),
      run({ cached: true, cost_usd: 0, prompt_tokens: null, completion_tokens: null }),
      run({ status: 'error', error: 'all_providers_failed', cost_usd: 0, prompt_tokens: null, completion_tokens: null }),
    ])
    expect(t.runs).toBe(4)
    expect(t.errors).toBe(1)
    expect(t.cacheHits).toBe(1)
    expect(t.tokens).toBe(300)
    expect(t.costUsd).toBe(0.005)
    expect(t.proShare).toBeCloseTo(1 / 3)
  })

  it('summarizeRuns lida com lista vazia', () => {
    expect(summarizeRuns([])).toEqual({ runs: 0, errors: 0, cacheHits: 0, tokens: 0, costUsd: 0, proShare: 0 })
  })
})
