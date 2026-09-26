import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_CONFIG } from '@/lib/planConfig'

// Só planos até US$ 49,99/mês podem ser vendidos (página e checkout).
const MAX_PRICE_USD = 49.99

describe('teto de preço dos planos à venda', () => {
  it('a página de preços lista só planos até US$ 49,99', () => {
    const src = readFileSync('src/pages/PricingPage.tsx', 'utf8')
    const m = src.match(/const ESSENTIALS = \[([^\]]*)\]/)
    expect(m).toBeTruthy()
    const plans = [...m![1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1])
    expect(plans.length).toBeGreaterThan(0)
    for (const p of plans) expect(PLAN_CONFIG[p].priceUsd).toBeLessThanOrEqual(MAX_PRICE_USD)
    expect(src).not.toMatch(/BUSINESS\.map/)
  })

  it('o checkout só cria sessão para planos até US$ 49,99', () => {
    const src = readFileSync('supabase/functions/create-checkout/index.ts', 'utf8')
    const block = src.slice(src.indexOf('const PLAN_PRICES'), src.indexOf('Deno.serve'))
    const monthly = [...block.matchAll(/monthly:\s*(\d+)/g)].map((x) => Number(x[1]))
    expect(monthly.length).toBeGreaterThan(0)
    for (const cents of monthly) expect(cents).toBeLessThanOrEqual(MAX_PRICE_USD * 100)
  })
})
