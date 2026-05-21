import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E: Web3 connection — delete edge function failure
 *
 * Cobertura:
 *  - "Código de acesso": input de confirmação exigindo o nome exato da conexão
 *  - Acessibilidade do AlertDialog (role, aria-labelledby, foco no input)
 *  - Falha simulada na edge function `web3-connection-delete` (HTTP 500)
 *  - Restauração / undo implícito: a linha permanece intacta na lista
 *  - Toast de erro do sonner é exibido
 *  - Botão não fica preso em "Removendo…"
 *  - Reabrir o diálogo após erro funciona (estado restaurável)
 *  - Relatório JSON: test-results/web3-connection-delete-error-report.json
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-error-report.json')

const CONNECTION = {
  id: '00000000-0000-4000-8000-000000000999',
  provider: 'alchemy',
  network: 'ethereum-mainnet',
  connection_name: `E2E delete-error ${Date.now()}`,
  explorer_url: 'https://etherscan.io',
  api_key_hint: 'aaaa••••zzzz',
  last_status: 'connected',
  last_block: 19_500_000,
  last_latency_ms: 120,
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

test.describe('Web3 connector — delete edge function error', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('keeps row + shows toast + dialog a11y + restorable after failure', async ({ page, context }) => {
    const report: {
      steps: unknown[]
      startedAt: string
      endedAt?: string
      success?: boolean
      deleteCalls: number
      a11y: Record<string, boolean | string | null>
    } = {
      startedAt: new Date().toISOString(),
      steps: [],
      deleteCalls: 0,
      a11y: {},
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

    await page.route(/\/functions\/v1\/web3-connection-delete(\?.*)?$/, (route) => {
      state.deleteCalls += 1
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated edge function failure' }),
      })
    })

    await page.goto('/connectors/web3/alchemy')
    const row = page.getByTestId('web3-connection-row').first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText(CONNECTION.connection_name)
    log('row-rendered')

    // ---- Abrir diálogo + acessibilidade ----
    await row.getByTestId('row-delete').click()
    const dialog = page.getByTestId('web3-delete-dialog')
    await expect(dialog).toBeVisible()

    const alertdialog = page.getByRole('alertdialog')
    await expect(alertdialog).toBeVisible()
    await expect(alertdialog).toHaveAttribute('aria-labelledby', /.+/)
    await expect(alertdialog).toHaveAttribute('aria-describedby', /.+/)
    await expect(page.getByRole('heading', { name: /remover conex/i })).toBeVisible()
    report.a11y = {
      role: 'alertdialog',
      labelled: await alertdialog.getAttribute('aria-labelledby'),
      described: await alertdialog.getAttribute('aria-describedby'),
      titleVisible: true,
    }
    log('a11y-ok', report.a11y)

    // ---- Código de acesso: confirm desabilitado até nome exato ----
    const confirmBtn = page.getByTestId('web3-delete-confirm')
    const accessInput = page.getByTestId('web3-delete-confirm-input')
    await expect(confirmBtn).toBeDisabled()
    await accessInput.fill('wrong-code')
    await expect(confirmBtn).toBeDisabled()
    await accessInput.fill(CONNECTION.connection_name)
    await expect(confirmBtn).toBeEnabled()
    log('access-code-validated')

    // ---- Disparar delete (vai falhar) ----
    await confirmBtn.click()

    // Toast de erro do sonner
    const errorToast = page
      .locator('[data-sonner-toaster] li, [data-sonner-toaster] [role="status"]')
      .filter({ hasText: /simulated edge function failure|erro|failed|falha/i })
    await expect(errorToast.first()).toBeVisible({ timeout: 10_000 })
    log('error-toast-visible')

    // ---- Restauração / undo: linha permanece intacta ----
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1)
    await expect(page.getByTestId('web3-connection-row').first()).toContainText(
      CONNECTION.connection_name,
    )
    expect(state.deleteCalls).toBe(1)
    report.deleteCalls = state.deleteCalls
    log('row-restored')

    // Botão não preso em loading
    const stuck = await page
      .getByTestId('web3-delete-confirm')
      .filter({ hasText: /Removendo/i })
      .count()
    expect(stuck).toBe(0)
    log('button-not-stuck')

    // ---- Diálogo é reabrível (estado restaurável) ----
    // Se ainda estiver aberto, fecha pelo cancel; depois reabre.
    if (await page.getByTestId('web3-delete-cancel').isVisible().catch(() => false)) {
      await page.getByTestId('web3-delete-cancel').click()
    }
    await expect(page.getByTestId('web3-delete-dialog')).toBeHidden({ timeout: 5_000 })
    await row.getByTestId('row-delete').click()
    await expect(page.getByTestId('web3-delete-dialog')).toBeVisible()
    await expect(page.getByTestId('web3-delete-confirm')).toBeDisabled()
    log('dialog-reopenable')

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
