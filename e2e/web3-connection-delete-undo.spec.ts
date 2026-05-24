import { test, expect, type Locator } from '@playwright/test'
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
 * E2E: Web3 connection — undo da deleção otimista.
 *
 * Contrato validado:
 *  1. Confirm via token completo → linha some otimisticamente.
 *  2. Toast inicial com botão "Desfazer" é exibido (snapshot do nó).
 *  3. Clique em "Desfazer" ANTES da janela (UNDO_WINDOW_MS) expirar:
 *     - cancela o timer (edge `web3-connection-delete` NUNCA é chamada)
 *     - restaura a linha imediatamente
 *     - dispensa o toast inicial: o MESMO nó capturado anteriormente é
 *       removido do DOM (não basta o botão "Desfazer" sumir — exigimos
 *       detach do elemento, evitando falso positivo onde sonner reusa
 *       o container e troca conteúdo).
 *     - emite novo toast "Remoção desfeita".
 *  4. Após UNDO_WINDOW_MS + buffer, `deleteCalls` continua 0 e nenhum
 *     toast de erro aparece (validado com expect.poll, sem sleep cego).
 *
 * Relatório: test-results/web3-connection-delete-undo-report.json
 */

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-undo-report.json')

interface ToastSnapshot {
  at: string
  phase: string
  texts: string[]
  undoButtonCount: number
}

test.describe('Web3 connector — undo restaura linha após delete otimista', () => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('clicar Desfazer restaura a linha e descarta o toast original', async ({ page, context }) => {
    const report: {
      steps: unknown[]
      startedAt: string
      endedAt?: string
      success?: boolean
      deleteCalls: number
      toastStates: string[]
      toastSnapshots: ToastSnapshot[]
    } = {
      startedAt: new Date().toISOString(),
      steps: [],
      deleteCalls: 0,
      toastStates: [],
      toastSnapshots: [],
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    const snapshotToasts = async (phase: string): Promise<ToastSnapshot> => {
      const toaster = toasterLocator(page)
      const items = toaster.locator('li, [role="status"]')
      const texts = (await items.allInnerTexts()).map((t) => t.trim()).filter(Boolean)
      const undoButtonCount = await toaster.getByRole('button', { name: /desfazer/i }).count()
      const snap: ToastSnapshot = { at: new Date().toISOString(), phase, texts, undoButtonCount }
      report.toastSnapshots.push(snap)
      return snap
    }

    await context.clearCookies()
    await login(page)

    const conn = makeConnection({
      id: '00000000-0000-4000-8000-0000000000aa',
      connection_name: `E2E undo ${Date.now()}`,
    })

    // Edge configurada para FALHAR — se o undo não cancelar o timer, o teste
    // detecta: deleteCalls ficaria 1 e veríamos toast de erro.
    const state = await mockWeb3Backend(page, [conn], () => ({
      status: 500,
      body: { error: 'undo should have cancelled this call' },
    }))

    await page.goto('/connectors/web3/alchemy')
    const { trigger, confirmBtn, input } = await openDeleteDialog(page)
    log('dialog-open')

    const token = requiredDeleteToken(conn)
    await input.fill(token)
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()

    await expect(page.getByTestId('web3-delete-dialog')).toBeHidden({ timeout: 5_000 })
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 5_000 })
    log('row-optimistically-removed')

    // Toast inicial com Desfazer — capturamos o nó (handle) para depois
    // garantir que ele especificamente foi removido do DOM, sem confiar
    // só na ausência do texto.
    const initialToast = toastByText(page, /conex(ã|a)o removida|desfazer disponível/i).first()
    await expect(initialToast).toBeVisible({ timeout: 5_000 })
    const initialToastHandle = await initialToast.elementHandle()
    expect(initialToastHandle).not.toBeNull()
    report.toastStates.push('initial:removed-with-undo')
    await snapshotToasts('after-confirm')
    log('initial-toast-visible')

    const undoBtn: Locator = toasterLocator(page).getByRole('button', { name: /desfazer/i }).first()
    await expect(undoBtn).toBeVisible()

    // Clica Desfazer DENTRO da janela
    await undoBtn.click()
    log('undo-clicked')

    // Linha restaurada
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1, { timeout: 5_000 })
    await expect(page.getByTestId('web3-connection-row').first()).toContainText(conn.connection_name)
    log('row-restored')

    // Novo toast de confirmação
    await expect(
      toastByText(page, /remo(ç|c)(ã|a)o desfeita/i).first(),
    ).toBeVisible({ timeout: 5_000 })
    report.toastStates.push('after-undo:undone-confirmation')

    // ============================================================
    // Asserção anti-falso-positivo: o NÓ original do toast com Undo
    // precisa estar detached. Usamos expect.poll para tolerar o
    // fade-out do sonner sem sleep fixo.
    // ============================================================
    await expect
      .poll(
        async () => {
          if (!initialToastHandle) return 'detached'
          const stillAttached = await initialToastHandle.evaluate(
            (el) => el.isConnected && document.body.contains(el),
          ).catch(() => false)
          return stillAttached ? 'attached' : 'detached'
        },
        { timeout: 5_000, message: 'Toast inicial com Desfazer deveria ter sido removido do DOM' },
      )
      .toBe('detached')
    log('initial-toast-detached')

    // Adicionalmente, nenhum botão "Desfazer" deve permanecer no toaster
    await expect(
      toasterLocator(page).getByRole('button', { name: /desfazer/i }),
    ).toHaveCount(0, { timeout: 5_000 })
    await snapshotToasts('after-undo')
    log('undo-button-gone')

    // Foco volta para o trigger (acessibilidade do AlertDialog já fechado antes)
    await expect(trigger).toBeVisible()

    // Verifica que o timer foi cancelado: polling determinístico via helper.
    const { expectUndoTimerCancelled } = await import('./helpers/web3Connector')
    await expectUndoTimerCancelled(page, state)
    report.deleteCalls = state.deleteCalls
    log('edge-never-called', { deleteCalls: state.deleteCalls })

    // Nenhum toast de erro
    expect(await toastByText(page, /undo should have cancelled|erro|falha ao remover/i).count()).toBe(0)
    await snapshotToasts('after-window')
    log('no-error-toast')

    // Linha continua viva
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1)

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
