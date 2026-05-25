import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { decryptSecret } from '../_shared/gmailCrypto.ts'

const Body = z.object({ accountId: z.string().uuid() })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acct } = await admin.from('gmail_accounts').select('*').eq('id', parsed.data.accountId).eq('user_id', user.id).maybeSingle()
    if (!acct) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Best-effort: revoga refresh token no Google
    try {
      const rt = await decryptSecret({
        ciphertext: (acct as { refresh_token_ciphertext: string }).refresh_token_ciphertext,
        iv: (acct as { refresh_token_iv: string }).refresh_token_iv,
        tag: (acct as { refresh_token_tag: string }).refresh_token_tag,
      })
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rt)}`, { method: 'POST' })
    } catch { /* ignore */ }

    await admin.from('gmail_accounts').delete().eq('id', parsed.data.accountId).eq('user_id', user.id)
    await admin.from('connector_activity_logs').insert({
      user_id: user.id, connector_slug: 'gmail', event_type: 'gmail_disconnected',
      message: `Conta desconectada`, status: 'success', metadata: { accountId: parsed.data.accountId },
    })
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
