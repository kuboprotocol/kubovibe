import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { getFreshAccessToken, loadAccount } from '../_shared/gmailToken.ts'

const Body = z.object({
  accountId: z.string().uuid(),
  messageId: z.string().min(1).max(128),
  markAs: z.enum(['read', 'unread']),
})

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

    const body = parsed.data.markAs === 'read'
      ? { removeLabelIds: ['UNREAD'] }
      : { addLabelIds: ['UNREAD'] }

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(parsed.data.messageId)}/modify`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    const json = await res.json() as { id?: string; labelIds?: string[]; error?: unknown }
    if (!res.ok) return new Response(JSON.stringify({ error: 'gmail_modify_failed', detail: json }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    return new Response(JSON.stringify({ id: json.id, labelIds: json.labelIds ?? [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
