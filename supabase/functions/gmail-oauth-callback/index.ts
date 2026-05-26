import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { encryptSecret } from '../_shared/gmailCrypto.ts'

const DEFAULT_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://kubovibe.dev'

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
]

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: to } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const nonce = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (errorParam) return redirect(`${DEFAULT_ORIGIN}/connectors/gmail?error=${encodeURIComponent(errorParam)}`)
  if (!code || !nonce) return redirect(`${DEFAULT_ORIGIN}/connectors/gmail?error=missing_code`)

  // Valida e consome o state nonce (CSRF/replay protection)
  const { data: stateRow } = await admin
    .from('gmail_oauth_states')
    .select('*')
    .eq('nonce', nonce)
    .maybeSingle()

  if (!stateRow) return redirect(`${DEFAULT_ORIGIN}/connectors/gmail?error=bad_state`)
  const s = stateRow as { user_id: string; origin: string; return_url: string; expires_at: string; consumed_at: string | null }
  if (s.consumed_at) return redirect(`${s.origin}${s.return_url}?error=state_replayed`)
  if (new Date(s.expires_at).getTime() < Date.now()) return redirect(`${s.origin}${s.return_url}?error=state_expired`)

  // Consome imediatamente (one-shot)
  await admin.from('gmail_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('nonce', nonce)

  const origin = s.origin
  const ret = s.return_url

  try {
    const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')!
    const clientSecret = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET')!
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth-callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string
    }
    if (!tokenRes.ok || !tokens.access_token || !tokens.refresh_token) {
      return redirect(`${origin}${ret}?error=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`)
    }

    // Valida que todos os escopos requeridos foram concedidos
    const granted = (tokens.scope ?? '').split(/\s+/).filter(Boolean)
    const missing = REQUIRED_SCOPES.filter(s => !granted.includes(s))
    if (missing.length > 0) {
      return redirect(`${origin}${ret}?error=${encodeURIComponent('missing_scopes:' + missing.join(','))}`)
    }

    const profRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profRes.json() as { email?: string; name?: string; picture?: string; verified_email?: boolean }
    if (!profile.email) return redirect(`${origin}${ret}?error=no_email`)
    if (profile.verified_email === false) return redirect(`${origin}${ret}?error=email_not_verified`)

    const enc = await encryptSecret(tokens.refresh_token)
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    const { error: upErr } = await admin.from('gmail_accounts').upsert({
      user_id: s.user_id,
      email: profile.email,
      display_name: profile.name ?? null,
      avatar_url: profile.picture ?? null,
      scope: tokens.scope ?? '',
      refresh_token_ciphertext: enc.ciphertext,
      refresh_token_iv: enc.iv,
      refresh_token_tag: enc.tag,
      access_token_cache: tokens.access_token,
      access_token_expires_at: expiresAt,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,email' })

    if (upErr) return redirect(`${origin}${ret}?error=${encodeURIComponent(upErr.message)}`)

    await admin.from('connector_activity_logs').insert({
      user_id: s.user_id,
      connector_slug: 'gmail',
      event_type: 'gmail_connected',
      message: `Conta ${profile.email} conectada`,
      status: 'success',
      metadata: { email: profile.email, scopes: granted },
    })

    // Limpa states expirados oportunisticamente
    await admin.from('gmail_oauth_states').delete().lt('expires_at', new Date(Date.now() - 60_000).toISOString())

    return redirect(`${origin}${ret}?gmail=connected&email=${encodeURIComponent(profile.email)}`)
  } catch (e) {
    return redirect(`${origin}${ret}?error=${encodeURIComponent((e as Error).message)}`)
  }
})
