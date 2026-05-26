// Shared helpers for the Render connector (multi-tenant, encrypted per-user API key)
import { createClient } from 'npm:@supabase/supabase-js@2'

export const RENDER_API_BASE = 'https://api.render.com/v1'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

export async function authUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw json({ error: 'missing auth' }, 401)
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw json({ error: 'invalid token' }, 401)
  return { user, client }
}

// ---------- AES-256-GCM (encryption at rest, mirrors web3_connections pattern) ----------
const enc = new TextEncoder()
const dec = new TextDecoder()

async function getKey() {
  const raw = Deno.env.get('CONNECTOR_ENC_KEY')
  if (!raw) throw new Error('CONNECTOR_ENC_KEY not configured')
  // accept hex (64) or base64 (44) of 32 bytes
  let bytes: Uint8Array
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    bytes = new Uint8Array(raw.match(/.{1,2}/g)!.map(h => parseInt(h, 16)))
  } else {
    bytes = Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  }
  if (bytes.byteLength !== 32) throw new Error('CONNECTOR_ENC_KEY must decode to 32 bytes')
  return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function b64(arr: Uint8Array) { return btoa(String.fromCharCode(...arr)) }
function ub64(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }

export async function encryptSecret(plain: string) {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)))
  // WebCrypto returns ciphertext||tag (last 16 bytes = tag)
  const tag = ct.slice(ct.length - 16)
  const body = ct.slice(0, ct.length - 16)
  return { ciphertext: b64(body), iv: b64(iv), tag: b64(tag) }
}

export async function decryptSecret(ciphertext: string, iv: string, tag: string) {
  const key = await getKey()
  const body = ub64(ciphertext)
  const tagBytes = ub64(tag)
  const combined = new Uint8Array(body.length + tagBytes.length)
  combined.set(body); combined.set(tagBytes, body.length)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(iv) }, key, combined)
  return dec.decode(pt)
}

export function maskKey(k: string) {
  if (k.length <= 8) return '••••'
  return `${k.slice(0, 4)}…${k.slice(-4)}`
}

// ---------- Render API helper ----------
export async function renderFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${RENDER_API_BASE}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `render http ${res.status}`
    const err = new Error(msg)
    ;(err as any).status = res.status
    ;(err as any).body = data
    throw err
  }
  return data
}

export async function loadConnection(userId: string, connectionId?: string) {
  const db = admin()
  const q = db.from('render_connections').select('*').eq('user_id', userId).limit(1)
  const { data, error } = connectionId
    ? await db.from('render_connections').select('*').eq('user_id', userId).eq('id', connectionId).maybeSingle()
    : await q.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('no render connection — connect first')
  const apiKey = await decryptSecret(data.api_key_ciphertext, data.api_key_iv, data.api_key_tag)
  return { conn: data, apiKey }
}

export async function logHeal(opts: {
  userId: string
  connectionId?: string | null
  serviceId: string
  action: string
  trigger: string
  status: 'success' | 'error'
  detail?: Record<string, unknown>
}) {
  try {
    await admin().from('render_heal_events').insert({
      user_id: opts.userId,
      connection_id: opts.connectionId ?? null,
      service_id: opts.serviceId,
      action: opts.action,
      trigger: opts.trigger,
      status: opts.status,
      detail: opts.detail ?? {},
    })
  } catch (e) { console.error('logHeal failed', e) }
}
