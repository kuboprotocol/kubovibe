import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  login,
  makeConnection,
  mockWeb3Backend,
  openDeleteDialog,
  requiredDeleteToken,
  toasterLocator,
  toastByText,
  UNDO_WINDOW_MS,
} from './helpers/web3Connector'

/**
 * E2E: delete falha após o usuário NÃO clicar em "Desfazer".
 *
 * Contrato validado:
 *  1. Usuário confirma com token completo.
 *  2. Linha some otimisticamente; toast com botão "Desfazer" aparece.
 *  3. Usuário NÃO clica em Desfazer; janela expira.
 *  4. Edge function `web3-connection-delete` é chamada exatamente 1x (HTTP 500).
 *  5. Toast de erro aparece com ação "Tentar novamente".
 *  6. Linha permanece removida (não há rollback — usuário declinou desfazer).
 *  7. Toast inicial "Desfazer" é dispensado.
 *
 * Relatório: test-results/web3-connection-delete-no-undo-failure-report.json
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-no-undo-failure-report.json')

test.describe('Web3 connector — falha pós-janela sem undo', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('edge falha após janela expirar: erro exibido, linha não restaurada', async ({ page, context }) => {
    const report: {
      startedAt: string
      endedAt?: string
      success?: boolean
      deleteCalls: number
      steps: unknown[]
    } = { startedAt: new Date().toISOString(), deleteCalls: 0, steps: [] }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)

    const conn = makeConnection({
      id: '00000000-0000-4000-8000-0000000000cc',
      connection_name: `E2E no-undo-fail ${Date.now()}`,
    })
    const state = await mockWeb3Backend(page, [conn], () => ({
      status: 500,
      body: { error: 'simulated edge function failure' },
    }))

    await page.goto('/connectors/web3/alchemy')
    const { confirmBtn, input } = await openDeleteDialog(page)

    await input.fill(requiredDeleteToken(conn))
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    log('confirm-clicked')

    // Linha some otimisticamente
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 5_000 })

    // Toast inicial com botão Desfazer
    const toaster = toasterLocator(page)
    await expect(toaster.getByRole('button', { name: /desfazer/i }).first()).toBeVisible({ timeout: 3_000 })
    log('undo-toast-visible')

    // Usuário NÃO clica em Desfazer — polling determinístico até commit
    const { waitForUndoCommit } = await import('./helpers/web3Connector')
    await waitForUndoCommit(page, state)

    // Edge chamada exatamente 1x (HTTP 500)
    expect(state.deleteCalls).toBe(1)
    expect(state.deletePayloads[0]).toEqual({ id: conn.id })
    report.deleteCalls = state.deleteCalls
    log('edge-called-once')

    // Toast de erro aparece
    const errorToast = toastByText(page, /falha ao remover|simulated edge function failure/i)
    await expect(errorToast.first()).toBeVisible({ timeout: 5_000 })
    log('error-toast-visible')

    // Ação "Tentar novamente" disponível no toast de erro
    await expect(toaster.getByRole('button', { name: /tentar novamente/i }).first()).toBeVisible()
    log('retry-action-visible')

    // Toast inicial "Desfazer" foi dispensado
    await expect(toaster.getByRole('button', { name: /^desfazer$/i })).toHaveCount(0, { timeout: 3_000 })
    log('undo-toast-dismissed')

    // Linha NÃO foi restaurada — falha pós-janela é terminal
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0)
    log('row-not-restored')

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
