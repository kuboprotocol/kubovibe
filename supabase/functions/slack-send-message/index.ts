import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { slackCall, authUser, logActivity } from '../_shared/slack.ts'

const Body = z.object({
  channel: z.string().min(1).max(64),
  text: z.string().min(1).max(40_000),
  thread_ts: z.string().min(1).max(64).optional(),
  blocks: z.array(z.any()).max(50).optional(),
  username: z.string().max(80).optional(),
  icon_emoji: z.string().max(80).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const payload: Record<string, unknown> = {
      channel: parsed.data.channel,
      text: parsed.data.text,
    }
    if (parsed.data.thread_ts) payload.thread_ts = parsed.data.thread_ts
    if (parsed.data.blocks) payload.blocks = parsed.data.blocks
    if (parsed.data.username) payload.username = parsed.data.username
    if (parsed.data.icon_emoji) payload.icon_emoji = parsed.data.icon_emoji

    const data = await slackCall<any>('chat.postMessage', payload)
    await logActivity(user.id, 'send_message', `Mensagem enviada para ${parsed.data.channel}`, 'success', { channel: parsed.data.channel, ts: data.ts })
    return new Response(JSON.stringify({ ok: true, ts: data.ts, channel: data.channel }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    if (e instanceof Response) return new Response(e.body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    console.error('slack-send-message', e)
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
