import { createClient } from 'npm:@supabase/supabase-js@2'

export const SLACK_GATEWAY = 'https://connector-gateway.lovable.dev/slack/api'

export function slackHeaders() {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY')
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')
  if (!SLACK_API_KEY) throw new Error('SLACK_API_KEY not configured — connect Slack first')
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': SLACK_API_KEY,
    'Content-Type': 'application/json',
  }
}

export async function slackCall<T = any>(method: string, body?: Record<string, unknown>, query = ''): Promise<T> {
  const url = `${SLACK_GATEWAY}/${method}${query ? '?' + query : ''}`
  const res = await fetch(url, {
    method: 'POST',
    headers: slackHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: any
  try { data = JSON.parse(text) } catch { throw new Error(`slack ${method} non-JSON ${res.status}: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(`slack ${method} http ${res.status}: ${JSON.stringify(data)}`)
  if (!data.ok) throw new Error(`slack ${method} error: ${data.error}`)
  return data as T
}

export async function authUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Response(JSON.stringify({ error: 'missing auth' }), { status: 401 })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 })
  return { user, client }
}

export async function logActivity(userId: string, eventType: string, message: string, status: 'success' | 'error' = 'success', metadata: Record<string, unknown> = {}) {
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await admin.from('connector_activity_logs').insert({
      user_id: userId,
      connector_slug: 'slack',
      event_type: eventType,
      message,
      status,
      metadata,
    })
  } catch (e) {
    console.error('logActivity failed', e)
  }
}
