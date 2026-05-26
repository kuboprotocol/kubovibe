import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { getFreshAccessToken, loadAccount } from '../_shared/gmailToken.ts'

const Body = z.object({
  accountId: z.string().uuid(),
  threadId: z.string().min(1).max(128),
})

interface GHeader { name: string; value: string }
interface GPart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GHeader[]
  body?: { data?: string; size?: number; attachmentId?: string }
  parts?: GPart[]
}
interface GMessage {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  payload?: GPart
  labelIds?: string[]
}

function b64urlDecode(data: string): string {
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4))
  const std = data.replace(/-/g, '+').replace(/_/g, '/') + pad
  try {
    const bin = atob(std)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch { return '' }
}

function header(part: GPart | undefined, name: string): string {
  return part?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

/** Extrai melhor representação texto do payload (text/plain > text/html sanitizado simples). */
function extractBody(payload: GPart | undefined): { text: string; html: string } {
  let text = ''
  let html = ''
  const walk = (p?: GPart) => {
    if (!p) return
    const mime = p.mimeType ?? ''
    if (mime === 'text/plain' && p.body?.data && !text) text = b64urlDecode(p.body.data)
    else if (mime === 'text/html' && p.body?.data && !html) html = b64urlDecode(p.body.data)
    p.parts?.forEach(walk)
  }
  walk(payload)
  if (!text && payload?.body?.data) text = b64urlDecode(payload.body.data)
  return { text, html }
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

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(parsed.data.threadId)}?format=full`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json() as { messages?: GMessage[]; id?: string; historyId?: string }
    if (!res.ok) return new Response(JSON.stringify({ error: 'gmail_thread_failed', detail: json }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const messages = (json.messages ?? []).map(m => {
      const { text, html } = extractBody(m.payload)
      return {
        id: m.id,
        threadId: m.threadId,
        snippet: m.snippet ?? '',
        from: header(m.payload, 'From'),
        to: header(m.payload, 'To'),
        cc: header(m.payload, 'Cc'),
        subject: header(m.payload, 'Subject'),
        date: header(m.payload, 'Date'),
        messageIdHeader: header(m.payload, 'Message-ID') || header(m.payload, 'Message-Id'),
        references: header(m.payload, 'References'),
        labelIds: m.labelIds ?? [],
        bodyText: text,
        bodyHtml: html,
      }
    })

    return new Response(JSON.stringify({
      threadId: json.id ?? parsed.data.threadId,
      messages,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
