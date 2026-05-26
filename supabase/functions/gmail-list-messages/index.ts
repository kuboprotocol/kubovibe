import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { getFreshAccessToken, loadAccount } from '../_shared/gmailToken.ts'

const Body = z.object({
  accountId: z.string().uuid(),
  q: z.string().max(512).optional(),
  from: z.string().max(256).optional(),
  subject: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
  pageToken: z.string().max(2048).optional(),
})

/** Combina filtros estruturados (from/subject) com q livre em sintaxe Gmail. */
function buildQuery(input: { q?: string; from?: string; subject?: string }) {
  const parts: string[] = []
  if (input.from?.trim()) parts.push(`from:${JSON.stringify(input.from.trim())}`)
  if (input.subject?.trim()) parts.push(`subject:${JSON.stringify(input.subject.trim())}`)
  if (input.q?.trim()) parts.push(input.q.trim())
  return parts.join(' ')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const acct = await loadAccount(admin, user.id, parsed.data.accountId)
    const token = await getFreshAccessToken(admin, acct)

    const max = parsed.data.maxResults ?? 15
    const q = buildQuery(parsed.data)

    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    listUrl.searchParams.set('maxResults', String(max))
    if (q) listUrl.searchParams.set('q', q)
    if (parsed.data.pageToken) listUrl.searchParams.set('pageToken', parsed.data.pageToken)

    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })
    const listJson = await listRes.json() as {
      messages?: { id: string }[]
      nextPageToken?: string
      resultSizeEstimate?: number
    }
    if (!listRes.ok) return new Response(JSON.stringify({ error: 'gmail_list_failed', detail: listJson }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const ids = (listJson.messages ?? []).slice(0, max)
    const details = await Promise.all(ids.map(async ({ id }) => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json() as { id: string; snippet?: string; payload?: { headers?: { name: string; value: string }[] } }
      const h = (n: string) => j.payload?.headers?.find(x => x.name.toLowerCase() === n.toLowerCase())?.value ?? ''
      return { id: j.id, snippet: j.snippet ?? '', from: h('From'), subject: h('Subject'), date: h('Date') }
    }))

    return new Response(JSON.stringify({
      messages: details,
      nextPageToken: listJson.nextPageToken ?? null,
      resultSizeEstimate: listJson.resultSizeEstimate ?? details.length,
      query: q || null,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
