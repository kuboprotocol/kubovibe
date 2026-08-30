// Append-only app-side record of email outcomes.
// Notification/history only — it never gates whether a send is attempted.
// Allowed status values are enforced by a CHECK constraint on email_send_log.
export type EmailSendLogStatus =
  | 'sent'
  | 'suppressed'
  | 'failed'
  | 'bounced'
  | 'complained'

export interface EmailSendLogEntry {
  templateName: string
  recipientEmail: string
  status: EmailSendLogStatus
  errorMessage?: string | null
  messageId?: string | null
  metadata?: Record<string, unknown> | null
}

// deno-lint-ignore no-explicit-any
export async function logEmailSend(admin: any, entry: EmailSendLogEntry): Promise<void> {
  const { error } = await admin.from('email_send_log').insert({
    message_id: entry.messageId ?? null,
    template_name: entry.templateName,
    recipient_email: entry.recipientEmail,
    status: entry.status,
    error_message: entry.errorMessage ? String(entry.errorMessage).slice(0, 1000) : null,
    ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
  })

  if (error) {
    // A log row never decides the send result.
    console.error('Failed to write email_send_log', {
      code: error.code,
      message: error.message,
      template_name: entry.templateName,
      status: entry.status,
    })
  }
}
