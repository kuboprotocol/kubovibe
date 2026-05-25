import { decryptSecret, encryptSecret } from './gmailCrypto.ts'

/** Garante um access_token válido, refrescando se necessário. */
export async function getFreshAccessToken(
  admin: ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>,
  account: {
    id: string
    refresh_token_ciphertext: string
    refresh_token_iv: string
    refresh_token_tag: string
    access_token_cache: string | null
    access_token_expires_at: string | null
  },
): Promise<string> {
  const now = Date.now()
  const exp = account.access_token_expires_at ? new Date(account.access_token_expires_at).getTime() : 0
  if (account.access_token_cache && exp > now + 60_000) return account.access_token_cache

  const refresh = await decryptSecret({
    ciphertext: account.refresh_token_ciphertext,
    iv: account.refresh_token_iv,
    tag: account.refresh_token_tag,
  })
  const clientId = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')!
  const clientSecret = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET')!
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  })
  const json = await res.json() as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string }
  if (!res.ok || !json.access_token) throw new Error(`refresh_failed: ${json.error || res.status}`)

  const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString()
  const update: Record<string, unknown> = {
    access_token_cache: json.access_token,
    access_token_expires_at: expiresAt,
    last_synced_at: new Date().toISOString(),
  }
  if (json.refresh_token && json.refresh_token !== refresh) {
    const enc = await encryptSecret(json.refresh_token)
    update.refresh_token_ciphertext = enc.ciphertext
    update.refresh_token_iv = enc.iv
    update.refresh_token_tag = enc.tag
  }
  // @ts-expect-error supabase typing genérica
  await admin.from('gmail_accounts').update(update).eq('id', account.id)
  return json.access_token
}

export async function loadAccount(
  admin: ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>,
  userId: string,
  accountId: string,
) {
  const { data, error } = await admin
    .from('gmail_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('account_not_found')
  return data as {
    id: string; email: string
    refresh_token_ciphertext: string; refresh_token_iv: string; refresh_token_tag: string
    access_token_cache: string | null; access_token_expires_at: string | null
  }
}
