// Edge function APENAS para testes RLS/Realtime.
// Cria usuários efêmeros já confirmados (via service role) e devolve uma
// sessão válida (access_token + refresh_token) usada nos testes para validar
// isolamento de tópicos Realtime e políticas RLS.
//
// Segurança:
//  - Exige header X-Test-Secret igual à secret RLS_TEST_SECRET (comparação
//    em tempo constante para evitar timing attacks).
//  - Email é forçado para o domínio @rls-test.kubovibe.dev (não real).
//  - Não destinada a uso em produção pelo cliente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test-secret',
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Comparação de strings em tempo constante — evita vazar info via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)
  const log = (msg: string, extra: Record<string, unknown> = {}) =>
    console.log(`[rls-test ${reqId}] ${msg}`, extra)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    // 1) Validação de envs do runner Deno
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const expected = Deno.env.get('RLS_TEST_SECRET')

    const missing: string[] = []
    if (!url) missing.push('SUPABASE_URL')
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    if (!anonKey) missing.push('SUPABASE_ANON_KEY')
    if (!expected) missing.push('RLS_TEST_SECRET')
    if (missing.length) {
      log('env_missing', { missing })
      return json({ error: 'not_configured', missing }, 503)
    }

    // 2) Validação do header secreto
    const provided = req.headers.get('x-test-secret') ?? ''
    if (!provided || !safeEqual(provided, expected!)) {
      log('unauthorized_header', { hasHeader: !!provided, providedLen: provided.length })
      return json({ error: 'unauthorized' }, 401)
    }

    // 3) Cria usuário efêmero confirmado
    const admin = createClient(url!, serviceKey!)
    const rnd = crypto.randomUUID().slice(0, 8)
    const email = `rls-${Date.now()}-${rnd}@rls-test.kubovibe.dev`
    const password = `Test!${crypto.randomUUID()}#`

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr || !created.user) {
      log('create_user_failed', { err: createErr?.message })
      return json({ error: createErr?.message ?? 'create_failed' }, 500)
    }

    // 4) Faz signIn com chave anônima para retornar sessão válida ao cliente
    const userClient = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const { data: signed, error: signErr } = await userClient.auth.signInWithPassword({ email, password })
    if (signErr || !signed.session) {
      log('signin_failed', { err: signErr?.message })
      return json({ error: signErr?.message ?? 'signin_failed' }, 500)
    }

    log('user_ready', { userId: created.user.id })
    return json({
      user_id: created.user.id,
      email,
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    }, 200)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    log('unhandled_error', { msg })
    return json({ error: msg }, 500)
  }
})
