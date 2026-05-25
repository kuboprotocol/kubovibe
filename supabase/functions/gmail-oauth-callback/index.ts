import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { encryptSecret } from '../_shared/gmailCrypto.ts'

const DEFAULT_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://kubovibe.dev'

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: to } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) return redirect(`${APP_ORIGIN}/connectors/gmail?error=${encodeURIComponent(errorParam)}`)
  if (!code || !stateRaw) return redirect(`${APP_ORIGIN}/connectors/gmail?error=missing_code`)

  let state: { uid: string; ret: string }
  try { state = JSON.parse(atob(stateRaw)) } catch { return redirect(`${APP_ORIGIN}/connectors/gmail?error=bad_state`) }

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
      return redirect(`${APP_ORIGIN}${state.ret || '/connectors/gmail'}?error=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`)
    }

    // Busca perfil
    const profRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profRes.json() as { email?: string; name?: string; picture?: string }
    if (!profile.email) return redirect(`${APP_ORIGIN}${state.ret}?error=no_email`)

    const enc = await encryptSecret(tokens.refresh_token)
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: upErr } = await admin.from('gmail_accounts').upsert({
      user_id: state.uid,
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

    if (upErr) return redirect(`${APP_ORIGIN}${state.ret}?error=${encodeURIComponent(upErr.message)}`)

    await admin.from('connector_activity_logs').insert({
      user_id: state.uid,
      connector_slug: 'gmail',
      event_type: 'gmail_connected',
      message: `Conta ${profile.email} conectada`,
      status: 'success',
      metadata: { email: profile.email },
    })

    return redirect(`${APP_ORIGIN}${state.ret}?gmail=connected&email=${encodeURIComponent(profile.email)}`)
  } catch (e) {
    return redirect(`${APP_ORIGIN}${state.ret || '/connectors/gmail'}?error=${encodeURIComponent((e as Error).message)}`)
  }
})
