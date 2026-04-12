import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  // This is a redirect endpoint — build an HTML response
  const redirect = (path: string) => {
    return new Response(`<html><head><meta http-equiv="refresh" content="0;url=${path}"></head></html>`, {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
    })
  }

  if (error || !code) {
    return redirect('/connectors/github?error=oauth_denied')
  }

  try {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth credentials not configured')
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error)
    }

    const accessToken = tokenData.access_token
    const scope = tokenData.scope || ''

    // Get GitHub user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    const ghUser = await userRes.json()

    // We need the Supabase user — get from the state cookie or query param
    // Since this is a redirect from GitHub, we need another way to identify the user
    // We'll pass user info back to the frontend which will save it
    const params = new URLSearchParams({
      success: 'true',
      username: ghUser.login || '',
      avatar: ghUser.avatar_url || '',
      token: accessToken,
      scope,
    })

    return redirect(`/connectors/github?${params.toString()}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('GitHub callback error:', msg)
    return redirect(`/connectors/github?error=${encodeURIComponent(msg)}`)
  }
})
