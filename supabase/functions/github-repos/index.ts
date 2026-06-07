import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptSecret } from '../_shared/connectorCrypto.ts'


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get GitHub token from DB using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Rate limit: 60 req/min por usuário
    const { data: rl } = await serviceClient.rpc('bump_rate_limit', {
      _bucket: 'github_repos', _user: user.id, _window_seconds: 60,
    })
    if (typeof rl === 'number' && rl > 60) {
      return new Response(JSON.stringify({ error: 'rate_limited', retry_after_seconds: 60 }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }

    const { data: connection, error: connError } = await serviceClient
      .from('github_connections')
      .select('access_token_ciphertext, access_token_iv, access_token_tag')
      .eq('user_id', user.id)
      .maybeSingle()

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'GitHub not connected' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch repos from GitHub API
    const url = new URL(req.url)
    const page = url.searchParams.get('page') || '1'
    const perPage = url.searchParams.get('per_page') || '30'
    const sort = url.searchParams.get('sort') || 'updated'

    const accessToken = await decryptSecret({
      ciphertext: connection.access_token_ciphertext,
      iv: connection.access_token_iv,
      tag: connection.access_token_tag,
    })

    const ghRes = await fetch(
      `https://api.github.com/user/repos?sort=${sort}&per_page=${perPage}&page=${page}&affiliation=owner`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,

          Accept: 'application/vnd.github+json',
          'User-Agent': 'KuboVibe',
        },
      }
    )

    if (!ghRes.ok) {
      const errBody = await ghRes.text()
      console.error('GitHub API error:', ghRes.status, errBody)
      return new Response(JSON.stringify({ error: 'GitHub API error', status: ghRes.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const repos = await ghRes.json()

    // Return simplified repo data
    const simplified = repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      updated_at: r.updated_at,
      private: r.private,
    }))

    return new Response(JSON.stringify({ repos: simplified }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
