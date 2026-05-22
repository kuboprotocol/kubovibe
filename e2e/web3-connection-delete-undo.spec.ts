import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E: Web3 connection — undo da deleção otimista
 *
 * Cenário coberto:
 *  1. Usuário confirma o delete guard (token nome#provider:idprefix)
 *  2. Linha some otimisticamente da lista
 *  3. Toast com botão "Desfazer" aparece (estado inicial)
 *  4. Usuário clica "Desfazer" antes da janela expirar
 *     → linha é restaurada na lista
 *     → edge function `web3-connection-delete` NUNCA é chamada (timer cancelado)
 *     → toast inicial é substituído/dispensado e um novo toast "Remoção desfeita" aparece
 *  5. Cobertura paralela: configuramos a edge para falhar (500); se o undo
 *     não cancelasse o timer, veríamos `deleteCalls === 1` e um toast de erro.
 *     Aqui validamos o contrário (deleteCalls === 0, sem toast de erro).
 *
 * Relatório: test-results/web3-connection-delete-undo-report.json
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-undo-report.json')

const CONNECTION = {
  id: '00000000-0000-4000-8000-0000000000aa',
  provider: 'alchemy',
  network: 'ethereum-mainnet',
  connection_name: `E2E undo ${Date.now()}`,
  explorer_url: 'https://etherscan.io',
  api_key_hint: 'bbbb••••yyyy',
  last_status: 'connected',
  last_block: 19_700_000,
  last_latency_ms: 110,
  last_checked_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

async function login(page: Page) {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
  await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
  await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
}

test.describe('Web3 connector — undo restaura linha após delete otimista', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('clicar Desfazer restaura a linha e atualiza estado do toast', async ({ page, context }) => {
    const report: {
      steps: unknown[]
      startedAt: string
      endedAt?: string
      success?: boolean
      deleteCalls: number
      toastStates: string[]
    } = {
      startedAt: new Date().toISOString(),
      steps: [],
      deleteCalls: 0,
      toastStates: [],
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)

    const state = { rows: [CONNECTION], deleteCalls: 0 }

    await page.route(/\/rest\/v1\/web3_connections\?.*/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.rows),
      }),
    )

    // Falha 500 — só seria atingida se o undo NÃO cancelasse o timer.
    await page.route(/\/functions\/v1\/web3-connection-delete(\?.*)?$/, (route) => {
      state.deleteCalls += 1
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'undo should have cancelled this call' }),
      })
    })

    await page.goto('/connectors/web3/alchemy')
    const row = page.getByTestId('web3-connection-row').first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText(CONNECTION.connection_name)
    log('row-rendered')

    // Abre diálogo
    await row.getByTestId('row-delete').click()
    await expect(page.getByTestId('web3-delete-dialog')).toBeVisible()

    // Lê e preenche o token completo
    const requiredToken = await page.getByTestId('web3-delete-confirm-token').innerText()
    expect(requiredToken).toBe(
      `${CONNECTION.connection_name}#${CONNECTION.provider}:${CONNECTION.id.slice(0, 8)}`,
    )
    await page.getByTestId('web3-delete-confirm-input').fill(requiredToken)
    const confirmBtn = page.getByTestId('web3-delete-confirm')
    await expect(confirmBtn).toBeEnabled()
    log('access-token-validated')

    // Confirma — dispara optimistic remove + toast com Undo
    await confirmBtn.click()
    await expect(page.getByTestId('web3-delete-dialog')).toBeHidden({ timeout: 5_000 })

    // Linha some otimisticamente
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 5_000 })
    log('row-optimistically-removed')

    // Toast inicial com botão "Desfazer"
    const toaster = page.locator('[data-sonner-toaster]')
    const initialToast = toaster
      .locator('li, [role="status"]')
      .filter({ hasText: /conex(ã|a)o removida|desfazer/i })
    await expect(initialToast.first()).toBeVisible({ timeout: 5_000 })
    report.toastStates.push('initial:removed-with-undo')
    log('initial-toast-visible')

    const undoBtn = toaster.getByRole('button', { name: /desfazer/i }).first()
    await expect(undoBtn).toBeVisible()

    // Clica Desfazer ANTES da janela (6s) expirar
    await undoBtn.click()
    log('undo-clicked')

    // Linha é restaurada
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1, { timeout: 5_000 })
    await expect(page.getByTestId('web3-connection-row').first()).toContainText(
      CONNECTION.connection_name,
    )
    log('row-restored')

    // Novo toast de confirmação "Remoção desfeita"
    const undoneToast = toaster
      .locator('li, [role="status"]')
      .filter({ hasText: /remo(ç|c)(ã|a)o desfeita/i })
    await expect(undoneToast.first()).toBeVisible({ timeout: 5_000 })
    report.toastStates.push('after-undo:undone-confirmation')
    log('undone-toast-visible')

    // Garante que toast original com botão Desfazer não está mais ativo
    await expect(toaster.getByRole('button', { name: /desfazer/i })).toHaveCount(0, {
      timeout: 5_000,
    })
    log('original-undo-toast-dismissed')

    // Espera ALÉM da janela de 6s para garantir que o timer foi cancelado
    await page.waitForTimeout(7_000)
    expect(state.deleteCalls).toBe(0)
    report.deleteCalls = state.deleteCalls
    log('edge-never-called', { deleteCalls: state.deleteCalls })

    // Nenhum toast de erro deve aparecer
    const errorToast = toaster
      .locator('li, [role="status"]')
      .filter({ hasText: /undo should have cancelled|erro|falha ao remover/i })
    expect(await errorToast.count()).toBe(0)
    log('no-error-toast')

    // Linha continua viva
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1)

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
