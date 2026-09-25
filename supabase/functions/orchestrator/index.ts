// Orquestrador Camada 2 — interpreta prompt do usuário e devolve um plano
// estruturado (intent + capacidades + stack + tarefas) via DeepSeek (JSON
// mode). Persiste em `orchestration_plans` para auditoria.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { callDeepSeek } from '../_shared/deepseekRouter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Você é o Orquestrador do Kubo Vibe Dev — um arquiteto de
software sênior que recebe pedidos em linguagem natural (em português, leigos)
e decide a stack ideal para construir o app, escondendo TODA a complexidade
técnica do usuário.

Regras:
- Sempre detecte se o pedido envolve Web3 (carteira, token, NFT, cripto, on-chain).
- Se houver dúvida entre Web2 puro e híbrido, prefira "hybrid" para já deixar
  pronta a infraestrutura Web3 invisível.
- Quebre em tarefas pequenas, atômicas e ordenadas (frontend, backend, infra,
  contracts), cada uma com a camada (1=UI, 2=orquestrador, 3=motor) marcada.
- Stack default: Frontend React+Vite+Tailwind, Backend Supabase Edge Functions,
  DB Postgres+RLS, Web3 Solidity+OpenZeppelin em testnet (Sepolia).
- NUNCA exponha jargão técnico ao usuário final — só ao executor.

Retorne APENAS um objeto JSON válido, sem markdown, sem texto antes ou depois,
com EXATAMENTE este formato:
{
  "intent": "web2_app" | "web3_app" | "hybrid",
  "capabilities": string[] (apenas dentre: auth, database, payments, storage, realtime, wallet, smart_contract, token_mint, nft, on_chain_tx, ai_inference, notifications),
  "stack": { "frontend": string, "backend": string, "database": string, "web3"?: string },
  "tasks": [ { "id": string, "layer": 1 | 2 | 3, "title": string, "depends_on": string[] } ] (mínimo 1 item),
  "user_summary": string (resumo em 1-2 frases para o usuário leigo, sem jargão)
}`

type Plan = {
  intent: 'web2_app' | 'web3_app' | 'hybrid'
  capabilities: string[]
  stack: Record<string, string>
  tasks: Array<{ id: string; layer: 1 | 2 | 3; title: string; depends_on: string[] }>
  user_summary: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    if (!Deno.env.get('DEEPSEEK_API_KEY')) throw new Error('DEEPSEEK_API_KEY is not configured')

    // Auth: validar JWT do chamador (RLS exige user_id real).
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const prompt = String(body.prompt ?? '').trim()
    if (prompt.length < 3 || prompt.length > 4000) {
      return new Response(
        JSON.stringify({ error: 'prompt must be 3..4000 chars' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Planejamento é uma tarefa que se beneficia de mais raciocínio — força
    // tier "pro" independente do heurístico de complexidade de texto.
    let deepSeekResult
    try {
      deepSeekResult = await callDeepSeek({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        tier: 'pro',
        json: true,
        max_tokens: 2000,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'deepseek_error'
      console.error('DeepSeek error', msg)
      const status = msg.startsWith('deepseek_429') ? 429
        : msg.startsWith('deepseek_402') ? 402
        : 502
      return new Response(JSON.stringify({ error: status === 502 ? 'ai_gateway_error' : msg }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const model = deepSeekResult.model

    let plan: Plan
    try { plan = JSON.parse(deepSeekResult.content) }
    catch (e) {
      console.error('Plan JSON parse failed', e, deepSeekResult.content?.slice(0, 500))
      return new Response(JSON.stringify({ error: 'invalid_plan_json' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: saved, error: insertErr } = await supabase
      .from('orchestration_plans')
      .insert({
        user_id: userData.user.id,
        prompt,
        intent: plan.intent,
        capabilities: plan.capabilities,
        stack: plan.stack,
        tasks: plan.tasks,
        model,
      })
      .select('id, created_at')
      .single()

    if (insertErr) {
      console.error('insert failed', insertErr)
      return new Response(JSON.stringify({ error: 'persist_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ plan_id: saved.id, created_at: saved.created_at, plan }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('orchestrator error', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
