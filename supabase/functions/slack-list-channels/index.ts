import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { slackCall, authUser, logActivity } from '../_shared/slack.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? ''
    const types = url.searchParams.get('types') ?? 'public_channel,private_channel'
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '100'), 1), 200)

    const q = `limit=${limit}&types=${encodeURIComponent(types)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}&exclude_archived=true`
    const data = await slackCall<any>('conversations.list', undefined, q)

    const channels = (data.channels ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private,
      is_member: c.is_member,
      num_members: c.num_members,
      topic: c.topic?.value,
      purpose: c.purpose?.value,
    }))

    await logActivity(user.id, 'list_channels', `Listou ${channels.length} canais`, 'success', { count: channels.length })
    return new Response(JSON.stringify({ channels, nextCursor: data.response_metadata?.next_cursor ?? null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    if (e instanceof Response) return new Response(e.body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    console.error('slack-list-channels', e)
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
