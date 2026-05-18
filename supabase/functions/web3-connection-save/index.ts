import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const BodySchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.enum(['alchemy', 'infura', 'custom-rpc']),
  network: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  connection_name: z.string().trim().min(1).max(80),
  rpc_url: z.string().url().max(2048),
  explorer_url: z.string().url().max(2048),
  api_key: z.string().max(4096).optional().nullable(),
})

function b64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function fromB64(s: string) {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
async function importKey() {
  const raw = Deno.env.get('CONNECTOR_ENC_KEY')
  if (!raw) throw new Error('CONNECTOR_ENC_KEY not configured')
  const keyBytes = fromB64(raw)
  if (keyBytes.length !== 32) throw new Error('CONNECTOR_ENC_KEY must be 32 bytes (base64)')
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
}
async function encrypt(plain: string) {
  const key = await importKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  const cipherBytes = new Uint8Array(cipherBuf)
  const tag = cipherBytes.slice(cipherBytes.length - 16)
  const ct = cipherBytes.slice(0, cipherBytes.length - 16)
  return { ciphertext: b64(ct), iv: b64(iv), tag: b64(tag) }
}
function maskHint(v: string) { return v.length <= 8 ? '••••' : `${v.slice(0, 4)}••••${v.slice(-4)}` }

function maskRpcInUrl(url: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length === 0) return `${u.protocol}//${u.host}`
    const tail = parts[parts.length - 1]
    parts[parts.length - 1] = tail.length > 8 ? `${tail.slice(0, 4)}••••${tail.slice(-4)}` : '••••'
    return `${u.protocol}//${u.host}/${parts.join('/')}`
  } catch {
    return '••••'
  }
}

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
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { id, provider, network, connection_name, rpc_url, explorer_url, api_key } = parsed.data

    const rpcEnc = await encrypt(rpc_url)
    const apiKeyEnc = api_key && api_key.length > 0 ? await encrypt(api_key) : null
    const apiKeyHint = api_key && api_key.length > 0 ? maskHint(api_key) : maskRpcInUrl(rpc_url)

    const admin = createClient(supabaseUrl, serviceKey)
    const row = {
      user_id: userId,
      provider,
      network,
      connection_name,
      rpc_url_ciphertext: rpcEnc.ciphertext,
      rpc_url_iv: rpcEnc.iv,
      rpc_url_tag: rpcEnc.tag,
      api_key_ciphertext: apiKeyEnc?.ciphertext ?? null,
      api_key_iv: apiKeyEnc?.iv ?? null,
      api_key_tag: apiKeyEnc?.tag ?? null,
      api_key_hint: apiKeyHint,
      explorer_url,
      updated_at: new Date().toISOString(),
    }

    let saved
    if (id) {
      const { data, error } = await admin.from('web3_connections').update(row).eq('id', id).eq('user_id', userId).select('id, provider, network, connection_name, explorer_url, api_key_hint, last_status, updated_at').single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      saved = data
    } else {
      const { data, error } = await admin.from('web3_connections').upsert(row, { onConflict: 'user_id,provider,network,connection_name' }).select('id, provider, network, connection_name, explorer_url, api_key_hint, last_status, updated_at').single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      saved = data
    }

    await admin.from('connector_activity_logs').insert({
      user_id: userId,
      connector_slug: `web3:${provider}`,
      event_type: 'web3_connection_saved',
      message: `Conexão ${connection_name} (${network}) salva`,
      status: 'success',
      metadata: { network, provider, hint: apiKeyHint },
    })

    return new Response(JSON.stringify({ success: true, connection: saved }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
