import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * E2E adicional: /connectors/:slug/about
 *  - Sessão expirada → redirect para /auth (com ?redirect=...)
 *  - Após relogin, breadcrumb mantém sync com back/forward
 *  - Troca rápida entre múltiplos slugs (github → stripe → vercel)
 *  - A11y: aria-current="page" e role correto
 *  - Gera relatório JSON em test-results/breadcrumb-report.json
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const SLUGS = (process.env.BREADCRUMB_SLUGS ?? 'github,stripe,vercel').split(',').map((s) => s.trim()).filter(Boolean)

type ReportEntry = {
  step: string
  slug: string
  url: string
  currentText: string | null
  panelHref: string | null
  hubHref: string | null
  ariaCurrentOk: boolean
  ts: string
}
const report: ReportEntry[] = []

function writeReport() {
  const path = 'test-results/breadcrumb-report.json'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), entries: report }, null, 2))
}

async function login(page: Page) {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
  await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
  await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
}

async function expireSession(page: Page) {
  // Limpa storage de auth do Supabase (mantém o resto) e cookies
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
      .forEach((k) => localStorage.removeItem(k))
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
      .forEach((k) => sessionStorage.removeItem(k))
  })
  await page.context().clearCookies()
}

async function snapshotBreadcrumb(page: Page, step: string, slug: string): Promise<ReportEntry> {
  const region = page.getByTestId('connector-breadcrumb-region')
  await expect(region).toBeVisible()
  const current = region.getByTestId('breadcrumb-current')
  const hub = region.getByTestId('breadcrumb-hub')
  const panel = region.getByTestId('breadcrumb-panel')

  const currentText = (await current.textContent())?.trim() ?? null
  const ariaCurrent = await current.getAttribute('aria-current')
  const role = await current.getAttribute('role')
  const hubHref = await hub.getAttribute('href')
  const panelHref = await panel.getAttribute('href')

  const entry: ReportEntry = {
    step,
    slug,
    url: page.url(),
    currentText,
    panelHref,
    hubHref,
    ariaCurrentOk: ariaCurrent === 'page' && role === 'link',
    ts: new Date().toISOString(),
  }
  report.push(entry)
  return entry
}

async function assertBreadcrumbForSlug(page: Page, step: string, slug: string) {
  const entry = await snapshotBreadcrumb(page, step, slug)
  expect(entry.url).toMatch(new RegExp(`/connectors/${slug}/about(?:\\?|$|#)`))
  expect(entry.hubHref).toBe('/connectors')
  expect(entry.panelHref).toBe(`/connectors/${slug}`)
  expect(entry.currentText).toMatch(/sobre/i)
  expect(entry.ariaCurrentOk).toBe(true)
}

test.describe('ConnectorAboutPage — breadcrumb com sessão expirada + troca rápida de slugs', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'TEST_EMAIL e TEST_PASSWORD são obrigatórios')
  test.skip(SLUGS.length < 2, 'Pelo menos 2 slugs são necessários (BREADCRUMB_SLUGS)')

  test.afterAll(() => writeReport())

  test('expira sessão, faz relogin e mantém breadcrumb sincronizado em back/forward + slug switch', async ({ page }) => {
    const [a, b, c = b] = SLUGS

    // 1) Login inicial e baseline
    await page.context().clearCookies()
    await login(page)
    await page.goto(`/connectors/${a}/about`)
    await assertBreadcrumbForSlug(page, 'baseline', a)

    // 2) Expira sessão e tenta abrir uma rota protegida
    await expireSession(page)
    await page.goto(`/connectors/${b}/about`)
    await page.waitForURL(/\/auth(\?|$)/, { timeout: 15_000 })
    const redirected = new URL(page.url())
    expect(redirected.searchParams.get('redirect') ?? '').toContain(`/connectors/${b}/about`)
    report.push({
      step: 'session-expired-redirect',
      slug: b,
      url: page.url(),
      currentText: null,
      panelHref: null,
      hubHref: null,
      ariaCurrentOk: false,
      ts: new Date().toISOString(),
    })

    // 3) Relogin — deve voltar para o /about preservado
    await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
    await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
    await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
    await page.waitForURL(new RegExp(`/connectors/${b}/about`), { timeout: 20_000 })
    await assertBreadcrumbForSlug(page, 'post-relogin', b)

    // 4) Troca rápida de slugs: b → c → a (sem esperar entre navegações além do waitForURL)
    await page.goto(`/connectors/${c}/about`)
    await page.waitForURL(new RegExp(`/connectors/${c}/about`))
    await assertBreadcrumbForSlug(page, 'rapid-switch-c', c)

    await page.goto(`/connectors/${a}/about`)
    await page.waitForURL(new RegExp(`/connectors/${a}/about`))
    await assertBreadcrumbForSlug(page, 'rapid-switch-a', a)

    // 5) Back/forward através do histórico construído
    await page.goBack() // → c
    await page.waitForURL(new RegExp(`/connectors/${c}/about`))
    await assertBreadcrumbForSlug(page, 'back-to-c', c)

    await page.goBack() // → b (post-relogin)
    await page.waitForURL(new RegExp(`/connectors/${b}/about`))
    await assertBreadcrumbForSlug(page, 'back-to-b', b)

    await page.goForward() // → c
    await page.waitForURL(new RegExp(`/connectors/${c}/about`))
    await assertBreadcrumbForSlug(page, 'forward-to-c', c)

    await page.goForward() // → a
    await page.waitForURL(new RegExp(`/connectors/${a}/about`))
    await assertBreadcrumbForSlug(page, 'forward-to-a', a)

    // 6) A11y: apenas UM aria-current="page" e nenhum dos links ativos tem aria-current
    const currents = page.locator('[data-testid="connector-breadcrumb"] [aria-current="page"]')
    await expect(currents).toHaveCount(1)
    const hubAriaCurrent = await page.getByTestId('breadcrumb-hub').getAttribute('aria-current')
    const panelAriaCurrent = await page.getByTestId('breadcrumb-panel').getAttribute('aria-current')
    expect(hubAriaCurrent).toBeNull()
    expect(panelAriaCurrent).toBeNull()
  })
})
