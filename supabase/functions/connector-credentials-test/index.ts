import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const BodySchema = z.object({
  connector_slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
})

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
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
}

async function decrypt(ciphertextB64: string, ivB64: string, tagB64: string): Promise<string> {
  const key = await importKey()
  const ct = fromB64(ciphertextB64)
  const tag = fromB64(tagB64)
  const iv = fromB64(ivB64)
  // WebCrypto AES-GCM expects ciphertext+tag concatenated
  const combined = new Uint8Array(ct.length + tag.length)
  combined.set(ct, 0)
  combined.set(tag, ct.length)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined)
  return new TextDecoder().decode(plain)
}

interface TestResult {
  ok: boolean
  status: number
  account?: string
  detail?: string
  raw?: unknown
}

async function testConnector(slug: string, apiKey: string): Promise<TestResult> {
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  let url = ''
  let parse: (json: any) => string | undefined = () => undefined

  switch (slug) {
    case 'github':
      url = 'https://api.github.com/user'
      headers['Authorization'] = `Bearer ${apiKey}`
      headers['User-Agent'] = 'KUBO-Vibe-Dev'
      parse = (j) => j?.login ? `@${j.login}` : undefined
      break
    case 'stripe':
      url = 'https://api.stripe.com/v1/account'
      headers['Authorization'] = `Bearer ${apiKey}`
      parse = (j) => j?.email || j?.id
      break
    case 'figma':
      url = 'https://api.figma.com/v1/me'
      headers['X-Figma-Token'] = apiKey
      parse = (j) => j?.email || j?.handle
      break
    case 'vercel':
      url = 'https://api.vercel.com/v2/user'
      headers['Authorization'] = `Bearer ${apiKey}`
      parse = (j) => j?.user?.username || j?.user?.email
      break
    case 'resend':
      url = 'https://api.resend.com/domains'
      headers['Authorization'] = `Bearer ${apiKey}`
      parse = (j) => Array.isArray(j?.data) ? `${j.data.length} domínio(s)` : 'autenticado'
      break
    case 'discord':
      url = 'https://discord.com/api/v10/users/@me'
      headers['Authorization'] = `Bot ${apiKey}`
      parse = (j) => j?.username ? `${j.username}#${j.discriminator ?? ''}` : undefined
      break
    case 'cloudflare':
      url = 'https://api.cloudflare.com/client/v4/user/tokens/verify'
      headers['Authorization'] = `Bearer ${apiKey}`
      parse = (j) => j?.result?.status === 'active' ? 'Token ativo' : j?.result?.id
      break
    case 'supabase': {
      // Supabase Service Role Key é um JWT — validamos estrutura.
      const parts = apiKey.split('.')
      if (parts.length !== 3) return { ok: false, status: 400, detail: 'Não parece um JWT válido' }
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (payload?.role !== 'service_role') {
          return { ok: false, status: 400, detail: `Role detectado: ${payload?.role ?? 'desconhecido'} (use a Service Role Key)` }
        }
        return { ok: true, status: 200, account: `Projeto ${payload.ref ?? '—'}`, detail: 'JWT válido' }
      } catch {
        return { ok: false, status: 400, detail: 'JWT corrompido' }
      }
    }
    default:
      return { ok: false, status: 501, detail: 'Teste não implementado para este conector' }
  }

  try {
    const res = await fetch(url, { method: 'GET', headers })
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* keep text */ }

    if (!res.ok) {
      const detail = json?.error?.message ?? json?.message ?? json?.errors?.[0]?.message ?? text.slice(0, 240)
      return { ok: false, status: res.status, detail }
    }
    return { ok: true, status: res.status, account: parse(json), detail: 'Conexão validada com sucesso' }
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { connector_slug } = parsed.data

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: cred, error: credErr } = await admin
      .from('api_credentials')
      .select('ciphertext, iv, tag, masked_hint')
      .eq('user_id', userId)
      .eq('connector_slug', connector_slug)
      .maybeSingle()

    if (credErr) {
      return new Response(JSON.stringify({ error: credErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!cred) {
      return new Response(JSON.stringify({ error: 'Nenhuma chave cadastrada para este conector' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let apiKey: string
    try {
      apiKey = await decrypt(cred.ciphertext, cred.iv, cred.tag)
    } catch (e) {
      return new Response(JSON.stringify({ error: `Falha ao descriptografar: ${(e as Error).message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await testConnector(connector_slug, apiKey)

    // Log activity (best-effort)
    await admin.from('connector_activity_logs').insert({
      user_id: userId,
      connector_slug,
      event_type: 'credential_tested',
      message: result.ok ? `Teste OK: ${result.account ?? 'autenticado'}` : `Teste falhou: ${result.detail ?? result.status}`,
      status: result.ok ? 'success' : 'error',
      metadata: { http_status: result.status, masked: cred.masked_hint },
    })

    return new Response(JSON.stringify({
      ok: result.ok,
      status: result.status,
      account: result.account ?? null,
      detail: result.detail ?? null,
      masked: cred.masked_hint,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
