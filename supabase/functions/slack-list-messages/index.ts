import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { slackCall, authUser, logActivity } from '../_shared/slack.ts'

type SlackUser = { id: string; name?: string; real_name?: string; profile?: { display_name?: string; image_48?: string } }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const url = new URL(req.url)
    const channel = url.searchParams.get('channel')
    if (!channel) return new Response(JSON.stringify({ error: 'missing channel' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '30'), 1), 200)
    const cursor = url.searchParams.get('cursor') ?? ''

    const q = `channel=${encodeURIComponent(channel)}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const data = await slackCall<any>('conversations.history', undefined, q)

    // Resolve user IDs
    const ids = new Set<string>()
    for (const m of data.messages ?? []) if (m.user) ids.add(m.user)
    const users: Record<string, SlackUser> = {}
    await Promise.all([...ids].map(async (id) => {
      try {
        const u = await slackCall<any>('users.info', undefined, `user=${id}`)
        users[id] = u.user
      } catch { users[id] = { id } }
    }))

    const messages = (data.messages ?? []).map((m: any) => {
      const u = m.user ? users[m.user] : undefined
      const name = u?.profile?.display_name || u?.real_name || u?.name || m.username || m.user || 'desconhecido'
      const text = (m.text ?? '').replace(/<@([A-Z0-9]+)>/g, (_: string, id: string) => `@${users[id]?.real_name ?? id}`)
      return {
        ts: m.ts,
        thread_ts: m.thread_ts,
        user: m.user,
        author: name,
        avatar: u?.profile?.image_48,
        text,
        reply_count: m.reply_count ?? 0,
        reactions: (m.reactions ?? []).map((r: any) => ({ name: r.name, count: r.count })),
      }
    })

    await logActivity(user.id, 'list_messages', `Carregou ${messages.length} mensagens de ${channel}`, 'success', { channel, count: messages.length })
    return new Response(JSON.stringify({ messages, nextCursor: data.response_metadata?.next_cursor ?? null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    if (e instanceof Response) return new Response(e.body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    console.error('slack-list-messages', e)
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
