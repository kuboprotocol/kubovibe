// Scheduled job (pg_cron via pg_net): refresca tokens e atualiza last_synced_at
// para todas as contas Gmail conectadas. Roda como service-role.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { getFreshAccessToken } from '../_shared/gmailToken.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Security: only service_role can trigger sync
  const authHeader = req.headers.get('Authorization')
  const apiKey = req.headers.get('apikey')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  const isAuthorized = (authHeader === `Bearer ${serviceKey}`) || (apiKey === serviceKey)
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }


  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: accounts, error } = await admin
    .from('gmail_accounts')
    .select('id, user_id, email, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, access_token_cache, access_token_expires_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(200)

  if (error) {
    const safeMessage = (error.message.includes("database") || error.message.includes("sql")) ? "Internal server error" : error.message;
    return new Response(JSON.stringify({ error: safeMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let refreshed = 0
  let failed = 0
  const failures: { id: string; email: string; reason: string }[] = []

  for (const acct of (accounts ?? []) as Array<{
    id: string; user_id: string; email: string
    refresh_token_ciphertext: string; refresh_token_iv: string; refresh_token_tag: string
    access_token_cache: string | null; access_token_expires_at: string | null
  }>) {
    try {
      await getFreshAccessToken(admin, acct)
      // toca last_synced_at mesmo se token ainda estava válido
      await admin.from('gmail_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', acct.id)
      refreshed++
    } catch (e) {
      failed++
      failures.push({ id: acct.id, email: acct.email, reason: (e as Error).message })
      await admin.from('connector_activity_logs').insert({
        user_id: acct.user_id,
        connector_slug: 'gmail',
        event_type: 'gmail_sync_failed',
        message: `Falha ao sincronizar ${acct.email}`,
        status: 'error',
        metadata: { accountId: acct.id, reason: (e as Error).message },
      })
    }
  }

  return new Response(JSON.stringify({
    success: true,
    total: accounts?.length ?? 0,
    refreshed,
    failed,
    failures: failures.slice(0, 10),
    ranAt: new Date().toISOString(),
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
