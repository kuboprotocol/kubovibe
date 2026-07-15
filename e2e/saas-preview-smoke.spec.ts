/**
 * Smoke test — SaaS public-app preview flow.
 *
 * Intercepts the Supabase `published_projects` fetch, forces a known-good
 * HTML payload, and asserts that:
 *   1. The preview iframe mounts with non-zero dimensions.
 *   2. The rendered surface has a white background (no "black screen").
 *   3. The generated content is actually visible inside the iframe body.
 *
 * This guards against the black-screen regression: iframe collapse (0×0),
 * missing/blocked srcDoc, and blank documents.
 */
import { test, expect } from '@playwright/test'

const SAMPLE_HTML = `<!DOCTYPE html><html><head><title>Smoke</title></head>
<body style="margin:0;padding:24px;font-family:system-ui;background:#ffffff;color:#111">
<h1 data-testid="smoke-heading">Smoke OK</h1>
<p>Preview rendered correctly.</p>
</body></html>`

test.describe('SaaS preview smoke', () => {
  test('published app renders with white background and non-zero size', async ({ page }) => {
    // Intercept every Supabase REST call for published_projects and return our fixture.
    await page.route('**/rest/v1/published_projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-0/1' },
        body: JSON.stringify({
          id: 'smoke-test',
          generated_code: SAMPLE_HTML,
          is_published: true,
          title: 'Smoke Test App',
        }),
      })
    })

    await page.goto('/app/smoke-test/smoke', { waitUntil: 'domcontentloaded' })

    const iframe = page.locator('iframe[title="Published App"]')
    await expect(iframe).toBeVisible({ timeout: 10_000 })

    // Dimensions: must be > 200×200 to prove the layout didn't collapse.
    const box = await iframe.boundingBox()
    expect(box, 'iframe must have a bounding box').not.toBeNull()
    expect(box!.width).toBeGreaterThan(200)
    expect(box!.height).toBeGreaterThan(200)

    // Background: iframe element must be white (guards against the black-screen bug).
    const bg = await iframe.evaluate((el) => getComputedStyle(el).backgroundColor)
    // rgb(255, 255, 255) — accept whitespace variance
    expect(bg.replace(/\s+/g, '')).toBe('rgb(255,255,255)')

    // Content inside the iframe body should be visible and non-empty.
    const frame = page.frameLocator('iframe[title="Published App"]')
    await expect(frame.getByTestId('smoke-heading')).toBeVisible({ timeout: 10_000 })
    const bodyText = await frame.locator('body').evaluate((el) => el.textContent?.trim() ?? '')
    expect(bodyText.length).toBeGreaterThan(5)

    // "Built with Kubo Vibe" badge should be present on public apps.
    await expect(page.getByText('Built with')).toBeVisible()
  })

  test('unpublished project shows fallback, not a black screen', async ({ page }) => {
    await page.route('**/rest/v1/published_projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'unpublished-smoke',
          generated_code: null,
          is_published: false,
          title: null,
        }),
      })
    })

    await page.goto('/app/unpublished-smoke', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/não está publicado|Projeto não encontrado/i)).toBeVisible({ timeout: 10_000 })
    // Ensure no orphan iframe rendered.
    await expect(page.locator('iframe[title="Published App"]')).toHaveCount(0)
  })
})
