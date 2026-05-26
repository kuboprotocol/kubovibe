import { test, expect, type Route } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { login } from './helpers/web3Connector'

/**
 * E2E: Conector Gmail — caminho feliz mockado.
 *
 * Mocka todas as edge functions Gmail e o REST de `gmail_accounts` para validar:
 *  - Listagem de contas
 *  - Listagem + busca/filtros + paginação
 *  - Abertura de thread (conversa)
 *  - Reply com threadId/inReplyTo/references no payload
 *  - Contadores de chamadas por função para detectar regressões
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'gmail-connector-report.json')

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000aaa'
const THREAD_ID = 'thread-123'
const MSG_ID = 'msg-1'
const MSG_ID_2 = 'msg-2'

interface Counters {
  list: number
  thread: number
  send: number
  lastListBody?: unknown
  lastSendBody?: unknown
  lastThreadBody?: unknown
}

async function mockGmailBackend(page: import('@playwright/test').Page, counters: Counters) {
  // REST: gmail_accounts SELECT
  await page.route(/\/rest\/v1\/gmail_accounts(?:\?|$)/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: ACCOUNT_ID,
        email: 'agent@kubovibe.dev',
        display_name: 'Agent Kubo',
        avatar_url: null,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }]),
    })
  })

  // Edge: gmail-list-messages
  await page.route(/\/functions\/v1\/gmail-list-messages/, async (route: Route) => {
    counters.list++
    counters.lastListBody = JSON.parse(route.request().postData() || '{}')
    const body = counters.lastListBody as { pageToken?: string; q?: string }
    const isPage2 = !!body.pageToken
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: isPage2 ? 'm-p2' : MSG_ID, threadId: THREAD_ID, from: 'Alice <alice@example.com>', subject: 'Proposta comercial', snippet: 'Olá time…', date: new Date().toISOString() },
          { id: MSG_ID_2, threadId: 'thread-other', from: 'Bob <bob@example.com>', subject: 'Reunião', snippet: 'Confirmando…', date: new Date().toISOString() },
        ],
        nextPageToken: isPage2 ? null : 'page-2-token',
        resultSizeEstimate: 42,
      }),
    })
  })

  // Edge: gmail-get-thread
  await page.route(/\/functions\/v1\/gmail-get-thread/, async (route: Route) => {
    counters.thread++
    counters.lastThreadBody = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        threadId: THREAD_ID,
        messages: [
          {
            id: MSG_ID, threadId: THREAD_ID, snippet: 'Olá time',
            from: 'Alice <alice@example.com>', to: 'agent@kubovibe.dev', cc: '',
            subject: 'Proposta comercial', date: new Date().toISOString(),
            messageIdHeader: '<msg-1@mail.example.com>', references: '',
            labelIds: ['INBOX'], bodyText: 'Corpo da mensagem original.', bodyHtml: '',
          },
          {
            id: 'msg-1b', threadId: THREAD_ID, snippet: 'Replied',
            from: 'agent@kubovibe.dev', to: 'alice@example.com', cc: '',
            subject: 'Re: Proposta comercial', date: new Date().toISOString(),
            messageIdHeader: '<msg-1b@mail.kubovibe>', references: '<msg-1@mail.example.com>',
            labelIds: ['SENT'], bodyText: 'Obrigado, vou revisar.', bodyHtml: '',
          },
        ],
      }),
    })
  })

  // Edge: gmail-send-message
  await page.route(/\/functions\/v1\/gmail-send-message/, async (route: Route) => {
    counters.send++
    counters.lastSendBody = JSON.parse(route.request().postData() || '{}')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 'sent-1', threadId: THREAD_ID }),
    })
  })
}

test.describe('Gmail connector — happy path mockado', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('lista, abre thread, responde com headers corretos e pagina', async ({ page, context }) => {
    const counters: Counters = { list: 0, thread: 0, send: 0 }
    const report: Record<string, unknown> = { startedAt: new Date().toISOString(), steps: [] as unknown[] }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      (report.steps as unknown[]).push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)
    await mockGmailBackend(page, counters)

    await page.goto('/connectors/gmail')

    // 1) Conta aparece + inbox carrega
    await expect(page.getByTestId('gmail-account-row')).toHaveCount(1)
    await expect(page.getByTestId('gmail-message-row')).toHaveCount(2, { timeout: 8_000 })
    expect(counters.list).toBe(1)
    expect(counters.lastListBody).toMatchObject({ accountId: ACCOUNT_ID, maxResults: 15 })
    log('inbox-loaded', { listCalls: counters.list })

    // 2) Busca por remetente — payload deve refletir filtros
    await page.getByPlaceholder('Remetente').fill('alice@example.com')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('gmail-message-row')).toHaveCount(2)
    expect(counters.list).toBe(2)
    expect(counters.lastListBody).toMatchObject({ accountId: ACCOUNT_ID, from: 'alice@example.com' })
    log('filters-applied', { listCalls: counters.list })

    // 3) Paginação — próximo envia pageToken
    await page.getByRole('button', { name: /próximo/i }).click()
    await expect(page.getByTestId('gmail-message-row').first()).toBeVisible()
    expect(counters.list).toBe(3)
    expect(counters.lastListBody).toMatchObject({ pageToken: 'page-2-token' })
    log('pagination-next', { listCalls: counters.list })

    // Volta para página 1 (estado limpo) para evitar dependência da ordem
    await page.getByRole('button', { name: /anterior/i }).click()
    await expect(page.getByTestId('gmail-message-row')).toHaveCount(2)
    expect(counters.list).toBe(4)
    log('pagination-prev', { listCalls: counters.list })

    // 4) Abre thread
    await page.getByTestId('gmail-message-row').first().click()
    await expect(page.getByTestId('gmail-thread-dialog')).toBeVisible()
    await expect(page.getByTestId('gmail-thread-message')).toHaveCount(2)
    expect(counters.thread).toBe(1)
    expect(counters.lastThreadBody).toEqual({ accountId: ACCOUNT_ID, threadId: THREAD_ID })
    log('thread-opened', { threadCalls: counters.thread })

    // 5) Responder — payload precisa conter threadId + inReplyTo + references
    await page.getByTestId('gmail-thread-reply').click()
    await expect(page.getByTestId('gmail-reply-form')).toBeVisible()
    // O destinatário deve estar pré-preenchido a partir do header From
    await expect(page.locator('#rto')).toHaveValue('alice@example.com')
    await expect(page.locator('#rsubj')).toHaveValue(/^Re:/)
    await page.locator('#rbody').fill('Vamos marcar uma call amanhã.')
    await page.getByTestId('gmail-reply-submit').click()

    await expect.poll(() => counters.send).toBe(1)
    const sent = counters.lastSendBody as Record<string, unknown>
    expect(sent.accountId).toBe(ACCOUNT_ID)
    expect(sent.to).toBe('alice@example.com')
    expect(String(sent.subject)).toMatch(/^Re:/)
    expect(sent.threadId).toBe(THREAD_ID)
    // Última mensagem é a resposta SENT — inReplyTo deve apontar para ela
    expect(sent.inReplyTo).toBe('<msg-1b@mail.kubovibe>')
    expect(String(sent.references || '')).toContain('<msg-1@mail.example.com>')
    expect(String(sent.references || '')).toContain('<msg-1b@mail.kubovibe>')
    log('reply-sent', { sendCalls: counters.send, payload: sent })

    // Após reply o app recarrega thread + inbox
    await expect.poll(() => counters.thread).toBeGreaterThanOrEqual(2)
    await expect.poll(() => counters.list).toBeGreaterThanOrEqual(5)

    report.endedAt = new Date().toISOString()
    report.success = true
    ;(report as { counters?: Counters }).counters = counters
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  })
})
