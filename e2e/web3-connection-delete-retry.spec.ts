import { test, expect }  from '@playwright/test'
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
  waitForUndoCommit,
} from './helpers/web3Connector'

/**
 * E2E: após falha de deleção pós-janela, usuário clica em "Tentar novamente".
 *
 * Contrato validado:
 *  1. Confirma delete; linha some otimisticamente.
 *  2. Não clica em Desfazer; janela expira → edge chamada 1x (HTTP 500).
 *  3. Toast de erro com ação "Tentar novamente" é exibido.
 *  4. Usuário clica em "Tentar novamente".
 *  5. Edge é chamada NOVAMENTE (deleteCalls = 2).
 *  6. Linha permanece removida (sem rollback automático).
 *
 * Relatório: test-results/web3-connection-delete-retry-report.json
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-retry-report.json')

test.describe('Web3 connector — retry após falha de deleção', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('retry dispara nova chamada à edge, linha continua removida', async ({ page, context }) => {
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
      id: '00000000-0000-4000-8000-0000000000dd',
      connection_name: `E2E retry-fail ${Date.now()}`,
    })

    // Mock: edge sempre falha com 500 (o que importa é a contagem de calls)
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

    // 1. Linha some otimisticamente
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 5_000 })
    log('row-optimistically-removed')

    // 2. Toast inicial com botão Desfazer
    const toaster = toasterLocator(page)
    await expect(toaster.getByRole('button', { name: /desfazer/i }).first()).toBeVisible({ timeout: 3_000 })
    log('undo-toast-visible')

    // 3. Não clica em Desfazer — espera determinística pelo commit
    await waitForUndoCommit(page, state)
    log('undo-window-expired')

    // 4. Edge chamada exatamente 1x
    expect(state.deleteCalls).toBe(1)
    report.deleteCalls = state.deleteCalls
    log('edge-first-call', { deleteCalls: state.deleteCalls })

    // 5. Toast de erro com ação "Tentar novamente"
    const errorToast = toastByText(page, /falha ao remover|simulated edge function failure/i)
    await expect(errorToast.first()).toBeVisible({ timeout: 5_000 })
    log('error-toast-visible')

    const retryBtn = toaster.getByRole('button', { name: /tentar novamente/i }).first()
    await expect(retryBtn).toBeVisible()
    log('retry-button-visible')

    // 6. Clica em "Tentar novamente"
    await retryBtn.click()
    log('retry-clicked')

    // 7. Verifica nova chamada à edge (determinística via polling)
    await expect
      .poll(() => state.deleteCalls, {
        timeout: 8_000,
        intervals: [200, 400, 800],
        message: 'Esperando deleteCalls === 2 após retry',
      })
      .toBe(2)
    report.deleteCalls = state.deleteCalls
    log('edge-second-call', { deleteCalls: state.deleteCalls })

    // 8. Linha permanece removida
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1)
    log('row-still-removed')

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
