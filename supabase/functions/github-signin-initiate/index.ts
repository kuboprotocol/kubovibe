// Public endpoint (verify_jwt = false): starts GitHub OAuth sign-in flow.
// Secrets stay server-side. Returns { url } for the browser to redirect to.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signState(payload: object, secret: string) {
  const json = JSON.stringify(payload)
  const data = b64url(new TextEncoder().encode(json))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))
  return `${data}.${b64url(sig)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    const stateSecret = Deno.env.get('CONNECTOR_ENC_KEY') || Deno.env.get('SUPABASE_JWT_SECRET')
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'github_not_configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!stateSecret) {
      return new Response(JSON.stringify({ error: 'state_secret_missing' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const returnUrl: string = typeof body?.returnUrl === 'string' ? body.returnUrl : ''
    // Only allow safe internal paths
    const safeReturn = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard'

    const state = await signState({
      n: crypto.randomUUID(),
      r: safeReturn,
      t: Date.now(),
      p: 'signin',
    }, stateSecret)

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/github-signin-callback`,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    })

    return new Response(JSON.stringify({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
