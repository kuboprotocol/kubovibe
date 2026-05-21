import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E: Web3 connection — delete edge function failure
 *  - Mocks web3-connection-delete to return 500
 *  - Confirms guard flow (typing exact name → confirm enabled)
 *  - After click, asserts:
 *      * Row stays in the list (no optimistic removal)
 *      * Error toast (sonner) is shown
 *      * Dialog closes / confirm button is no longer in a loading state
 *  - Writes report to test-results/web3-connection-delete-error-report.json
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

  test('keeps row and shows error toast when delete edge function fails', async ({ page, context }) => {
    const report: {
      steps: unknown[]
      startedAt: string
      endedAt?: string
      success?: boolean
      deleteCalls: number
    } = {
      startedAt: new Date().toISOString(),
      steps: [],
      deleteCalls: 0,
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)

    const state = { rows: [CONNECTION], deleteCalls: 0 }

    // REST list always returns the seeded row (deletion is server-side; we simulate failure
    // so the row must remain in the table even after subsequent reloads).
    await page.route(/\/rest\/v1\/web3_connections\?.*/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.rows),
      }),
    )

    // Force the delete edge function to fail.
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

    // Open dialog and pass the typed-name guard
    await row.getByTestId('row-delete').click()
    const dialog = page.getByTestId('web3-delete-dialog')
    await expect(dialog).toBeVisible()
    await page.getByTestId('web3-delete-confirm-input').fill(CONNECTION.connection_name)
    const confirmBtn = page.getByTestId('web3-delete-confirm')
    await expect(confirmBtn).toBeEnabled()
    log('guard-passed')

    // Trigger the failing delete
    await confirmBtn.click()

    // Toast assertion (sonner renders into [data-sonner-toaster])
    const errorToast = page
      .locator('[data-sonner-toaster] [data-type="error"], [data-sonner-toaster] li[role="status"]')
      .filter({ hasText: /simulated edge function failure|erro|failed|falha/i })
    await expect(errorToast.first()).toBeVisible({ timeout: 10_000 })
    log('error-toast-visible')

    // Row must NOT be removed (no optimistic delete on failure)
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(1)
    await expect(page.getByTestId('web3-connection-row').first()).toContainText(
      CONNECTION.connection_name,
    )
    log('row-preserved')

    // Edge function was called exactly once
    expect(state.deleteCalls).toBe(1)
    report.deleteCalls = state.deleteCalls

    // Confirm button should leave loading state (either dialog still open with idle button
    // or dialog closed). Either way, it must not be stuck in "Removendo…".
    const stillLoading = await page
      .getByTestId('web3-delete-confirm')
      .filter({ hasText: /Removendo/i })
      .count()
    expect(stillLoading).toBe(0)
    log('button-not-stuck')

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
