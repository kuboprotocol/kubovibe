// CRUD for render_auto_heal_policies (per-service auto-heal config)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { admin, authUser, corsHeaders, json } from '../_shared/render.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const db = admin()

    if (action === 'list') {
      const { data, error } = await db.from('render_auto_heal_policies').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
      if (error) throw new Error(error.message)
      return json({ policies: data ?? [] })
    }
    if (action === 'upsert') {
      const payload = {
        user_id: user.id,
        connection_id: body.connection_id,
        service_id: String(body.service_id || ''),
        service_name: body.service_name ?? null,
        enabled: !!body.enabled,
        health_url: body.health_url || null,
        max_restarts_per_hour: Number(body.max_restarts_per_hour ?? 5),
        rollback_on_fail: body.rollback_on_fail !== false,
        e2e_webhook_url: body.e2e_webhook_url || null,
        e2e_run_on_deploy: !!body.e2e_run_on_deploy,
      }
      if (!payload.service_id || !payload.connection_id) return json({ error: 'missing service_id/connection_id' }, 400)
      const { data, error } = await db.from('render_auto_heal_policies').upsert(payload, { onConflict: 'user_id,service_id' }).select().single()
      if (error) throw new Error(error.message)
      return json({ policy: data })
    }
    if (action === 'delete') {
      const id = String(body.id || '')
      if (!id) return json({ error: 'missing id' }, 400)
      const { error } = await db.from('render_auto_heal_policies').delete().eq('user_id', user.id).eq('id', id)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }
    if (action === 'events') {
      const limit = Number(body.limit || 50)
      const sid = body.service_id ? String(body.service_id) : null
      let q = db.from('render_heal_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit)
      if (sid) q = q.eq('service_id', sid)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return json({ events: data ?? [] })
    }
    return json({ error: 'unknown action' }, 400)
  } catch (e: any) {
    if (e instanceof Response) return e
    console.error('render-policies error', e)
    return json({ error: e?.message || 'internal' }, 500)
  }
})
