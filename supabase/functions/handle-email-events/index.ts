import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// App-side record of terminal delivery outcomes. Notification/history only —
// Lovable enforces suppression server-side at send time.

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const STATUS_BY_REASON: Record<Reason, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const MESSAGE_BY_REASON: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function recordOutcome(
  reason: Reason,
  recipient: string,
  messageId: string | null,
  eventId: string,
) {
  const admin = createClient(supabaseUrl, serviceKey)
  const email = String(recipient).toLowerCase()

  const { error: suppressError } = await admin
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    })
    throw new Error('suppressed_emails write failed')
  }

  const { error: logError } = await admin.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'system',
    recipient_email: email,
    status: STATUS_BY_REASON[reason],
    error_message: MESSAGE_BY_REASON[reason],
    metadata: null,
  })

  if (logError) {
    console.error('Failed to insert email_send_log', {
      code: logError.code,
      message: logError.message,
      event_id: eventId,
    })
    throw new Error('email_send_log write failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordOutcome(
        'bounce',
        event.data.recipient,
        event.data.message_id ?? null,
        event.event_id,
      )
    },
    'email.complaint': async (event) => {
      await recordOutcome(
        'complaint',
        event.data.recipient,
        event.data.message_id ?? null,
        event.event_id,
      )
    },
    'email.unsubscribed': async (event) => {
      await recordOutcome(
        'unsubscribe',
        event.data.recipient,
        event.data.message_id ?? null,
        event.event_id,
      )
    },
  },
})

Deno.serve((req) => handler(req))
