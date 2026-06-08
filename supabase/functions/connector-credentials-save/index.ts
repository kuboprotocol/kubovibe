import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { encryptSecret } from '../_shared/connectorCrypto.ts'

const BodySchema = z.object({
  connector_slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  api_key: z.string().min(8).max(4096),
})

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
    const enc = await encryptSecret(api_key)


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
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        tag: enc.tag,

        masked_hint: maskHint(api_key),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,connector_slug' })

    if (upsertErr) {
      console.error('[connector-credentials-save] api_credentials upsert error:', upsertErr);
      return new Response(JSON.stringify({ error: 'Falha ao salvar credenciais' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vincula a conta GitHub usando o PAT (sem OAuth)
    if (connector_slug === 'github' && githubProfile?.login) {
      const { error: ghErr } = await admin
        .from('github_connections')
        .upsert({
          user_id: userId,
          access_token_ciphertext: enc.ciphertext,
          access_token_iv: enc.iv,
          access_token_tag: enc.tag,

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

    return new Response(JSON.stringify({
      success: true,
      masked: maskHint(api_key),
      github: githubProfile ? {
        login: githubProfile.login,
        avatar_url: githubProfile.avatar_url,
        profile_url: `https://github.com/${githubProfile.login}`,
      } : null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
