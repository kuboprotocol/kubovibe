import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const BodySchema = z.object({ id: z.string().uuid() })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const userId = userData.user.id

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: conn } = await admin.from('web3_connections').select('id, provider, network, connection_name').eq('id', parsed.data.id).eq('user_id', userId).maybeSingle()
    if (!conn) return new Response(JSON.stringify({ error: 'connection not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { error } = await admin.from('web3_connections').delete().eq('id', parsed.data.id).eq('user_id', userId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    await admin.from('connector_activity_logs').insert({
      user_id: userId,
      connector_slug: `web3:${conn.provider}`,
      event_type: 'web3_connection_deleted',
      message: `Conexão ${conn.connection_name} (${conn.network}) removida`,
      status: 'success',
      metadata: { network: conn.network, provider: conn.provider },
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
