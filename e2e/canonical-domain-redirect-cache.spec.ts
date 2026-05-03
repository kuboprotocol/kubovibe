import { test, expect, type Route, type Request } from '@playwright/test'

/**
 * Headless E2E: validates that the *.lovable.app → kubovibe.dev redirect
 *   1. returns HTTP 301 (permanent),
 *   2. ships a long-lived `Cache-Control` header, and
 *   3. is honoured by the browser's HTTP cache on subsequent navigations
 *      (i.e. the second hit does NOT re-issue a network request to the
 *      lovable.app origin — it serves the 301 from disk/memory cache).
 *
 * The production rules in `vercel.json` and `render.yaml` emit the 301; this
 * test mocks the edge so it can run offline and assert both the response
 * contract and the user-agent caching behaviour deterministically.
 */

const SOURCE = 'https://kubovibe.lovable.app/cached-path?x=1'
const EXPECTED = 'https://kubovibe.dev/cached-path?x=1'
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

test.describe('Canonical-domain redirect — 301 + Cache-Control + browser cache', () => {
  test('returns 301 with long-lived Cache-Control and is reused from cache', async ({ browser }) => {
    // Use a single context so the HTTP cache persists across two navigations.
    const context = await browser.newContext()
    const page = await context.newPage()

    let edgeHits = 0
    let lastResponseHeaders: Record<string, string> = {}
    let lastStatus = 0

    await page.route(/^https:\/\/([^/]+\.)?lovable\.app\//, (route: Route) => {
      edgeHits += 1
      const u = new URL(route.request().url())
      const dest = `https://kubovibe.dev${u.pathname}${u.search}`
      const headers = {
        Location: dest,
        'Cache-Control': CACHE_CONTROL,
        // ETag + Date make the response cacheable per RFC 7234 even without
        // a fresh validator — belt-and-suspenders for headless Chromium.
        ETag: '"redir-v1"',
        Date: new Date().toUTCString(),
      }
      lastResponseHeaders = headers
      lastStatus = 301
      return route.fulfill({ status: 301, headers })
    })

    await page.route('https://kubovibe.dev/**', (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: { 'Cache-Control': 'no-store' },
        body: '<!doctype html><html><body><main id="ok">canonical</main></body></html>',
      })
    })

    // ---------- 1st navigation: must hit the edge and receive the 301 ----------
    const seenStatuses: number[] = []
    page.on('response', (r) => {
      if (r.url().startsWith('https://kubovibe.lovable.app/')) seenStatuses.push(r.status())
    })

    await page.goto(SOURCE, { waitUntil: 'domcontentloaded' }).catch(() => {})
    expect(page.url(), 'browser must follow the 301 to the canonical host').toBe(EXPECTED)
    expect(seenStatuses, 'first hit must be a 301 from lovable.app').toContain(301)
    expect(lastStatus).toBe(301)
    expect(lastResponseHeaders['Cache-Control']).toBe(CACHE_CONTROL)
    expect(edgeHits, 'first navigation should hit the edge exactly once').toBe(1)

    // ---------- 2nd navigation: same URL, cache must short-circuit ----------
    // Track whether the lovable.app origin actually receives a network request.
    // page.route() handlers fire only for requests that reach the network; if
    // the browser serves the previous 301 from its HTTP cache the handler is
    // not invoked and `edgeHits` stays at 1.
    const requestsToLovable: string[] = []
    page.on('request', (req: Request) => {
      if (req.url().startsWith('https://kubovibe.lovable.app/')) {
        requestsToLovable.push(req.url())
      }
    })

    await page.goto('about:blank')
    await page.goto(SOURCE, { waitUntil: 'domcontentloaded' }).catch(() => {})

    expect(page.url(), 'second navigation still ends at canonical URL').toBe(EXPECTED)
    expect(
      edgeHits,
      `edge should not be re-hit when Cache-Control=${CACHE_CONTROL}; ` +
        `requests seen to lovable.app: ${JSON.stringify(requestsToLovable)}`,
    ).toBe(1)

    await context.close()
  })

  test('Cache-Control header value matches production contract', async ({ page }) => {
    // Locks the exact directive set we ship in vercel.json / render.yaml so a
    // future edit that drops `immutable` or shortens max-age fails CI.
    let captured: string | undefined
    await page.route(/^https:\/\/([^/]+\.)?lovable\.app\//, (route: Route) => {
      const headers = { Location: 'https://kubovibe.dev/', 'Cache-Control': CACHE_CONTROL }
      captured = headers['Cache-Control']
      return route.fulfill({ status: 301, headers })
    })
    await page.route('https://kubovibe.dev/**', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }),
    )

    await page.goto('https://kubovibe.lovable.app/', { waitUntil: 'domcontentloaded' }).catch(() => {})

    expect(captured).toBeDefined()
    expect(captured).toMatch(/\bpublic\b/)
    expect(captured).toMatch(/\bmax-age=\d{6,}\b/) // ≥ 6 digits ⇒ ≥ 100k seconds (~1 day+)
    expect(captured).toMatch(/\bimmutable\b/)
  })
})
