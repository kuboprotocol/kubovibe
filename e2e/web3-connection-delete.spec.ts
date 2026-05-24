import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  login,
  makeConnection,
  mockWeb3Backend,
  openDeleteDialog,
  requiredDeleteToken,
  toastByText,
  waitForUndoCommit,
  UNDO_WINDOW_MS,
} from './helpers/web3Connector'

/**
 * E2E: Web3 connection — delete-confirmation guard (happy path).
 *
 * Cobre o fluxo NOVO (otimista + token completo):
 *  - Cancel não chama edge
 *  - Token errado (apenas nome) mantém confirm desabilitado
 *  - Token completo habilita confirm
 *  - Após confirm: linha some otimisticamente, edge é chamada após UNDO_WINDOW_MS
 *  - Sem rollback nem toast de erro
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-report.json')

test.describe('Web3 connector — delete confirmation guard (happy path)', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('guard exige token completo e completa delete após janela de undo', async ({ page, context }) => {
    const report: { steps: unknown[]; startedAt: string; endedAt?: string; success?: boolean; deleteCalls: number } = {
      startedAt: new Date().toISOString(),
      steps: [],
      deleteCalls: 0,
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)

    const conn = makeConnection({ id: '00000000-0000-4000-8000-000000000777', connection_name: `E2E delete ${Date.now()}` })
    const state = await mockWeb3Backend(page, [conn], (id, s) => {
      s.rows = s.rows.filter((r) => r.id !== id)
      return { status: 200, body: { success: true, id } }
    })

    await page.goto('/connectors/web3/alchemy')
    const { trigger, confirmBtn, cancelBtn, input } = await openDeleteDialog(page)
    log('dialog-open')

    // 1) Cancel path
    await expect(confirmBtn).toBeDisabled()
    await cancelBtn.click()
    await expect(page.getByTestId('web3-delete-dialog')).toBeHidden()
    expect(state.deleteCalls).toBe(0)
    // Focus return — acessibilidade
    await expect(trigger).toBeFocused()
    log('cancel-ok')

    // 2) Wrong-token path: apenas nome não basta
    await trigger.click()
    await expect(page.getByTestId('web3-delete-dialog')).toBeVisible()
    await input.fill(conn.connection_name)
    await expect(confirmBtn).toBeDisabled()
    log('wrong-token-blocked')

    // 3) Token correto habilita confirm e completa delete após janela
    const token = requiredDeleteToken(conn)
    await input.fill(token)
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    // Optimistic remove
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 5_000 })
    log('row-optimistically-removed')

    // Edge function só é chamada após a janela de undo — polling determinístico
    await waitForUndoCommit(page, state)
    expect(state.deleteCalls).toBe(1)
    // Sem toast de erro
    expect(await toastByText(page, /erro|falha|failed/i).count()).toBe(0)
    report.deleteCalls = state.deleteCalls
    log('delete-committed', { deleteCalls: state.deleteCalls })
    // Sem toast de erro
    expect(await toastByText(page, /erro|falha|failed/i).count()).toBe(0)
    report.deleteCalls = state.deleteCalls
    log('delete-committed', { deleteCalls: state.deleteCalls })

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
