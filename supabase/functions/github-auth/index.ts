const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    if (!clientId) {
      throw new Error('GITHUB_CLIENT_ID is not configured')
    }

    const { returnUrl } = await req.json().catch(() => ({ returnUrl: '' }))

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID()

    // Build GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/github-callback`,
      scope: 'repo user read:org',
      state,
      allow_signup: 'true',
    })

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`

    return new Response(
      JSON.stringify({ url: authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
