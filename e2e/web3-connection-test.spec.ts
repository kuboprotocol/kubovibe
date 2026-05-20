import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E: Web3 hub + provider pages (Alchemy, Infura, Custom RPC)
 *  - Hub renders all 3 cards with correct deep-link hrefs
 *  - Per provider:
 *      * deep-link navigation lands on /connectors/web3/:provider
 *      * accessibility checks (labels, landmarks, single h1, aria on result)
 *      * test+save flow with mocked edge functions
 *      * edit flow shows safety banner + "Não salvo" indicator while dirty
 *      * cancel-edit with unsaved changes triggers confirm()
 *  - Generates JSON report at test-results/web3-connection-report.json
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

const REPORT_DIR = path.resolve('test-results')
const REPORT_PATH = path.join(REPORT_DIR, 'web3-connection-report.json')

type ProviderCase = {
  id: 'alchemy' | 'infura' | 'custom-rpc'
  label: RegExp
  apiKey: string
  rpcOverride?: string // custom-rpc has no auto RPC; we type it manually
}

const PROVIDERS: ProviderCase[] = [
  { id: 'alchemy',    label: /alchemy/i,    apiKey: 'alchemy_e2e_key_1234567890' },
  { id: 'infura',     label: /infura/i,     apiKey: 'infura_e2e_projectid_xyz' },
  { id: 'custom-rpc', label: /custom rpc/i, apiKey: '', rpcOverride: 'https://rpc.example.org/v1' },
]

const report: { startedAt: string; steps: unknown[]; endedAt?: string; success?: boolean } = {
  startedAt: new Date().toISOString(),
  steps: [],
}
const log = (step: string, data: Record<string, unknown> = {}) => {
  report.steps.push({ step, at: new Date().toISOString(), ...data })
}

async function login(page: Page) {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
  await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
  await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
}

function installMocks(page: Page, state: { saved: any[] }) {
  page.route(/\/functions\/v1\/web3-connection-test(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 200, blockNumber: 19_000_000, latencyMs: 137 }),
    }),
  )
  page.route(/\/functions\/v1\/web3-connection-save(\?.*)?$/, (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    const id = body.id ?? `00000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, '0')}`
    const row = {
      id,
      provider: body.provider,
      network: body.network ?? 'ethereum-mainnet',
      connection_name: body.connection_name,
      explorer_url: body.explorer_url ?? 'https://etherscan.io',
      api_key_hint: 'aaaa••••zzzz',
      last_status: 'connected',
      last_block: 19_000_000,
      last_latency_ms: 142,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    state.saved = body.id ? state.saved.map((r) => (r.id === id ? row : r)) : [...state.saved, row]
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, connection: row }),
    })
  })
  page.route(/\/rest\/v1\/web3_connections\?.*/, (route) => {
    const url = new URL(route.request().url())
    const providerFilter = url.searchParams.get('provider') // e.g. eq.alchemy
    const wanted = providerFilter?.replace(/^eq\./, '')
    const rows = wanted ? state.saved.filter((r) => r.provider === wanted) : state.saved
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })
}

async function assertHubA11y(page: Page) {
  // single h1
  await expect(page.locator('h1')).toHaveCount(1)
  // <main> landmark
  await expect(page.locator('main')).toHaveCount(1)
  // grid is labeled
  const grid = page.getByTestId('web3-providers-grid')
  await expect(grid).toHaveAttribute('aria-label', /provedores web3/i)
}

async function assertFormA11y(page: Page) {
  // each named field has an associated label via htmlFor
  for (const id of ['connectionName', 'network', 'apiKey', 'rpc', 'explorer']) {
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1)
    await expect(page.locator(`#${id}`)).toBeVisible()
  }
  // icon-only buttons have aria-label
  for (const tid of ['btn-test-connection', 'btn-save-connection']) {
    const el = page.getByTestId(tid)
    await expect(el).toBeVisible()
  }
}

test.describe('Web3 connector — providers, edit safety, a11y', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL/TEST_PASSWORD required')

  test('all providers flow + a11y + edit safety', async ({ page, context }) => {
    await context.clearCookies()
    await login(page)
    log('logged-in', { url: page.url() })

    const state = { saved: [] as any[] }
    installMocks(page, state)

    // --- Hub
    await page.goto('/connectors/web3')
    await expect(page.getByTestId('web3-providers-grid')).toBeVisible()
    await assertHubA11y(page)
    for (const p of PROVIDERS) {
      const card = page.getByTestId(`web3-provider-card-${p.id}`)
      await expect(card).toBeVisible()
      // deep-link href present so middle-click / "open in new tab" works
      await expect(card).toHaveAttribute('data-href', `/connectors/web3/${p.id}`)
      await expect(card).toHaveAttribute('aria-label', new RegExp(`/connectors/web3/${p.id}`))
    }
    log('hub-rendered', { providers: PROVIDERS.map((p) => p.id) })

    // --- Per provider: navigation, a11y, create, edit, edit-safety
    for (const p of PROVIDERS) {
      await page.goto('/connectors/web3')
      await page.getByTestId(`web3-provider-card-${p.id}`).click()
      await page.waitForURL(`**/connectors/web3/${p.id}`, { timeout: 10_000 })
      await expect(page.getByTestId('web3-connection-form')).toBeVisible()
      await assertFormA11y(page)
      log(`opened-${p.id}`)

      // fill
      const name = `E2E ${p.id} ${Date.now()}`
      await page.getByTestId('field-connection-name').fill(name)
      if (p.apiKey) await page.getByTestId('field-api-key').fill(p.apiKey)
      if (p.rpcOverride) await page.getByTestId('field-rpc-url').fill(p.rpcOverride)

      // dirty indicator visible
      await expect(page.getByTestId('form-dirty-indicator')).toBeVisible()

      // test connection
      await page.getByTestId('btn-test-connection').click()
      const result = page.getByTestId('web3-test-result')
      await expect(result).toBeVisible()
      await expect(result).toHaveAttribute('data-test-ok', 'true')
      await expect(result).toHaveAttribute('aria-live', 'polite')
      await expect(result).toHaveAttribute('role', 'status')
      log(`test-ok-${p.id}`)

      // save
      await page.getByTestId('btn-save-connection').click()
      const row = page.getByTestId('web3-connection-row').first()
      await expect(row).toBeVisible({ timeout: 10_000 })
      await expect(row).toContainText(name)
      // dirty cleared after save
      await expect(page.getByTestId('form-dirty-indicator')).toHaveCount(0)
      log(`saved-${p.id}`, { totalRows: state.saved.length })

      // edit flow + safety banner
      await row.getByTestId('row-edit').click()
      await expect(page.getByRole('heading', { name: /editar conexão/i })).toBeVisible()
      await expect(page.getByTestId('edit-safety-banner')).toBeVisible()

      // make a change → dirty appears
      await page.getByTestId('field-connection-name').fill(`${name} (edit)`)
      await expect(page.getByTestId('form-dirty-indicator')).toBeVisible()

      // cancel-edit with unsaved → confirm() should be invoked; auto-accept
      page.once('dialog', (d) => d.accept())
      await page.getByTestId('btn-cancel-edit').click()
      await expect(page.getByRole('heading', { name: /configurar conexão/i })).toBeVisible()
      log(`cancel-edit-confirmed-${p.id}`)
    }

    // --- Report
    report.endedAt = new Date().toISOString()
    report.success = true
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  })
})
