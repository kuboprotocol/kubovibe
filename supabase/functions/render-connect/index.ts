// Save / validate / delete a per-user Render API key. Encrypts at rest.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { admin, authUser, corsHeaders, encryptSecret, json, maskKey, renderFetch } from '../_shared/render.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await authUser(req)
    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'list') {
      const { data, error } = await admin()
        .from('render_connections')
        .select('id,name,workspace_id,api_key_hint,last_status,last_checked_at,last_latency_ms,last_error,created_at,updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return json({ connections: data ?? [] })
    }

    if (action === 'save') {
      const apiKey = String(body.api_key || '').trim()
      const name = String(body.name || 'Render').trim().slice(0, 80)
      const workspaceId = body.workspace_id ? String(body.workspace_id).trim() : null
      if (!apiKey || apiKey.length < 10) return json({ error: 'invalid api_key' }, 400)

      // validate against Render
      let owners: any = null
      try {
        owners = await renderFetch(apiKey, '/owners?limit=5')
      } catch (e: any) {
        return json({ error: `render rejected key: ${e.message}` }, 400)
      }

      const enc = await encryptSecret(apiKey)
      const row = {
        user_id: user.id,
        name,
        workspace_id: workspaceId,
        api_key_hint: maskKey(apiKey),
        api_key_ciphertext: enc.ciphertext,
        api_key_iv: enc.iv,
        api_key_tag: enc.tag,
        last_status: 'ok',
        last_checked_at: new Date().toISOString(),
        last_latency_ms: 0,
        last_error: null,
      }
      const { data, error } = await admin().from('render_connections').insert(row).select('id,name,api_key_hint').single()
      if (error) throw new Error(error.message)
      return json({ connection: data, owners })
    }

    if (action === 'delete') {
      const id = String(body.id || '')
      if (!id) return json({ error: 'missing id' }, 400)
      const { error } = await admin().from('render_connections').delete().eq('user_id', user.id).eq('id', id)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    if (action === 'rename') {
      const id = String(body.id || '')
      const name = String(body.name || '').trim().slice(0, 80)
      if (!id || !name) return json({ error: 'missing id/name' }, 400)
      const { error } = await admin().from('render_connections').update({ name }).eq('user_id', user.id).eq('id', id)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e: any) {
    if (e instanceof Response) return e
    console.error('render-connect error', e)
    return json({ error: e?.message || 'internal' }, 500)
  }
})
