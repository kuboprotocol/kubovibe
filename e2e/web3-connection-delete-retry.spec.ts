import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  login,
  makeConnection,
  mockWeb3Backend,
  openDeleteDialog,
  requiredDeleteToken,
  snapshotToasts,
  toasterLocator,
  toastByText,
  waitForUndoCommit,
} from './helpers/web3Connector'

/**
 * E2E: "Tentar novamente" após falha de deleção pós-janela.
 *
 * Cenário: 1ª chamada à edge falha (500) → toast de erro com retry.
 *          Usuário clica retry → 2ª chamada sucede (200).
 *
 * Contrato validado (sem falsos positivos):
 *  1. Linha some otimisticamente; sem rollback em nenhum momento.
 *  2. Após janela, edge chamada 1x → toast de erro com "Tentar novamente".
 *  3. Clique em "Tentar novamente":
 *     - Edge é chamada EXATAMENTE mais 1 vez (deleteCalls === 2).
 *     - Payloads de AMBAS as chamadas são { id } — sem campos extras.
 *     - Toast inicial de erro é SUBSTITUÍDO (não empilha) — mesma toast id.
 *     - Botão "Tentar novamente" some após sucesso.
 *  4. Nenhuma chamada extra ocorre depois (debounce/retry fantasma).
 *  5. Linha permanece removida.
 *
 * Relatório: test-results/web3-connection-delete-retry-report.json
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-retry-report.json')

test.describe('Web3 connector — retry após falha de deleção', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('retry substitui toast, dispara 2ª chamada e remove botão "Tentar novamente"', async ({ page, context }) => {
    const report: {
      startedAt: string
      endedAt?: string
      success?: boolean
      deleteCalls: number
      payloads: unknown[]
      toastTimeline: { at: string; step: string; toasts: string[] }[]
      steps: unknown[]
    } = {
      startedAt: new Date().toISOString(),
      deleteCalls: 0,
      payloads: [],
      toastTimeline: [],
      steps: [],
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })
    const snapToasts = async (step: string) => {
      const toasts = await snapshotToasts(page)
      report.toastTimeline.push({ at: new Date().toISOString(), step, toasts })
      log(`toasts:${step}`, { toasts })
    }

    await context.clearCookies()
    await login(page)

    const conn = makeConnection({
      id: '00000000-0000-4000-8000-0000000000dd',
      connection_name: `E2E retry-fail ${Date.now()}`,
    })

    // Handler: 1ª chamada falha (500), 2ª e subsequentes sucedem (200).
    const state = await mockWeb3Backend(page, [conn], (_id, s) => {
      if (s.deleteCalls === 1) return { status: 500, body: { error: 'simulated edge failure' } }
      s.rows = s.rows.filter((r) => r.id !== _id)
      return { status: 200, body: { success: true, id: _id } }
    })

    await page.goto('/connectors/web3/alchemy')
    const { confirmBtn, input } = await openDeleteDialog(page)

    await input.fill(requiredDeleteToken(conn))
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    log('confirm-clicked')

    // 1. Linha some otimisticamente
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 5_000 })
    log('row-optimistically-removed')

    // 2. Toast inicial com "Desfazer"
    const toaster = toasterLocator(page)
    const undoBtn = toaster.getByRole('button', { name: /desfazer/i }).first()
    await expect(undoBtn).toBeVisible({ timeout: 3_000 })
    await snapToasts('undo-visible')

    // 3. Não clica em Desfazer; espera commit determinístico (deleteCalls === 1)
    await waitForUndoCommit(page, state)
    log('undo-window-expired', { deleteCalls: state.deleteCalls })

    // 4. Toast de erro com retry
    const errorToast = toastByText(page, /falha ao remover/i).first()
    await expect(errorToast).toBeVisible({ timeout: 5_000 })
    const retryBtn = toaster.getByRole('button', { name: /tentar novamente/i }).first()
    await expect(retryBtn).toBeVisible()
    await snapToasts('error-visible')

    // 5. Contrato de payload da 1ª chamada
    expect(state.deletePayloads).toHaveLength(1)
    expect(state.deletePayloads[0]).toEqual({ id: conn.id })
    expect(Object.keys(state.deletePayloads[0] as object).sort()).toEqual(['id'])

    // 6. Garante que NÃO houve rollback (linha continua removida antes do retry)
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0)
    log('no-rollback-pre-retry')

    // 7. Clique em "Tentar novamente"
    await retryBtn.click()
    log('retry-clicked')

    // 8. Edge é chamada exatamente +1 vez
    await expect
      .poll(() => state.deleteCalls, {
        timeout: 8_000,
        intervals: [200, 400, 800],
        message: 'Esperando deleteCalls === 2 após retry',
      })
      .toBe(2)
    log('edge-second-call', { deleteCalls: state.deleteCalls })

    // 9. Payload da 2ª chamada: também { id }, sem campos extras
    expect(state.deletePayloads).toHaveLength(2)
    expect(state.deletePayloads[1]).toEqual({ id: conn.id })
    expect(Object.keys(state.deletePayloads[1] as object).sort()).toEqual(['id'])

    // 10. Toast de erro inicial é SUBSTITUÍDO — não há mais "Falha ao remover"
    //     visível nem botão "Tentar novamente" (mesma toast id reutilizada).
    await expect(toastByText(page, /falha ao remover/i)).toHaveCount(0, { timeout: 5_000 })
    await expect(toaster.getByRole('button', { name: /tentar novamente/i })).toHaveCount(0)
    await snapToasts('after-retry-success')
    log('error-toast-replaced-and-retry-button-gone')

    // 11. Toast de sucesso final visível
    await expect(toastByText(page, /conexão removida/i).first()).toBeVisible({ timeout: 5_000 })

    // 12. Nenhuma chamada extra após o commit do retry
    await page.waitForTimeout(1_500)
    expect(state.deleteCalls).toBe(2)

    // 13. Linha permanece removida (sem rollback em todo o fluxo)
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0)
    log('no-rollback-post-retry')

    report.deleteCalls = state.deleteCalls
    report.payloads = state.deletePayloads
    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
