// Public endpoint (verify_jwt = false): GitHub OAuth callback for sign-in.
// Exchanges code, fetches GitHub email, then issues a Supabase magic link
// and redirects the browser to it (which sets the session and bounces to returnUrl).
import { createClient } from 'npm:@supabase/supabase-js@2'

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function verifyState(state: string, secret: string): Promise<any | null> {
  try {
    const [data, sig] = state.split('.')
    if (!data || !sig) return null
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sig) as BufferSource,
      new TextEncoder().encode(data),
    )
    if (!valid) return null
    const json = new TextDecoder().decode(b64urlDecode(data))
    const parsed = JSON.parse(json)
    if (typeof parsed.t !== 'number' || Date.now() - parsed.t > 10 * 60 * 1000) return null
    return parsed
  } catch { return null }
}

function pageRedirect(target: string) {
  return new Response(
    `<html><head><meta http-equiv="refresh" content="0;url=${target}"></head><body>Redirecting...</body></html>`,
    { headers: { 'Content-Type': 'text/html' }, status: 200 },
  )
}

// Structured JSON logger for production observability
function logEvent(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    fn: 'github-signin-callback',
    event,
    ...data,
  }))
}

// Allowlist of safe app origins for post-OAuth redirects
const ALLOWED_HOSTS = ['kubovibe.dev', 'kubovibe.lovable.app', 'localhost', '127.0.0.1']
function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (ALLOWED_HOSTS.includes(u.hostname)) return true
    if (u.hostname.endsWith('.kubovibe.dev')) return true
    if (u.hostname.endsWith('.lovable.app')) return true
    return false
  } catch { return false }
}

// Allowlist of safe internal paths (prefix match)
const ALLOWED_RETURN_PREFIXES = ['/dashboard', '/connectors', '/builder', '/canvas', '/profile', '/agents', '/docs', '/game', '/']
function safeReturnPath(p: string): string {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) return '/dashboard'
  if (ALLOWED_RETURN_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix + '?'))) {
    return p
  }
  return '/dashboard'
}

function resolveAppOrigin(req: Request): string {
  const envApp = Deno.env.get('APP_URL')
  if (envApp && isAllowedOrigin(envApp)) return envApp.replace(/\/$/, '')
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      const u = new URL(referer)
      if (isAllowedOrigin(u.origin)) return u.origin
    } catch { /* ignore */ }
  }
  return 'https://kubovibe.dev'
}

export async function handleRequest(req: Request): Promise<Response> {
  const reqId = crypto.randomUUID()
  const startedAt = Date.now()
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const appOrigin = resolveAppOrigin(req)
  const errRedirect = (err: string) => {
    logEvent('callback_error', { reqId, err, durationMs: Date.now() - startedAt })
    return pageRedirect(`${appOrigin}/auth?auth_error=${encodeURIComponent(err)}&auth_req_id=${encodeURIComponent(reqId)}`)
  }

  logEvent('callback_received', { reqId, hasCode: !!code, hasState: !!stateParam, hasOauthError: !!oauthError })

  try {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')
    const stateSecret = Deno.env.get('CONNECTOR_ENC_KEY') || Deno.env.get('SUPABASE_JWT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!clientId || !clientSecret) return errRedirect('github_not_configured')
    if (!stateSecret || !supabaseUrl || !serviceKey) return errRedirect('server_misconfigured')
    if (oauthError) return errRedirect(oauthError)
    if (!code || !stateParam) return errRedirect('missing_code_or_state')

    const state = await verifyState(stateParam, stateSecret)
    if (!state || state.p !== 'signin') return errRedirect('invalid_state')

    const returnUrl = safeReturnPath(state.r)

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error) {
      return errRedirect(tokenData.error_description || tokenData.error || 'token_exchange_failed')
    }
    const accessToken = tokenData.access_token as string

    // Fetch GitHub user + emails
    const [ghUserRes, ghEmailsRes] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'KuboVibe' },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'KuboVibe' },
      }),
    ])
    const ghUser = await ghUserRes.json()
    const ghEmails: Array<{ email: string; primary: boolean; verified: boolean }> = ghEmailsRes.ok
      ? await ghEmailsRes.json()
      : []
    const primary = ghEmails.find(e => e.primary && e.verified) || ghEmails.find(e => e.verified) || ghEmails[0]
    const email: string | undefined = primary?.email || ghUser?.email
    if (!email) return errRedirect('github_email_unavailable')

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: ghUser?.name || ghUser?.login || email.split('@')[0],
        avatar_url: ghUser?.avatar_url || null,
        provider: 'github',
        github_username: ghUser?.login || null,
      },
    }).catch(() => { /* user already exists */ })

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appOrigin}${returnUrl}` },
    })
    if (linkErr || !linkData?.properties?.action_link) {
      return errRedirect(linkErr?.message || 'link_generation_failed')
    }

    logEvent('callback_success', { reqId, ghLogin: ghUser?.login, durationMs: Date.now() - startedAt })
    return pageRedirect(linkData.properties.action_link)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    logEvent('callback_exception', { reqId, err: msg, durationMs: Date.now() - startedAt })
    return errRedirect(msg)
  }
}

// Export internals for tests
export const __test = { safeReturnPath, isAllowedOrigin, verifyState }

Deno.serve(handleRequest)
