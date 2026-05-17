import { test, expect, type Page } from '@playwright/test'

/**
 * E2E: /connectors/:slug/about breadcrumbs stay in sync with the router
 * across browser back/forward navigation between different slugs.
 *
 * Scenario:
 *  1. Login, visit /connectors/github/about
 *  2. Navigate to /connectors/stripe/about
 *  3. page.goBack() → expect github breadcrumb (panel link → /connectors/github, "Sobre" current)
 *  4. page.goForward() → expect stripe breadcrumb (panel link → /connectors/stripe)
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

async function login(page: Page) {
  await page.context().clearCookies()
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
  await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
  await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
}

async function expectBreadcrumbForSlug(page: Page, slug: string) {
  const nav = page.getByRole('navigation', { name: /breadcrumb/i })
  await expect(nav).toBeVisible()

  // "Conectores" link → /connectors
  const hubLink = nav.getByRole('link', { name: /^conectores$/i })
  await expect(hubLink).toHaveAttribute('href', '/connectors')

  // "Painel do conector" link → /connectors/<current slug>
  const panelLink = nav.getByRole('link', { name: /painel do conector/i })
  await expect(panelLink).toHaveAttribute('href', `/connectors/${slug}`)

  // "Sobre" is the current page (BreadcrumbPage renders role="link" + aria-current="page")
  const current = nav.locator('[aria-current="page"]')
  await expect(current).toHaveText(/sobre/i)

  // URL also reflects the slug
  await expect(page).toHaveURL(new RegExp(`/connectors/${slug}/about(?:\\?|$)`))
}

test.describe('ConnectorAboutPage — breadcrumb stays in sync with back/forward', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('back/forward across two slugs keeps breadcrumb active state correct', async ({ page }) => {
    await login(page)

    // 1. github/about
    await page.goto('/connectors/github/about')
    await page.waitForURL(/\/connectors\/github\/about/, { timeout: 15_000 })
    await expectBreadcrumbForSlug(page, 'github')

    // 2. stripe/about (pushes new history entry)
    await page.goto('/connectors/stripe/about')
    await page.waitForURL(/\/connectors\/stripe\/about/, { timeout: 15_000 })
    await expectBreadcrumbForSlug(page, 'stripe')

    // 3. back → github
    await page.goBack()
    await page.waitForURL(/\/connectors\/github\/about/, { timeout: 15_000 })
    await expectBreadcrumbForSlug(page, 'github')

    // 4. forward → stripe
    await page.goForward()
    await page.waitForURL(/\/connectors\/stripe\/about/, { timeout: 15_000 })
    await expectBreadcrumbForSlug(page, 'stripe')

    // 5. back twice would leave /about entirely — verify breadcrumb mounts again on re-entry
    await page.goBack()
    await page.waitForURL(/\/connectors\/github\/about/, { timeout: 15_000 })
    await expectBreadcrumbForSlug(page, 'github')
  })
})
