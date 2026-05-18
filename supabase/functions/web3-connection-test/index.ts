import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

// Aceita ou um id de conexão salva, ou um payload "dry-run" (testar antes de salvar).
const BodySchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({
    family: z.enum(['evm', 'solana', 'utxo']),
    rpc_url: z.string().url().max(2048),
    network: z.string().min(1).max(64),
  }),
])

function fromB64(s: string) {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
async function importKey() {
  const raw = Deno.env.get('CONNECTOR_ENC_KEY')!
  const keyBytes = fromB64(raw)
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
}
async function decrypt(ciphertext: string, iv: string, tag: string) {
  const key = await importKey()
  const ct = fromB64(ciphertext)
  const tg = fromB64(tag)
  const merged = new Uint8Array(ct.length + tg.length)
  merged.set(ct, 0); merged.set(tg, ct.length)
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, merged)
  return new TextDecoder().decode(buf)
}

const FAMILY_BY_NETWORK_PREFIX: Record<string, 'evm' | 'solana' | 'utxo'> = {
  'ethereum-': 'evm', 'bsc-': 'evm', 'polygon-': 'evm', 'arbitrum-': 'evm',
  'optimism-': 'evm', 'base-': 'evm', 'boba-': 'evm', 'flow-evm-': 'evm',
  'solana-': 'solana',
  'bitcoin': 'utxo', 'litecoin': 'utxo', 'dogecoin': 'utxo',
}
function familyOf(network: string): 'evm' | 'solana' | 'utxo' {
  for (const [prefix, fam] of Object.entries(FAMILY_BY_NETWORK_PREFIX)) {
    if (network.startsWith(prefix) || network === prefix) return fam
  }
  return 'evm'
}

async function pingEvm(rpcUrl: string, timeoutMs = 8_000): Promise<{ ok: boolean; status: number; blockNumber?: number; detail?: string; latencyMs: number }> {
  const t0 = performance.now()
  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: ctrl.signal,
    })
    const text = await res.text()
    const latencyMs = Math.round(performance.now() - t0)
    if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 240), latencyMs }
    const j = JSON.parse(text)
    if (j?.error) return { ok: false, status: res.status, detail: j.error?.message ?? 'rpc error', latencyMs }
    const block = typeof j?.result === 'string' ? parseInt(j.result, 16) : null
    return { ok: true, status: res.status, blockNumber: block ?? undefined, latencyMs }
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message, latencyMs: Math.round(performance.now() - t0) }
  } finally { clearTimeout(tm) }
}

async function pingSolana(rpcUrl: string, timeoutMs = 8_000) {
  const t0 = performance.now()
  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] }),
      signal: ctrl.signal,
    })
    const text = await res.text()
    const latencyMs = Math.round(performance.now() - t0)
    if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 240), latencyMs }
    const j = JSON.parse(text)
    if (j?.error) return { ok: false, status: res.status, detail: j.error?.message ?? 'rpc error', latencyMs }
    return { ok: true, status: res.status, blockNumber: typeof j?.result === 'number' ? j.result : undefined, latencyMs }
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message, latencyMs: Math.round(performance.now() - t0) }
  } finally { clearTimeout(tm) }
}

async function pingUtxo(rpcUrl: string, timeoutMs = 8_000) {
  const t0 = performance.now()
  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    // Tenta blockstream-style /blocks/tip/height; depois blockchair-style /stats
    const tryHeight = await fetch(`${rpcUrl.replace(/\/$/, '')}/blocks/tip/height`, { signal: ctrl.signal })
    if (tryHeight.ok) {
      const t = await tryHeight.text()
      const h = parseInt(t.trim(), 10)
      return { ok: true, status: tryHeight.status, blockNumber: Number.isFinite(h) ? h : undefined, latencyMs: Math.round(performance.now() - t0) }
    }
    const res = await fetch(`${rpcUrl.replace(/\/$/, '')}/stats`, { signal: ctrl.signal })
    const text = await res.text()
    const latencyMs = Math.round(performance.now() - t0)
    if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 240), latencyMs }
    const j = JSON.parse(text)
    const h = j?.data?.blocks ?? j?.data?.best_block_height
    return { ok: true, status: res.status, blockNumber: typeof h === 'number' ? h : undefined, latencyMs }
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message, latencyMs: Math.round(performance.now() - t0) }
  } finally { clearTimeout(tm) }
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

    const admin = createClient(supabaseUrl, serviceKey)

    // Rate limit
    const { data: countData } = await admin.rpc('bump_rate_limit', { _bucket: 'web3-test', _user: userId, _window_seconds: 60 })
    if (typeof countData === 'number' && countData > 30) {
      return new Response(JSON.stringify({ error: 'rate limit exceeded (30/min)' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    let rpcUrl: string
    let network: string
    let family: 'evm' | 'solana' | 'utxo'
    let connectionId: string | null = null

    if ('id' in parsed.data) {
      const { data: conn, error } = await admin
        .from('web3_connections')
        .select('id, network, rpc_url_ciphertext, rpc_url_iv, rpc_url_tag')
        .eq('id', parsed.data.id).eq('user_id', userId).single()
      if (error || !conn) return new Response(JSON.stringify({ error: 'connection not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      rpcUrl = await decrypt(conn.rpc_url_ciphertext, conn.rpc_url_iv, conn.rpc_url_tag)
      network = conn.network
      family = familyOf(network)
      connectionId = conn.id
    } else {
      rpcUrl = parsed.data.rpc_url
      network = parsed.data.network
      family = parsed.data.family
    }

    const result = family === 'solana' ? await pingSolana(rpcUrl)
                 : family === 'utxo'   ? await pingUtxo(rpcUrl)
                 :                       await pingEvm(rpcUrl)

    if (connectionId) {
      await admin.from('web3_connections').update({
        last_status: result.ok ? 'connected' : 'error',
        last_checked_at: new Date().toISOString(),
        last_block: result.blockNumber ?? null,
        last_latency_ms: result.latencyMs,
        last_error: result.ok ? null : (result.detail ?? `HTTP ${result.status}`),
      }).eq('id', connectionId)
    }

    await admin.from('connector_activity_logs').insert({
      user_id: userId,
      connector_slug: `web3:${network}`,
      event_type: 'web3_connection_test',
      message: result.ok ? `OK — block ${result.blockNumber ?? '?'}` : `FAIL — ${result.detail ?? result.status}`,
      status: result.ok ? 'success' : 'error',
      metadata: { network, family, latencyMs: result.latencyMs, blockNumber: result.blockNumber ?? null },
    })

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
