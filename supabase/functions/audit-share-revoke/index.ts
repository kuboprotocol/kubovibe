import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = userRes.user.id
    const { id } = await req.json().catch(() => ({}))
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: share } = await admin.from('audit_shares').select('id,user_id,storage_path').eq('id', id).maybeSingle()
    if (!share || share.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    await admin.from('audit_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    // Best-effort delete the storage object too
    await admin.storage.from('audit-reports').remove([share.storage_path]).catch(() => {})
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = (e as Error).message
    const safeMessage = (msg.includes("database") || msg.includes("sql")) ? "Internal server error" : msg;
    return new Response(JSON.stringify({ error: safeMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
