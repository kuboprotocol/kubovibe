import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const stateParam = url.searchParams.get('state')

  // Parse state to get the app return URL
  let appBaseUrl = ''
  try {
    if (stateParam) {
      const decoded = JSON.parse(atob(stateParam))
      if (decoded.returnUrl) {
        const returnUrlObj = new URL(decoded.returnUrl)
        appBaseUrl = returnUrlObj.origin
      }
    }
  } catch {
    // ignore parse errors
  }

  const redirect = (path: string) => {
    const target = appBaseUrl ? `${appBaseUrl}${path}` : path
    return new Response(`<html><head><meta http-equiv="refresh" content="0;url=${target}"></head></html>`, {
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
