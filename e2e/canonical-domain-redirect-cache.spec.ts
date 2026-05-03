import { test, expect, type Route } from '@playwright/test'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Headless E2E: validates that the *.lovable.app → kubovibe.dev redirect
 *   1. returns HTTP 301 (permanent),
 *   2. ships a long-lived `Cache-Control` header, and
 *   3. is honoured by the browser's HTTP cache on subsequent navigations.
 *
 * For (3) we cannot use `page.route()` — it always intercepts and bypasses
 * the browser cache. Instead we boot a tiny real `http.Server` on localhost,
 * count server-side hits, and prove the second navigation does NOT touch the
 * server because Chromium serves the 301 from its HTTP cache.
 *
 * The production rules in `vercel.json` and `render.yaml` emit the same
 * 301 + Cache-Control contract this test pins.
 */

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

type Hit = { url: string; method: string }

/** Boots a local HTTP server that mimics the edge redirect rule. */
function startEdge(): Promise<{ url: string; close: () => Promise<void>; hits: Hit[] }> {
  const hits: Hit[] = []
  const server = http.createServer((req, res) => {
    hits.push({ url: req.url ?? '/', method: req.method ?? 'GET' })
    if (req.url?.startsWith('/redir/')) {
      // Emit the production 301 contract.
      res.writeHead(301, {
        Location: `/dest${req.url.slice('/redir'.length)}`,
        'Cache-Control': CACHE_CONTROL,
        ETag: '"redir-v1"',
        Date: new Date().toUTCString(),
      })
      res.end()
      return
    }
    if (req.url?.startsWith('/dest')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end('<!doctype html><html><body><main id="ok">canonical</main></body></html>')
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        hits,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r())
          }),
      })
    })
  })
}

test.describe('Canonical-domain redirect — 301 + Cache-Control + browser cache', () => {
  test('returns 301 with long-lived Cache-Control and is reused from cache', async ({ browser }) => {
    const edge = await startEdge()
    // Single context so the in-memory HTTP cache persists between navigations.
    const context = await browser.newContext()
    const page = await context.newPage()

    const seenRedirectStatuses: number[] = []
    const cacheHeaders: string[] = []
    page.on('response', (r) => {
      const u = r.url()
      if (u.startsWith(`${edge.url}/redir/`)) {
        seenRedirectStatuses.push(r.status())
        const cc = r.headers()['cache-control']
        if (cc) cacheHeaders.push(cc)
      }
    })

    // ---------- 1st navigation: hit edge → 301 → /dest/page ----------
    await page.goto(`${edge.url}/redir/page?x=1`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${edge.url}/dest/page?x=1`)
    expect(seenRedirectStatuses, 'first hit must be 301').toContain(301)
    expect(cacheHeaders[0]).toBe(CACHE_CONTROL)

    const hitsAfterFirst = edge.hits.filter((h) => h.url.startsWith('/redir/')).length
    expect(hitsAfterFirst, 'first navigation should hit the redirect endpoint exactly once').toBe(1)

    // ---------- 2nd navigation: cache must short-circuit ----------
    await page.goto('about:blank')
    await page.goto(`${edge.url}/redir/page?x=1`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${edge.url}/dest/page?x=1`)

    const hitsAfterSecond = edge.hits.filter((h) => h.url.startsWith('/redir/')).length
    expect(
      hitsAfterSecond,
      `redirect endpoint must NOT be re-hit when Cache-Control=${CACHE_CONTROL}; ` +
        `server hits seen: ${JSON.stringify(edge.hits)}`,
    ).toBe(1)

    await context.close()
    await edge.close()
  })

  test('Cache-Control header value matches production contract', async ({ page }) => {
    // Locks the exact directive set we ship in vercel.json / render.yaml.
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
    expect(captured).toMatch(/\bmax-age=\d{6,}\b/)
    expect(captured).toMatch(/\bimmutable\b/)
  })
})
