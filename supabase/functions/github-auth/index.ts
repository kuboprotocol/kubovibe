const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    if (!clientId) {
      throw new Error('GITHUB_CLIENT_ID is not configured')
    }

    // Identify user from JWT
    const auth = req.headers.get('Authorization') ?? ''
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0')
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    )
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    // Rate limit: 30 req/min por usuário (service role)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: rl } = await adminClient.rpc('bump_rate_limit', {
      _bucket: 'github_auth', _user: u.user.id, _window_seconds: 60,
    })
    if (typeof rl === 'number' && rl > 30) {
      return new Response(JSON.stringify({ error: 'rate_limited', retry_after_seconds: 60 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }, status: 429,
      })
    }

    const { returnUrl } = await req.json().catch(() => ({ returnUrl: '' }))

    // Encode the app return URL + user_id in the state so the callback can persist + redirect
    const statePayload = JSON.stringify({
      nonce: crypto.randomUUID(),
      returnUrl: returnUrl || '',
      uid: u.user.id,
    })
    const state = btoa(statePayload)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/github-callback`,
      scope: 'repo user read:org',
      state,
      allow_signup: 'true',
    })

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`

    return new Response(
      JSON.stringify({ url: authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
