import { test, expect } from '@playwright/test'

/**
 * End-to-end test for the protected-route redirect flow:
 *  1. Visit /connectors while logged out
 *  2. Click the GitHub connector card
 *  3. Assert it would land on /connectors/github (and is intercepted to /auth?redirect=...)
 *  4. Complete login on /auth
 *  5. Assert it returns to /connectors/github
 *
 * Requires TEST_EMAIL / TEST_PASSWORD env vars (a confirmed Supabase user).
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

test.describe('Protected route redirect: /connectors → /connectors/github', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('redirects to /auth and returns to /connectors/github after login', async ({
    page,
    context,
  }) => {
    // Start clean — no Supabase session in localStorage
    await context.clearCookies()

    // 1. Visit /connectors while logged out → ProtectedRoute should redirect to /auth
    await page.goto('/connectors')
    await page.waitForURL(/\/auth\?redirect=/, { timeout: 15_000 })
    expect(page.url()).toContain('redirect=%2Fconnectors')

    // The protection banner should be visible
    await expect(page.getByText(/Conectores|protegida|Faça login/i).first()).toBeVisible()

    // 2. Log in via the form, but to test the deep-link case we navigate
    //    directly to the /connectors/github protected URL first so we land
    //    back there after auth.
    await page.goto('/connectors/github')
    await page.waitForURL(/\/auth\?redirect=/, { timeout: 15_000 })
    expect(decodeURIComponent(page.url())).toContain('redirect=/connectors/github')

    // 3. Fill credentials
    await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
    await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)

    // 4. Submit
    await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()

    // 5. Assert we land on /connectors/github
    await page.waitForURL('**/connectors/github', { timeout: 20_000 })
    expect(page.url()).toMatch(/\/connectors\/github$/)
  })

  test('clicking GitHub card on /connectors navigates to /connectors/github (logged in)', async ({
    page,
  }) => {
    // Pre-condition: log in once
    await page.goto('/auth')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
    await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
    await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 })

    // Now navigate to /connectors and click the GitHub card
    await page.goto('/connectors')
    await expect(page.getByRole('heading', { name: /conectores/i })).toBeVisible()

    await page.getByRole('button', { name: /github/i }).first().click()
    await page.waitForURL('**/connectors/github', { timeout: 10_000 })
    expect(page.url()).toMatch(/\/connectors\/github$/)
  })
})
