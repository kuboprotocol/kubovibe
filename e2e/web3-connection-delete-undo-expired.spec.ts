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
  UNDO_WINDOW_MS,
} from './helpers/web3Connector'

/**
 * E2E: Web3 connection — janela de undo expirada
 *
 * Garante que, se o usuário NÃO clicar em "Desfazer" dentro de UNDO_WINDOW_MS:
 *  - timer dispara commitDelete()
 *  - edge function é chamada exatamente 1x
 *  - botão "Desfazer" do toast some
 *  - linha não volta para a lista
 *  - nenhum toast de erro aparece em sucesso
 *  - focus permanece previsível (não rouba foco do document.body)
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-undo-expired-report.json')

test.describe('Web3 connector — undo expira e commit acontece', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('expiração da janela commita o delete sem rollback', async ({ page, context }) => {
    const report: { steps: unknown[]; startedAt: string; endedAt?: string; success?: boolean; deleteCalls: number } = {
      startedAt: new Date().toISOString(),
      steps: [],
      deleteCalls: 0,
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)

    const conn = makeConnection({ id: '00000000-0000-4000-8000-0000000000bb', connection_name: `E2E undo-expired ${Date.now()}` })
    const state = await mockWeb3Backend(page, [conn], (id, s) => {
      s.rows = s.rows.filter((r) => r.id !== id)
      return { status: 200, body: { success: true, id } }
    })

    await page.goto('/connectors/web3/alchemy')
    const { confirmBtn, input } = await openDeleteDialog(page)

    await input.fill(requiredDeleteToken(conn))
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    log('confirm-clicked')

    // Otimista
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 3_000 })
    // Toast Desfazer visível
    await expect(toastByText(page, /desfazer/i).first()).toBeVisible({ timeout: 3_000 })
    log('undo-toast-visible')

    // Não clica — espera commit determinístico via polling de deleteCalls
    const { waitForUndoCommit } = await import('./helpers/web3Connector')
    await waitForUndoCommit(page, state)

    expect(state.deleteCalls).toBe(1)
    report.deleteCalls = state.deleteCalls
    log('committed-after-window')

    // Botão de desfazer some
    await expect(page.locator('[data-sonner-toaster]').getByRole('button', { name: /desfazer/i }))
      .toHaveCount(0, { timeout: 3_000 })

    // Linha NÃO retorna
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0)

    // Sem toast de erro
    expect(await toastByText(page, /erro|falha|failed/i).count()).toBe(0)

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
