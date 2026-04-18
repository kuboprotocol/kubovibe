import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

    const { repo_full_name, branch } = await req.json()
    if (!repo_full_name) {
      return new Response(JSON.stringify({ error: 'repo_full_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: connection } = await serviceClient
      .from('github_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!connection) {
      return new Response(JSON.stringify({ error: 'GitHub not connected' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ghHeaders = {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'KuboVibe',
    }

    let targetBranch = branch
    if (!targetBranch) {
      const repoRes = await fetch(`https://api.github.com/repos/${repo_full_name}`, { headers: ghHeaders })
      if (!repoRes.ok) {
        return new Response(JSON.stringify({ error: 'Could not fetch repo info' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const repoData = await repoRes.json()
      targetBranch = repoData.default_branch || 'main'
    }

    const treeRes = await fetch(
      `https://api.github.com/repos/${repo_full_name}/git/trees/${targetBranch}?recursive=1`,
      { headers: ghHeaders }
    )

    if (!treeRes.ok) {
      return new Response(JSON.stringify({ error: 'Could not fetch repo tree' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const treeData = await treeRes.json()
    const files = (treeData.tree || []).filter((f: any) => f.type === 'blob')

    const deployableExtensions = [
      '.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg',
      '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.txt',
      '.xml', '.webmanifest', '.map',
    ]

    const deployableFiles = files.filter((f: any) => {
      const path = f.path.toLowerCase()
      if (path.startsWith('node_modules/') || path.startsWith('.git/')) return false
      return deployableExtensions.some(ext => path.endsWith(ext))
    })

    const hasIndexHtml = deployableFiles.some((f: any) =>
      f.path === 'index.html' || f.path === 'public/index.html' || f.path === 'dist/index.html'
    )

    if (!hasIndexHtml) {
      const readmeFile = files.find((f: any) =>
        f.path.toLowerCase() === 'readme.md' || f.path.toLowerCase() === 'readme'
      )

      if (!readmeFile) {
        return new Response(JSON.stringify({
          error: 'No deployable content found',
          message: 'O repositório não possui index.html ou README.md. Deploy IPFS requer conteúdo estático.',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const readmeRes = await fetch(
        `https://api.github.com/repos/${repo_full_name}/contents/${readmeFile.path}?ref=${targetBranch}`,
        { headers: { ...ghHeaders, Accept: 'application/vnd.github.raw+json' } }
      )
      const readmeContent = await readmeRes.text()

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${repo_full_name}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #0d1117; color: #c9d1d9; }
    pre { background: #161b22; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
    a { color: #58a6ff; }
    h1,h2,h3 { color: #f0f6fc; }
  </style>
</head>
<body>
  <h1>${repo_full_name}</h1>
  <pre>${readmeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  <footer style="margin-top:2rem;color:#8b949e;font-size:0.8rem;">Deployed via Kubo Vibe IPFS</footer>
</body>
</html>`

      return await deployToIPFS(htmlContent, repo_full_name)
    }

    const indexPaths = ['dist/index.html', 'public/index.html', 'index.html']
    let indexPath = 'index.html'
    for (const p of indexPaths) {
      if (deployableFiles.some((f: any) => f.path === p)) {
        indexPath = p
        break
      }
    }

    const indexRes = await fetch(
      `https://api.github.com/repos/${repo_full_name}/contents/${indexPath}?ref=${targetBranch}`,
      { headers: { ...ghHeaders, Accept: 'application/vnd.github.raw+json' } }
    )

    if (!indexRes.ok) {
      return new Response(JSON.stringify({ error: 'Could not fetch index.html' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const htmlContent = await indexRes.text()
    return await deployToIPFS(htmlContent, repo_full_name)

  } catch (err) {
    console.error('github-ipfs-deploy error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function deployToIPFS(htmlContent: string, repoName: string) {
  const pinataJwt = Deno.env.get('PINATA_JWT')

  if (pinataJwt) {
    const formData = new FormData()
    formData.append('file', new Blob([htmlContent], { type: 'text/html' }), 'index.html')
    formData.append('pinataMetadata', JSON.stringify({ name: `kubovibe-${repoName.replace('/', '-')}` }))

    const uploadRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: formData,
    })

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      console.error('Pinata upload error:', errText)
      return new Response(JSON.stringify({ error: 'IPFS upload failed', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { IpfsHash: cid } = await uploadRes.json()
    return new Response(JSON.stringify({
      cid,
      ipfs_url: `https://gateway.pinata.cloud/ipfs/${cid}`,
      gateway_url: `https://ipfs.io/ipfs/${cid}`,
      repo: repoName,
      status: 'deployed',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fallback: simulated deploy
  const encoder = new TextEncoder()
  const data = encoder.encode(htmlContent)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  const fakeCid = `bafybeig${hashHex.slice(0, 50)}`

  return new Response(JSON.stringify({
    cid: fakeCid,
    ipfs_url: `https://gateway.pinata.cloud/ipfs/${fakeCid}`,
    gateway_url: `https://ipfs.io/ipfs/${fakeCid}`,
    repo: repoName,
    status: 'simulated',
    message: 'Configure PINATA_JWT para deploy real no IPFS',
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
