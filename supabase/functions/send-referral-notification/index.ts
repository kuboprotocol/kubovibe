import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { logEmailSend } from '../_shared/email-send-log.ts'

// Internal sender: invoked by the signup database trigger with the service role
// key. Never callable from the browser — it requires the service role JWT.

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'server_configuration_error' }, 500)

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token || token !== serviceKey) return json({ error: 'unauthorized' }, 401)

  let payload: { referrerId?: string; referredName?: string; creditsEarned?: number }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const referrerId = String(payload.referrerId ?? '')
  if (!referrerId) return json({ error: 'invalid_referrer' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData } = await admin.auth.admin.getUserById(referrerId)
  const recipient = userData?.user?.email
  if (!recipient) return json({ error: 'no_recipient' }, 404)

  try {
    const result = await sendTemplateEmail('referral-notification', recipient, {
      templateData: {
        referredName: payload.referredName ?? '',
        creditsEarned: payload.creditsEarned ?? 100,
      },
      idempotencyKey: `referral-${referrerId}-${payload.referredName ?? ''}`,
    })

    await logEmailSend(admin, {
      templateName: 'referral-notification',
      recipientEmail: recipient,
      status: result.sent ? 'sent' : 'suppressed',
    })
    return json({ success: result.sent })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logEmailSend(admin, {
      templateName: 'referral-notification',
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: message,
    })
    console.error('Referral notification failed', { message })
    return json({ error: 'send_failed' }, 500)
  }
})
