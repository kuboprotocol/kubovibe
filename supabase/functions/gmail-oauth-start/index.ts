import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

const ORIGIN_ALLOWLIST = [
  'https://kubovibe.dev',
  'https://kubovibe.lovable.app',
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
]

function isAllowedOrigin(origin: string): boolean {
  return ORIGIN_ALLOWLIST.some(rule =>
    typeof rule === 'string' ? rule === origin : rule.test(origin),
  )
}

function isSafeReturnUrl(ret: string): boolean {
  return /^\/[A-Za-z0-9/_\-?=&%.]*$/.test(ret) && !ret.startsWith('//')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')
    if (!clientId) return new Response(JSON.stringify({ error: 'GMAIL_OAUTH_CLIENT_ID not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({})) as { returnUrl?: string; origin?: string }
    const returnUrl = body.returnUrl && isSafeReturnUrl(body.returnUrl) ? body.returnUrl : '/connectors/gmail'
    const origin = body.origin && isAllowedOrigin(body.origin) ? body.origin : 'https://kubovibe.dev'

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth-callback`
    const nonce = crypto.randomUUID() + '.' + crypto.randomUUID()

    // Persiste nonce server-side (CSRF/replay protection)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: insErr } = await admin.from('gmail_oauth_states').insert({
      nonce, user_id: user.id, origin, return_url: returnUrl,
    })
    if (insErr) return new Response(JSON.stringify({ error: 'state_persist_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: nonce,
    })
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    return new Response(JSON.stringify({ url }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
