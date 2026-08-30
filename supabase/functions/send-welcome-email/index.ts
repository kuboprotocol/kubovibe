import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { logEmailSend } from '../_shared/email-send-log.ts'

// Sends the welcome email for a freshly created account.
// The recipient is NEVER taken from the request body — it is derived from the
// auth user record, and only for accounts created in the last few minutes.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ACCOUNT_AGE_MS = 15 * 60 * 1000

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'server_configuration_error' }, 500)

  let userId: string
  try {
    const body = await req.json()
    userId = String(body?.userId ?? '')
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!UUID_RE.test(userId)) return json({ error: 'invalid_user_id' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  // Rate limit: at most a handful of attempts per user per hour.
  const { data: hits } = await admin.rpc('bump_rate_limit', {
    _bucket: 'welcome_email',
    _user: userId,
    _window_seconds: 3600,
  })
  if (typeof hits === 'number' && hits > 3) return json({ error: 'rate_limited' }, 429)

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  const user = userData?.user
  if (userError || !user?.email) return json({ error: 'user_not_found' }, 404)

  const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : 0
  if (!createdAtMs || Date.now() - createdAtMs > MAX_ACCOUNT_AGE_MS) {
    return json({ error: 'account_not_new' }, 400)
  }

  const recipient = user.email
  const name =
    (user.user_metadata as Record<string, unknown> | null)?.display_name ?? undefined

  try {
    const result = await sendTemplateEmail('welcome', recipient, {
      templateData: { name },
      idempotencyKey: `welcome-${userId}`,
    })

    if (!result.sent) {
      await logEmailSend(admin, {
        templateName: 'welcome',
        recipientEmail: recipient,
        status: 'suppressed',
      })
      return json({ success: false, reason: result.reason })
    }

    await logEmailSend(admin, {
      templateName: 'welcome',
      recipientEmail: recipient,
      status: 'sent',
    })
    return json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logEmailSend(admin, {
      templateName: 'welcome',
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: message,
    })
    console.error('Welcome email send failed', { message })
    return json({ error: 'send_failed' }, 500)
  }
})
