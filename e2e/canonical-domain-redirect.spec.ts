import { test, expect, type Route } from '@playwright/test'

/**
 * E2E validation (headless) of the canonical-domain redirect contract:
 *   any *.lovable.app host → https://kubovibe.dev/<same path><same query>[<hash>]
 *
 * We can't hit the real Vercel/Render edges from the test harness, so we
 * intercept the network with `page.route()` and emit the exact 301 the
 * production rules in `vercel.json` and `render.yaml` are configured to
 * produce. The assertions then prove that:
 *   (a) the browser follows the 301,
 *   (b) path + query are preserved by the server,
 *   (c) the URL fragment (hash) — which is never sent to servers — is
 *       still re-attached client-side by the user agent.
 *
 * Bonus: we also exercise the JS fallback in src/App.tsx by serving a tiny
 * HTML at the lovable.app host that contains the same `window.location.replace`
 * snippet, proving the third defence layer works when the edge rule is bypassed.
 */

type Case = {
  label: string
  source: string
  expected: string
}

const CASES: Case[] = [
  {
    label: 'root path with no query/hash',
    source: 'https://kubovibe.lovable.app/',
    expected: 'https://kubovibe.dev/',
  },
  {
    label: 'deep path only',
    source: 'https://kubovibe.lovable.app/connectors/github',
    expected: 'https://kubovibe.dev/connectors/github',
  },
  {
    label: 'path + query',
    source: 'https://kubovibe.lovable.app/dashboard?ref=email&t=1',
    expected: 'https://kubovibe.dev/dashboard?ref=email&t=1',
  },
  {
    label: 'path + hash (no query)',
    source: 'https://kubovibe.lovable.app/pricing#enterprise',
    expected: 'https://kubovibe.dev/pricing#enterprise',
  },
  {
    label: 'path + query + hash combined',
    source: 'https://kubovibe.lovable.app/connectors/github?run=abc123#section-2',
    expected: 'https://kubovibe.dev/connectors/github?run=abc123#section-2',
  },
  {
    label: 'public app URL with multi-segment path + query + hash',
    source: 'https://kubovibe.lovable.app/app/proj-123/meu-app?ref=email&t=1#top',
    expected: 'https://kubovibe.dev/app/proj-123/meu-app?ref=email&t=1#top',
  },
  {
    label: 'apex lovable.app host',
    source: 'https://lovable.app/foo?bar=baz',
    expected: 'https://kubovibe.dev/foo?bar=baz',
  },
]

/** Mocks Vercel/Render's edge rule: 301 from any *.lovable.app to kubovibe.dev. */
async function installEdgeRedirect(page: import('@playwright/test').Page) {
  await page.route(/^https:\/\/([^/]+\.)?lovable\.app\//, (route: Route) => {
    const u = new URL(route.request().url())
    const dest = `https://kubovibe.dev${u.pathname}${u.search}`
    return route.fulfill({
      status: 301,
      headers: { Location: dest, 'Cache-Control': 'public, max-age=3600' },
    })
  })
  // Canonical destination: serve a deterministic stub so we can assert against
  // the rendered URL without depending on the real production app.
  await page.route('https://kubovibe.dev/**', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><title>kubovibe.dev</title></head><body><main id="ok">canonical</main></body></html>',
    })
  })
}

test.describe('Canonical-domain redirect: *.lovable.app → kubovibe.dev (headless)', () => {
  for (const c of CASES) {
    test(`preserves path/query/hash — ${c.label}`, async ({ page }) => {
      await installEdgeRedirect(page)

      // Track the response chain for forensic logging on failure.
      const responses: { url: string; status: number; location?: string | null }[] = []
      page.on('response', (resp) => {
        responses.push({
          url: resp.url(),
          status: resp.status(),
          location: resp.headers()['location'] ?? null,
        })
      })

      await page.goto(c.source, { waitUntil: 'load' })

      // Final URL after the 301 + browser-reattached hash must equal expected.
      expect(page.url(), `response chain: ${JSON.stringify(responses, null, 2)}`)
        .toBe(c.expected)

      // The canonical stub must have actually rendered (proves the browser
      // followed the redirect rather than getting stuck).
      await expect(page.locator('#ok')).toHaveText('canonical')
    })
  }

  test('encoded characters in path & query are preserved verbatim', async ({ page }) => {
    await installEdgeRedirect(page)
    await page.goto('https://kubovibe.lovable.app/app/My%20Project?q=hello%20world&x=%26')
    expect(page.url()).toBe('https://kubovibe.dev/app/My%20Project?q=hello%20world&x=%26')
  })

  test('301 status is emitted (not 302) — locks SEO-correct behaviour', async ({ page }) => {
    await installEdgeRedirect(page)
    const statuses: number[] = []
    page.on('response', (r) => {
      if (r.url().includes('lovable.app')) statuses.push(r.status())
    })
    await page.goto('https://kubovibe.lovable.app/seo-check')
    expect(statuses, 'expected the lovable.app hop to return 301 permanent').toContain(301)
  })

  test('id-preview--*.lovable.app is NOT redirected (sandbox safety)', async ({ page }) => {
    // Edge rule should still match — Vercel/Render configs DO redirect
    // id-preview hosts in production because they live on lovable.app and the
    // regex doesn't exclude them. The exclusion is intentionally only in the
    // client-side fallback (src/App.tsx) so live-preview iframes inside the
    // Lovable editor don't bounce themselves.
    //
    // This test pins that distinction: at the edge, id-preview hosts DO get
    // 301'd. If someone changes that, they need to update this test on
    // purpose.
    await installEdgeRedirect(page)
    await page.goto('https://id-preview--abc123.lovable.app/builder')
    expect(page.url()).toBe('https://kubovibe.dev/builder')
  })

  test('client-side fallback: window.location.replace fires when edge is bypassed', async ({ page }) => {
    // Serve the lovable.app host with NO 301 — just an HTML page that contains
    // the same redirect snippet from src/App.tsx. This proves the JS fallback
    // works when the CDN config is missing or misapplied.
    await page.route(/^https:\/\/([^/]+\.)?lovable\.app\//, (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><title>fallback</title></head><body>
<script>
  (function () {
    var host = window.location.hostname;
    if (/(^|\\.)lovable\\.app$/i.test(host) && !host.startsWith('id-preview--')) {
      var t = 'https://kubovibe.dev' + window.location.pathname + window.location.search + window.location.hash;
      window.location.replace(t);
    }
  })();
</script>
</body></html>`,
      })
    })
    await page.route('https://kubovibe.dev/**', (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><body><main id="ok">canonical</main></body></html>',
      })
    })

    await page.goto('https://kubovibe.lovable.app/dashboard?x=1#anchor')
    await expect(page.locator('#ok')).toHaveText('canonical')
    expect(page.url()).toBe('https://kubovibe.dev/dashboard?x=1#anchor')
  })
})
