import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { logEmailSend } from '../_shared/email-send-log.ts'

// Resends the current status email for one domain transfer the caller owns.
// The recipient is derived from the transfer row / the authenticated user,
// never from the request body.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'server_configuration_error' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  const user = authData?.user
  if (authError || !user) return json({ error: 'unauthorized' }, 401)

  let transferId: string
  try {
    const body = await req.json()
    transferId = String(body?.transferId ?? body?.transfer_id ?? '')
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (!UUID_RE.test(transferId)) return json({ error: 'invalid_transfer_id' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: hits } = await admin.rpc('bump_rate_limit', {
    _bucket: 'domain_transfer_status_email',
    _user: user.id,
    _window_seconds: 300,
  })
  if (typeof hits === 'number' && hits > 5) return json({ error: 'rate_limited' }, 429)

  const { data: transfer, error: transferError } = await admin
    .from('kubo_domain_transfers')
    .select('id, user_id, domain_name, status, status_message, current_registrar, notify_email')
    .eq('id', transferId)
    .maybeSingle()

  if (transferError) return json({ error: 'lookup_failed' }, 500)
  if (!transfer || transfer.user_id !== user.id) return json({ error: 'not_found' }, 404)

  const recipient = transfer.notify_email || user.email
  if (!recipient) return json({ error: 'no_recipient' }, 400)

  try {
    const result = await sendTemplateEmail('domain-transfer-status', recipient, {
      templateData: {
        domain: transfer.domain_name,
        status: transfer.status,
        message: transfer.status_message ?? '',
        registrar: transfer.current_registrar ?? '',
      },
      idempotencyKey: `transfer-resend-${transfer.id}-${Date.now()}`,
    })

    if (!result.sent) {
      await logEmailSend(admin, {
        templateName: 'domain-transfer-status',
        recipientEmail: recipient,
        status: 'suppressed',
      })
      return json({ success: false, reason: result.reason })
    }

    await logEmailSend(admin, {
      templateName: 'domain-transfer-status',
      recipientEmail: recipient,
      status: 'sent',
    })

    await admin
      .from('kubo_domain_transfers')
      .update({ last_notified_at: new Date().toISOString() })
      .eq('id', transfer.id)

    return json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logEmailSend(admin, {
      templateName: 'domain-transfer-status',
      recipientEmail: recipient,
      status: 'failed',
      errorMessage: message,
    })
    console.error('Domain transfer status email failed', { message })
    return json({ error: 'send_failed' }, 500)
  }
})
