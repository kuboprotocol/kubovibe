// Auto-healing engine. Invoked by pg_cron OR manually from the dashboard.
// For each enabled policy:
//   1. Read current service + last deploys
//   2. If health URL is set: probe it. If down → restart; if still down after restart → rollback.
//   3. If last deploy = update_failed/build_failed/deactivated → rollback to previous live deploy.
//   4. Respect max_restarts_per_hour from render_heal_events.
//   5. Log every action in render_heal_events.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { admin, authUser, corsHeaders, decryptSecret, json, logHeal, renderFetch } from '../_shared/render.ts'

const FAIL_STATES = new Set(['build_failed', 'update_failed', 'canceled', 'deactivated'])

async function recentRestarts(userId: string, serviceId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin()
    .from('render_heal_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('service_id', serviceId)
    .in('action', ['restart', 'rollback', 'redeploy'])
    .gte('created_at', since)
  return count ?? 0
}

async function probe(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const start = performance.now()
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal })
    return { ok: r.ok, status: r.status, latency_ms: Math.round(performance.now() - start) }
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message, latency_ms: Math.round(performance.now() - start) }
  } finally { clearTimeout(t) }
}

async function healOne(policy: any, conn: any, apiKey: string, trigger: string) {
  const userId = policy.user_id
  const sid = policy.service_id
  const actions: any[] = []
  const decisions: any[] = []
  const restarts = await recentRestarts(userId, sid)
  if (restarts >= policy.max_restarts_per_hour) {
    decisions.push({ skipped: 'rate_limited', restarts })
    await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'noop', trigger, status: 'success', detail: { reason: 'rate_limited', restarts } })
    return { service_id: sid, decisions, actions }
  }

  // 1) inspect deploys
  let deploys: any[] = []
  try {
    const d = await renderFetch(apiKey, `/services/${encodeURIComponent(sid)}/deploys?limit=5`)
    deploys = Array.isArray(d) ? d.map((x: any) => x.deploy ?? x) : []
  } catch (e: any) {
    decisions.push({ deploys_err: e.message })
  }
  const last = deploys[0]
  const lastStatus = last?.status

  // 2) probe health
  let health: any = null
  if (policy.health_url) health = await probe(policy.health_url)
  decisions.push({ lastStatus, health })

  let didAction = false

  if (lastStatus && FAIL_STATES.has(lastStatus) && policy.rollback_on_fail) {
    const previousLive = deploys.find((d: any) => d.status === 'live' && d.id !== last?.id)
    if (previousLive) {
      try {
        const r = await renderFetch(apiKey, `/services/${encodeURIComponent(sid)}/rollback`, {
          method: 'POST', body: JSON.stringify({ deployId: previousLive.id }),
        })
        actions.push({ rollback: previousLive.id, response: r })
        await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'rollback', trigger, status: 'success', detail: { to: previousLive.id, reason: lastStatus } })
        didAction = true
      } catch (e: any) {
        actions.push({ rollback_err: e.message })
        await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'rollback', trigger, status: 'error', detail: { error: e.message } })
      }
    } else {
      decisions.push({ skipped_rollback: 'no_previous_live_deploy' })
    }
  } else if (health && !health.ok) {
    // restart first
    try {
      const r = await renderFetch(apiKey, `/services/${encodeURIComponent(sid)}/restart`, { method: 'POST' })
      actions.push({ restart: true, response: r })
      await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'restart', trigger, status: 'success', detail: { health } })
      didAction = true
    } catch (e: any) {
      actions.push({ restart_err: e.message })
      await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'restart', trigger, status: 'error', detail: { error: e.message, health } })
    }
  }

  // 3) optional E2E webhook after deploy success
  if (policy.e2e_run_on_deploy && policy.e2e_webhook_url && lastStatus === 'live' && !didAction) {
    try {
      const r = await fetch(policy.e2e_webhook_url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: sid, deploy_id: last?.id, trigger }),
      })
      actions.push({ e2e: r.status })
      await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'e2e_run', trigger, status: r.ok ? 'success' : 'error', detail: { status: r.status } })
    } catch (e: any) {
      actions.push({ e2e_err: e.message })
      await logHeal({ userId, connectionId: conn.id, serviceId: sid, action: 'e2e_run', trigger, status: 'error', detail: { error: e.message } })
    }
  }

  return { service_id: sid, decisions, actions }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // Auth mode:
    //  - User JWT (Bearer)            → run only for that user (manual trigger from dashboard).
    //  - Service-role key (Bearer)    → trusted cron invocation; loop across every enabled policy.
    //  - Anything else / no header    → 401. Prevents anonymous mass-restart abuse.
    let scopeUserId: string | null = null
    let trigger = 'cron'
    const authHeader = req.headers.get('Authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '__none__'
    const isServiceRole = authHeader.includes(serviceKey)

    if (!authHeader) {
      return json({ error: 'unauthorized' }, 401)
    }

    if (!isServiceRole) {
      try {
        const { user } = await authUser(req)
        scopeUserId = user.id
        trigger = 'manual'
      } catch (_) {
        return json({ error: 'unauthorized' }, 401)
      }
    }


    // load all enabled policies (optionally scoped to one user)
    let q = admin()
      .from('render_auto_heal_policies')
      .select('*, render_connections!inner(id, api_key_ciphertext, api_key_iv, api_key_tag)')
      .eq('enabled', true)
    if (scopeUserId) q = q.eq('user_id', scopeUserId)
    const { data, error } = await q.limit(500)
    if (error) throw new Error(error.message)

    const results: any[] = []
    for (const p of (data ?? [])) {
      const c = (p as any).render_connections
      try {
        const apiKey = await decryptSecret(c.api_key_ciphertext, c.api_key_iv, c.api_key_tag)
        results.push(await healOne(p, c, apiKey, trigger))
      } catch (e: any) {
        results.push({ service_id: p.service_id, error: e.message })
      }
    }
    return json({ trigger, count: results.length, results })
  } catch (e: any) {
    if (e instanceof Response) return e
    console.error('render-auto-heal fatal', e)
    return json({ error: e?.message || 'internal' }, 500)
  }
})
