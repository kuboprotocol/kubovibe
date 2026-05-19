import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E: /connectors/web3 hub + provider page (Alchemy)
 *  - Renders 3 provider cards (Alchemy, Infura, Custom RPC)
 *  - Click Alchemy → lands on /connectors/web3/alchemy
 *  - Mocks edge functions:
 *      * web3-connection-test → returns ok block 19_000_000
 *      * web3-connection-save → returns created connection
 *  - Fills form, clicks "Testar conexão", asserts success banner
 *  - Saves, asserts the new connection row appears
 *  - Clicks Edit on the row, asserts form switches to "Editar conexão"
 *  - Generates JSON report under test-results/web3-connection-report.json
 *
 * Requires TEST_EMAIL/TEST_PASSWORD for an authenticated session.
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-report.json')

const NOW = Date.now()
const MOCK_CONNECTION = {
  id: '00000000-0000-4000-8000-000000000001',
  provider: 'alchemy',
  network: 'ethereum-mainnet',
  connection_name: `E2E ${NOW}`,
  explorer_url: 'https://etherscan.io',
  api_key_hint: 'aaaa••••zzzz',
  last_status: 'connected' as const,
  last_block: 19_000_000,
  last_latency_ms: 142,
  last_checked_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

test.describe('Web3 connector — hub, test, edit, report', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('hub renders providers, test+save+edit flows work, report generated', async ({ page, context }) => {
    const report: Record<string, unknown> = { startedAt: new Date().toISOString(), steps: [] }
    const log = (step: string, data: Record<string, unknown> = {}) => {
      ;(report.steps as unknown[]).push({ step, at: new Date().toISOString(), ...data })
    }

    await context.clearCookies()

    // --- 1) Login
    await page.goto('/auth')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
    await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
    await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
    log('logged-in', { url: page.url() })

    // --- 2) Mock Supabase Edge Functions
    let savedRows: typeof MOCK_CONNECTION[] = []

    await page.route(/\/functions\/v1\/web3-connection-test(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, status: 200, blockNumber: 19_000_000, latencyMs: 137 }),
      })
    })

    await page.route(/\/functions\/v1\/web3-connection-save(\?.*)?$/, async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      const isEdit = !!body.id
      const updated = {
        ...MOCK_CONNECTION,
        id: body.id ?? MOCK_CONNECTION.id,
        connection_name: body.connection_name ?? MOCK_CONNECTION.connection_name,
        network: body.network ?? MOCK_CONNECTION.network,
        explorer_url: body.explorer_url ?? MOCK_CONNECTION.explorer_url,
        updated_at: new Date().toISOString(),
      }
      savedRows = isEdit ? savedRows.map((r) => (r.id === updated.id ? updated : r)) : [...savedRows, updated]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, connection: updated }),
      })
    })

    // The list reads directly from REST `web3_connections`. Mock that too.
    await page.route(/\/rest\/v1\/web3_connections\?.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(savedRows),
      })
    })

    // --- 3) Web3 hub
    await page.goto('/connectors/web3')
    await expect(page.getByTestId('web3-providers-grid')).toBeVisible()
    for (const id of ['alchemy', 'infura', 'custom-rpc']) {
      await expect(page.getByTestId(`web3-provider-card-${id}`)).toBeVisible()
    }
    log('hub-rendered', { providers: ['alchemy', 'infura', 'custom-rpc'] })

    // --- 4) Open Alchemy
    await page.getByTestId('web3-provider-card-alchemy').click()
    await page.waitForURL('**/connectors/web3/alchemy', { timeout: 10_000 })
    await expect(page.getByTestId('web3-connection-form')).toBeVisible()
    log('opened-alchemy-page')

    // --- 5) Fill + Test
    await page.getByTestId('field-connection-name').fill(MOCK_CONNECTION.connection_name)
    await page.getByTestId('field-api-key').fill('alchemy_e2e_key_1234567890')
    await page.getByTestId('btn-test-connection').click()
    const result = page.getByTestId('web3-test-result')
    await expect(result).toBeVisible()
    await expect(result).toHaveAttribute('data-test-ok', 'true')
    log('test-connection-ok', { ariaLive: await result.getAttribute('aria-live') })

    // --- 6) Save
    await page.getByTestId('btn-save-connection').click()
    const row = page.getByTestId('web3-connection-row').first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toContainText(MOCK_CONNECTION.connection_name)
    log('connection-saved', { rows: savedRows.length })

    // --- 7) Edit
    await row.getByTestId('row-edit').click()
    await expect(page.getByRole('heading', { name: /editar conexão/i })).toBeVisible()
    await page.getByTestId('field-connection-name').fill(`${MOCK_CONNECTION.connection_name} (edit)`)
    await page.getByTestId('field-api-key').fill('alchemy_e2e_key_updated_1234')
    await page.getByTestId('btn-save-connection').click()
    await expect(page.getByTestId('web3-connection-row').first()).toContainText('(edit)', { timeout: 10_000 })
    log('connection-edited')

    // --- 8) Report
    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
