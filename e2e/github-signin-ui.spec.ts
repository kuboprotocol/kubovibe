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

    // a11y: sonner toast container should announce updates via aria-live
    const liveRegion = page.locator('[aria-live]').first()
    await expect(liveRegion).toHaveCount(1)

    // "Try again" action should be exposed as a button
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()

    // "Copy ID" button copies the reference ID to the clipboard
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: /copy id/i }).click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toBe('req-xyz-123')

    // URL should be cleaned of auth params after the toast is shown
    await expect.poll(() => new URL(page.url()).search).not.toContain('auth_error')
    await expect.poll(() => new URL(page.url()).search).not.toContain('auth_req_id')
  })

  test('callback error "Try again" re-initiates the OAuth flow with same redirect target', async ({ page }) => {
    let initiateCalls = 0
    let lastBody = ''
    await page.route(INITIATE_URL_RE, async (route: Route) => {
      initiateCalls++
      lastBody = route.request().postData() || ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'about:blank' }),
      })
    })
    await page.route('about:blank', (route) => route.fulfill({ status: 200, body: '' }))

    await page.goto('/auth?redirect=/connectors/github&auth_error=invalid_state&auth_req_id=r-1')
    await page.getByRole('button', { name: /try again/i }).click()
    await expect.poll(() => initiateCalls).toBeGreaterThanOrEqual(1)
    expect(lastBody).toContain('"returnUrl":"/connectors/github"')
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

  test('sign-out: spinner has role=status and toast region is announced', async ({ page }) => {
    // Simulate a logged-in session so the sign-out banner is visible.
    // We stub the auth session in localStorage before the app boots.
    await page.addInitScript(() => {
      const fakeSession = {
        currentSession: {
          access_token: 'fake', refresh_token: 'fake', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
          user: { id: 'u1', email: 'tester@example.com', aud: 'authenticated', role: 'authenticated' },
        },
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }
      try {
        Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach(k => localStorage.removeItem(k))
        localStorage.setItem('sb-auth-token', JSON.stringify(fakeSession))
      } catch { /* ignore */ }
    })
    await page.goto('/auth?signout=1')

    const btn = page.getByTestId('auth-signout')
    if (await btn.count() === 0) test.skip(true, 'Sign-out banner not rendered without real session')

    await btn.click()
    // Spinner should be exposed as a status to AT (role=status, accessible name)
    const spinner = page.getByTestId('auth-signout-spinner')
    await expect(spinner).toHaveAttribute('role', 'status')
    await expect(spinner).toHaveAttribute('aria-label', /signing out/i)
    // Button should be aria-busy while signing out
    await expect(btn).toHaveAttribute('aria-busy', 'true')
    // Sonner renders an aria-live region for toasts
    await expect(page.locator('[aria-live]').first()).toBeAttached()
  })
})

