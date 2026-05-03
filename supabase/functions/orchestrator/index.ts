// Orquestrador Camada 2 — interpreta prompt do usuário e devolve um plano
// estruturado (intent + capacidades + stack + tarefas) usando tool-calling
// no Lovable AI Gateway. Persiste em `orchestration_plans` para auditoria.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

Retorne APENAS via a ferramenta build_plan.`

type Plan = {
  intent: 'web2_app' | 'web3_app' | 'hybrid'
  capabilities: string[]
  stack: Record<string, string>
  tasks: Array<{ id: string; layer: 1 | 2 | 3; title: string; depends_on: string[] }>
  user_summary: string
}

const TOOL = {
  type: 'function',
  function: {
    name: 'build_plan',
    description: 'Devolve o plano de execução para o pedido do usuário.',
    parameters: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: ['web2_app', 'web3_app', 'hybrid'] },
        capabilities: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'auth', 'database', 'payments', 'storage', 'realtime',
              'wallet', 'smart_contract', 'token_mint', 'nft', 'on_chain_tx',
              'ai_inference', 'notifications',
            ],
          },
        },
        stack: {
          type: 'object',
          properties: {
            frontend: { type: 'string' },
            backend: { type: 'string' },
            database: { type: 'string' },
            web3: { type: 'string' },
          },
          required: ['frontend', 'backend', 'database'],
          additionalProperties: false,
        },
        tasks: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              layer: { type: 'integer', enum: [1, 2, 3] },
              title: { type: 'string' },
              depends_on: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'layer', 'title', 'depends_on'],
            additionalProperties: false,
          },
        },
        user_summary: {
          type: 'string',
          description: 'Resumo em 1-2 frases para o usuário leigo, sem jargão.',
        },
      },
      required: ['intent', 'capabilities', 'stack', 'tasks', 'user_summary'],
      additionalProperties: false,
    },
  },
} as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

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

    const model = String(body.model ?? 'google/gemini-3-flash-preview')

    const aiResp = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          tools: [TOOL],
          tool_choice: { type: 'function', function: { name: 'build_plan' } },
        }),
      },
    )

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: 'payment_required' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!aiResp.ok) {
      const t = await aiResp.text()
      console.error('AI gateway error', aiResp.status, t)
      return new Response(JSON.stringify({ error: 'ai_gateway_error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiJson = await aiResp.json()
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0]
    if (!call?.function?.arguments) {
      console.error('No tool call in response', JSON.stringify(aiJson).slice(0, 500))
      return new Response(JSON.stringify({ error: 'no_plan_generated' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let plan: Plan
    try { plan = JSON.parse(call.function.arguments) }
    catch (e) {
      console.error('Plan JSON parse failed', e)
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
