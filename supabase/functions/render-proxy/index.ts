// Proxy to Render API on behalf of the authenticated user.
// Whitelisted actions only. All calls audited via connector_activity_logs.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { admin, authUser, corsHeaders, json, loadConnection, renderFetch } from '../_shared/render.ts'

async function audit(userId: string, eventType: string, status: 'success' | 'error', message: string, metadata: Record<string, unknown> = {}) {
  try {
    await admin().from('connector_activity_logs').insert({
      user_id: userId, connector_slug: 'render', event_type: eventType, status, message, metadata,
    })
  } catch (e) { console.error('audit failed', e) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const connectionId = body.connection_id ? String(body.connection_id) : undefined
    const { conn, apiKey } = await loadConnection(user.id, connectionId)

    // touch last_checked_at on each call (cheap heartbeat)
    const heartbeat = async (status: string, err?: string, latency?: number) => {
      await admin().from('render_connections').update({
        last_status: status, last_checked_at: new Date().toISOString(),
        last_error: err ?? null, last_latency_ms: latency ?? null,
      }).eq('id', conn.id)
    }

    const t0 = performance.now()
    try {
      let result: any
      switch (action) {
        case 'list_services': {
          const limit = Number(body.limit || 50)
          result = await renderFetch(apiKey, `/services?limit=${limit}`)
          break
        }
        case 'get_service': {
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}`)
          break
        }
        case 'list_deploys': {
          const limit = Number(body.limit || 20)
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}/deploys?limit=${limit}`)
          break
        }
        case 'get_deploy': {
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}/deploys/${encodeURIComponent(body.deploy_id)}`)
          break
        }
        case 'trigger_deploy': {
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}/deploys`, {
            method: 'POST',
            body: JSON.stringify({ clearCache: body.clear_cache ? 'clear' : 'do_not_clear' }),
          })
          break
        }
        case 'restart_service': {
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}/restart`, { method: 'POST' })
          break
        }
        case 'rollback': {
          // Rollback = re-deploy a previous (live) deploy by its commit
          const targetDeployId = String(body.deploy_id || '')
          if (!targetDeployId) throw new Error('missing deploy_id')
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}/rollback`, {
            method: 'POST',
            body: JSON.stringify({ deployId: targetDeployId }),
          })
          break
        }
        case 'list_logs': {
          // Render logs endpoint (v1)
          const qp = new URLSearchParams()
          qp.set('resource', String(body.service_id))
          if (body.limit) qp.set('limit', String(body.limit))
          if (body.start_time) qp.set('startTime', String(body.start_time))
          if (body.end_time) qp.set('endTime', String(body.end_time))
          result = await renderFetch(apiKey, `/logs?${qp.toString()}`)
          break
        }
        case 'list_env_vars': {
          result = await renderFetch(apiKey, `/services/${encodeURIComponent(body.service_id)}/env-vars`)
          break
        }
        case 'list_owners': {
          result = await renderFetch(apiKey, `/owners?limit=20`)
          break
        }
        case 'health_check': {
          const rawUrl = String(body.url || '')
          if (!rawUrl) throw new Error('missing url')
          // SSRF guard: only allow public http(s) URLs; block private/reserved/metadata hosts
          let parsed: URL
          try { parsed = new URL(rawUrl) } catch { throw new Error('invalid url') }
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new Error('unsupported protocol')
          }
          const host = parsed.hostname.toLowerCase()
          const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
          const isPrivateIPv4 = isIPv4 && (() => {
            const p = host.split('.').map(Number)
            return (
              p[0] === 10 ||
              p[0] === 127 ||
              (p[0] === 169 && p[1] === 254) ||
              (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
              (p[0] === 192 && p[1] === 168) ||
              p[0] === 0 ||
              p[0] >= 224
            )
          })()
          const blockedHosts = new Set(['localhost', '0.0.0.0', '::1', 'metadata.google.internal'])
          if (blockedHosts.has(host) || host.endsWith('.local') || host.endsWith('.internal') || isPrivateIPv4 || host.includes(':')) {
            throw new Error('host not allowed')
          }
          const start = performance.now()
          try {
            const ctrl = new AbortController()
            const t = setTimeout(() => ctrl.abort(), 10_000)
            const r = await fetch(parsed.toString(), { method: 'GET', redirect: 'manual', signal: ctrl.signal })
            clearTimeout(t)
            result = { ok: r.ok, status: r.status, latency_ms: Math.round(performance.now() - start) }
          } catch (e: any) {
            result = { ok: false, error: e.message, latency_ms: Math.round(performance.now() - start) }
          }
          break
        }
        default:
          throw new Error(`unsupported action: ${action}`)
      }
      const latency = Math.round(performance.now() - t0)
      await heartbeat('ok', undefined, latency)
      await audit(user.id, action, 'success', `render ${action}`, { service_id: body.service_id, latency })
      return json({ data: result, latency_ms: latency })
    } catch (err: any) {
      const latency = Math.round(performance.now() - t0)
      await heartbeat('error', err.message, latency)
      await audit(user.id, action, 'error', err.message || 'render error', { service_id: body.service_id, status: err.status })
      return json({ error: err.message, status: err.status, body: err.body }, err.status || 500)
    }
  } catch (e: any) {
    if (e instanceof Response) return e
    console.error('render-proxy fatal', e)
    return json({ error: e?.message || 'internal' }, 500)
  }
})
