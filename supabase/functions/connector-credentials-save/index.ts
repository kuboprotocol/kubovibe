import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const BodySchema = z.object({
  connector_slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  api_key: z.string().min(8).max(4096),
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

function maskHint(value: string): string {
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
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
    const { connector_slug, api_key } = parsed.data

    // Encrypt
    const key = await importKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder().encode(api_key)
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
    const cipherBytes = new Uint8Array(cipherBuf)
    // GCM in WebCrypto appends tag (16 bytes) at the end of ciphertext
    const tag = cipherBytes.slice(cipherBytes.length - 16)
    const ct = cipherBytes.slice(0, cipherBytes.length - 16)

    // ====== Validação obrigatória para GitHub ANTES de salvar ======
    let githubProfile: { login: string; avatar_url: string | null } | null = null
    if (connector_slug === 'github') {
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${api_key}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'KuboVibe',
        },
      })
      if (!ghRes.ok) {
        const body = await ghRes.text()
        let detail = body.slice(0, 240)
        try { detail = JSON.parse(body)?.message ?? detail } catch { /* noop */ }
        return new Response(JSON.stringify({
          error: `PAT inválido (HTTP ${ghRes.status}): ${detail}`,
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const profile = await ghRes.json()
      githubProfile = { login: profile?.login, avatar_url: profile?.avatar_url ?? null }
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { error: upsertErr } = await admin
      .from('api_credentials')
      .upsert({
        user_id: userId,
        connector_slug,
        ciphertext: b64(ct),
        iv: b64(iv),
        tag: b64(tag),
        masked_hint: maskHint(api_key),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,connector_slug' })

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vincula a conta GitHub usando o PAT (sem OAuth)
    if (connector_slug === 'github' && githubProfile?.login) {
      const { error: ghErr } = await admin
        .from('github_connections')
        .upsert({
          user_id: userId,
          access_token: api_key,
          github_username: githubProfile.login,
          github_avatar_url: githubProfile.avatar_url,
          scope: 'pat',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (ghErr) console.error('[github_connections upsert]', ghErr.message)
    }

    // Log activity (best-effort)
    await admin.from('connector_activity_logs').insert({
      user_id: userId,
      connector_slug,
      event_type: 'credential_saved',
      message: 'API key salva com sucesso',
      status: 'success',
      metadata: { masked: maskHint(api_key) },
    })

    return new Response(JSON.stringify({ success: true, masked: maskHint(api_key) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
