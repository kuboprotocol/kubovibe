import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { slackCall, authUser, logActivity } from '../_shared/slack.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '100'), 1), 999)
    const cursor = url.searchParams.get('cursor') ?? ''

    const data = await slackCall<any>('users.list', undefined, `limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    const team = await slackCall<any>('team.info').catch(() => null)

    const members = (data.members ?? [])
      .filter((m: any) => !m.deleted)
      .map((m: any) => ({
        id: m.id,
        name: m.profile?.display_name || m.real_name || m.name,
        email: m.profile?.email,
        avatar: m.profile?.image_48,
        is_bot: m.is_bot,
        is_admin: m.is_admin,
        tz: m.tz,
      }))

    await logActivity(user.id, 'list_users', `Carregou ${members.length} usuários`, 'success', { count: members.length })
    return new Response(JSON.stringify({
      team: team?.team ? { id: team.team.id, name: team.team.name, domain: team.team.domain, icon: team.team.icon?.image_88 } : null,
      members,
      nextCursor: data.response_metadata?.next_cursor ?? null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    if (e instanceof Response) return new Response(e.body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    console.error('slack-list-users', e)
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
