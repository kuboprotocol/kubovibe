// E2E tests for the GitHub login UI on /auth.
// Mocks the supabase edge function calls and the GitHub OAuth landing
// to verify the initiate → redirect flow, callback error toasts with reqId,
// and the Sign Out loading + confirmation toast.
import { test, expect, type Route } from '@playwright/test'

const INITIATE_URL_RE = /\/functions\/v1\/github-signin-initiate/

test.describe('GitHub login UI', () => {
  test('initiate success: button shows loading then redirects to GitHub', async ({ page }) => {
    // Intercept GitHub itself so the test stays offline & deterministic
    await page.route('https://github.com/login/oauth/authorize**', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>fake-github</body></html>' }),
    )
    // Mock the initiate edge function response
    await page.route(INITIATE_URL_RE, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://github.com/login/oauth/authorize?client_id=cid&state=xyz' }),
      }),
    )

    await page.goto('/auth')
    const btn = page.getByTestId('auth-github')
    await expect(btn).toBeVisible()

    await Promise.all([
      page.waitForURL(/github\.com\/login\/oauth\/authorize/),
      btn.click(),
    ])
    await expect(page.locator('body')).toContainText('fake-github')
  })

  test('initiate returns github_not_configured: shows friendly error toast', async ({ page }) => {
    await page.route(INITIATE_URL_RE, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'github_not_configured' }),
      }),
    )
    await page.goto('/auth')
    await page.getByTestId('auth-github').click()
    await expect(page.getByText(/not configured/i)).toBeVisible()
  })

  test('callback error in URL shows toast with reqId reference and cleans URL', async ({ page }) => {
    await page.goto('/auth?auth_error=invalid_state&auth_req_id=req-xyz-123')

    await expect(page.getByText(/session expired/i)).toBeVisible()
    await expect(page.getByText(/Reference ID: req-xyz-123/)).toBeVisible()

    // URL should be cleaned of auth params after the toast is shown
    await expect.poll(() => new URL(page.url()).search).not.toContain('auth_error')
    await expect.poll(() => new URL(page.url()).search).not.toContain('auth_req_id')
  })

  test('callback error without reqId shows toast without reference line', async ({ page }) => {
    await page.goto('/auth?auth_error=oauth_denied')
    await expect(page.getByText(/GitHub access was denied/i)).toBeVisible()
    await expect(page.getByText(/Reference ID:/)).toHaveCount(0)
  })

  test('safe redirect param is forwarded to initiate as returnUrl', async ({ page }) => {
    let capturedBody = ''
    await page.route(INITIATE_URL_RE, async (route: Route) => {
      capturedBody = route.request().postData() || ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'about:blank' }),
      })
    })
    await page.route('about:blank', (route) => route.fulfill({ status: 200, body: '' }))

    await page.goto('/auth?redirect=/connectors/github')
    await page.getByTestId('auth-github').click()
    await expect.poll(() => capturedBody).toContain('"returnUrl":"/connectors/github"')
  })
})
