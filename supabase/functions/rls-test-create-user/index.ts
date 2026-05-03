// Edge function APENAS para testes RLS/Realtime.
// Cria usuários efêmeros já confirmados (via service role) e devolve uma
// sessão válida (access_token + refresh_token) que os testes usam para
// validar isolamento de tópicos Realtime e políticas RLS.
//
// Segurança:
//  - Exige header X-Test-Secret igual à secret RLS_TEST_SECRET.
//  - Email é forçado para o domínio @rls-test.kubovibe.dev (não real).
//  - A função NÃO é destinada a uso em produção pelo cliente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const expected = Deno.env.get('RLS_TEST_SECRET')
    if (!expected) {
      return new Response(JSON.stringify({ error: 'not_configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (req.headers.get('x-test-secret') !== expected) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, serviceKey)

    const rnd = crypto.randomUUID().slice(0, 8)
    const email = `rls-${Date.now()}-${rnd}@rls-test.kubovibe.dev`
    const password = `Test!${crypto.randomUUID()}#`

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? 'create_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: signed, error: signErr } = await userClient.auth.signInWithPassword({ email, password })
    if (signErr || !signed.session) {
      return new Response(JSON.stringify({ error: signErr?.message ?? 'signin_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      user_id: created.user.id,
      email,
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
