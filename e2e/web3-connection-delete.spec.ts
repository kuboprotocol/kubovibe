import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E: Web3 connection — delete-confirmation guard
 *  - Seeds a mocked connection
 *  - Opens the delete dialog and asserts the guard:
 *      * dialog visible with role/title
 *      * confirm button disabled until user types the exact connection name
 *      * Cancel closes dialog without calling the edge function
 *      * Wrong name keeps confirm disabled and does not call edge function
 *      * Correct name enables confirm; click triggers web3-connection-delete
 *      * After success, the row disappears
 *  - Writes report to test-results/web3-connection-delete-report.json
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-delete-report.json')

const CONNECTION = {
  id: '00000000-0000-4000-8000-000000000777',
  provider: 'alchemy',
  network: 'ethereum-mainnet',
  connection_name: `E2E delete ${Date.now()}`,
  explorer_url: 'https://etherscan.io',
  api_key_hint: 'aaaa••••zzzz',
  last_status: 'connected',
  last_block: 19_000_000,
  last_latency_ms: 142,
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

test.describe('Web3 connector — delete confirmation guard', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('requires typing connection name before deleting', async ({ page, context }) => {
    const report: { steps: unknown[]; startedAt: string; endedAt?: string; success?: boolean } = {
      startedAt: new Date().toISOString(),
      steps: [],
    }
    const log = (step: string, data: Record<string, unknown> = {}) =>
      report.steps.push({ step, at: new Date().toISOString(), ...data })

    await context.clearCookies()
    await login(page)

    // Mock the REST list to return our seeded row, plus track delete calls
    const state = { rows: [CONNECTION], deleteCalls: 0 }

    await page.route(/\/rest\/v1\/web3_connections\?.*/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.rows) }),
    )
    await page.route(/\/functions\/v1\/web3-connection-delete(\?.*)?$/, (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      state.deleteCalls += 1
      state.rows = state.rows.filter((r) => r.id !== body.id)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: body.id }),
      })
    })

    // Page
    await page.goto('/connectors/web3/alchemy')
    const row = page.getByTestId('web3-connection-row').first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText(CONNECTION.connection_name)
    log('row-rendered')

    // 1) Cancel path: open dialog → cancel → no delete call
    await row.getByTestId('row-delete').click()
    const dialog = page.getByTestId('web3-delete-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('alertdialog')).toBeVisible().catch(async () => {
      // shadcn AlertDialogContent has role=alertdialog on inner element; fall back
      await expect(page.getByRole('alertdialog')).toBeVisible()
    })
    await expect(page.getByTestId('web3-delete-confirm')).toBeDisabled()
    await page.getByTestId('web3-delete-cancel').click()
    await expect(dialog).toBeHidden()
    expect(state.deleteCalls).toBe(0)
    log('cancel-ok')

    // 2) Wrong-name path: dialog opens, typing wrong text leaves confirm disabled
    await row.getByTestId('row-delete').click()
    await expect(page.getByTestId('web3-delete-dialog')).toBeVisible()
    await page.getByTestId('web3-delete-confirm-input').fill('not the right name')
    await expect(page.getByTestId('web3-delete-confirm')).toBeDisabled()
    expect(state.deleteCalls).toBe(0)
    log('wrong-name-blocked')

    // 3) Correct-name path: typing exact name enables confirm; click deletes
    await page.getByTestId('web3-delete-confirm-input').fill(CONNECTION.connection_name)
    const confirmBtn = page.getByTestId('web3-delete-confirm')
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()
    await expect(page.getByTestId('web3-connection-row')).toHaveCount(0, { timeout: 10_000 })
    expect(state.deleteCalls).toBe(1)
    log('delete-confirmed', { deleteCalls: state.deleteCalls })

    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
