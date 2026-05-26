import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { getFreshAccessToken, loadAccount } from '../_shared/gmailToken.ts'

const Body = z.object({
  accountId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).max(50_000),
  // Reply / forward support
  threadId: z.string().min(1).max(128).optional(),
  inReplyTo: z.string().min(1).max(998).optional(),
  references: z.string().max(4_000).optional(),
})

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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
    const { accountId, to, subject, body, threadId, inReplyTo, references } = parsed.data

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const acct = await loadAccount(admin, user.id, accountId)
    const token = await getFreshAccessToken(admin, acct)

    const headers: string[] = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
    ]
    if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
    if (references) headers.push(`References: ${references}`)
    const raw = [...headers, '', body].join('\r\n')

    const payload: Record<string, unknown> = { raw: b64url(raw) }
    if (threadId) payload.threadId = threadId

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: 'gmail_send_failed', detail: json }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    await admin.from('connector_activity_logs').insert({
      user_id: user.id,
      connector_slug: 'gmail',
      event_type: threadId ? 'gmail_replied' : 'gmail_sent',
      message: threadId ? `Resposta enviada para ${to}` : `Email enviado para ${to}`,
      status: 'success',
      metadata: { to, subject, accountEmail: (acct as { email: string }).email, messageId: json.id, threadId: json.threadId ?? threadId ?? null },
    })

    return new Response(JSON.stringify({ success: true, id: json.id, threadId: json.threadId ?? threadId ?? null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
