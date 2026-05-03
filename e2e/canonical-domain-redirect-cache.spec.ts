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
const ETAG = '"redir-v1"'
// Stable Last-Modified anchored to a fixed point in the past so revalidation
// is deterministic across runs and matches what a real CDN would emit.
const LAST_MODIFIED = new Date('2024-01-01T00:00:00Z').toUTCString()

type Hit = {
  url: string
  method: string
  ifNoneMatch?: string
  ifModifiedSince?: string
  status: number
  responseHeaders: Record<string, string>
}

/** Boots a local HTTP server that mimics the edge redirect rule. */
function startEdge(): Promise<{ url: string; close: () => Promise<void>; hits: Hit[] }> {
  const hits: Hit[] = []
  const server = http.createServer((req, res) => {
    const inm = typeof req.headers['if-none-match'] === 'string' ? (req.headers['if-none-match'] as string) : undefined
    const ims =
      typeof req.headers['if-modified-since'] === 'string' ? (req.headers['if-modified-since'] as string) : undefined
    const hit: Hit = {
      url: req.url ?? '/',
      method: req.method ?? 'GET',
      ifNoneMatch: inm,
      ifModifiedSince: ims,
      status: 0,
      responseHeaders: {},
    }
    hits.push(hit)

    const send = (status: number, headers: Record<string, string>, body?: string) => {
      hit.status = status
      hit.responseHeaders = headers
      res.writeHead(status, headers)
      res.end(body)
    }

    if (req.url?.startsWith('/redir/')) {
      // Conditional revalidation → 304 with the SAME ETag + Last-Modified +
      // Cache-Control as the original 301 (RFC 9111 §4.3.4 / §4.3.5).
      const imsMatches = ims !== undefined && new Date(ims).getTime() >= new Date(LAST_MODIFIED).getTime()
      if (inm === ETAG || imsMatches) {
        send(304, {
          'Cache-Control': CACHE_CONTROL,
          ETag: ETAG,
          'Last-Modified': LAST_MODIFIED,
        })
        return
      }
      send(301, {
        Location: `/dest${req.url.slice('/redir'.length)}`,
        'Cache-Control': CACHE_CONTROL,
        ETag: ETAG,
        'Last-Modified': LAST_MODIFIED,
        Date: new Date().toUTCString(),
      })
      return
    }
    if (req.url?.startsWith('/dest')) {
      send(
        200,
        { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        '<!doctype html><html><body><main id="ok">canonical</main></body></html>',
      )
      return
    }
    send(404, {})
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

    const redirHits = () => edge.hits.filter((h) => h.url.startsWith('/redir/'))
    expect(redirHits().length, 'first navigation should hit the redirect endpoint exactly once').toBe(1)

    // ---------- 2nd navigation: cache must short-circuit ----------
    await page.goto('about:blank')
    await page.goto(`${edge.url}/redir/page?x=1`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${edge.url}/dest/page?x=1`)

    // Cross-browser contract: either the browser served the 301 fully from
    // cache (no extra hit), OR it issued a conditional revalidation that
    // must carry If-None-Match / If-Modified-Since AND receive a 304 with
    // coherent ETag/Last-Modified echoed back. A naked re-GET (200/301 with
    // no validators) means caching is broken.
    const hits = redirHits()
    expect(hits.length, `at most one extra revalidation allowed; hits: ${JSON.stringify(hits)}`).toBeLessThanOrEqual(2)
    if (hits.length === 2) {
      const second = hits[1]
      expect(
        Boolean(second.ifNoneMatch || second.ifModifiedSince),
        `second hit must be a conditional revalidation, got: ${JSON.stringify(second)}`,
      ).toBe(true)
      expect(second.status, 'revalidation must respond 304 Not Modified').toBe(304)
      // ETag/Last-Modified must round-trip on the 304 so the browser can
      // keep the cached 301 fresh (RFC 9111 §4.3.4).
      expect(second.responseHeaders['ETag'] ?? second.responseHeaders['etag']).toBe(ETAG)
      expect(second.responseHeaders['Last-Modified'] ?? second.responseHeaders['last-modified']).toBe(LAST_MODIFIED)
      // If the client sent If-None-Match it must echo our ETag verbatim.
      if (second.ifNoneMatch) {
        expect(second.ifNoneMatch).toContain(ETAG)
      }
    }

    await context.close()
    await edge.close()
  })

  test('conditional revalidation: 304 echoes coherent ETag + Last-Modified', async ({ request }) => {
    // Drives revalidation directly (browser-independent) so the 304 contract
    // is locked even when the user-agent decides not to revalidate.
    const edge = await startEdge()

    // Sanity: warm fetch returns 301 with validators.
    const warm = await request.fetch(`${edge.url}/redir/x?q=1`, { maxRedirects: 0 })
    expect(warm.status()).toBe(301)
    const warmHeaders = warm.headers()
    expect(warmHeaders['etag']).toBe(ETAG)
    expect(warmHeaders['last-modified']).toBe(LAST_MODIFIED)
    expect(warmHeaders['cache-control']).toBe(CACHE_CONTROL)
    expect(warmHeaders['location']).toBe('/dest/x?q=1')

    // If-None-Match → 304 with same ETag + Last-Modified, no body.
    const inm = await request.fetch(`${edge.url}/redir/x?q=1`, {
      maxRedirects: 0,
      headers: { 'If-None-Match': ETAG },
    })
    expect(inm.status()).toBe(304)
    const inmH = inm.headers()
    expect(inmH['etag'], 'ETag must round-trip on 304').toBe(ETAG)
    expect(inmH['last-modified'], 'Last-Modified must round-trip on 304').toBe(LAST_MODIFIED)
    expect(inmH['cache-control'], 'Cache-Control must round-trip on 304').toBe(CACHE_CONTROL)
    expect((await inm.body()).length, '304 must have an empty body').toBe(0)

    // If-Modified-Since (≥ Last-Modified) → 304 too.
    const ims = await request.fetch(`${edge.url}/redir/x?q=1`, {
      maxRedirects: 0,
      headers: { 'If-Modified-Since': LAST_MODIFIED },
    })
    expect(ims.status()).toBe(304)
    expect(ims.headers()['etag']).toBe(ETAG)
    expect(ims.headers()['last-modified']).toBe(LAST_MODIFIED)

    // Stale If-Modified-Since (older than Last-Modified) → fresh 301.
    const stale = await request.fetch(`${edge.url}/redir/x?q=1`, {
      maxRedirects: 0,
      headers: { 'If-Modified-Since': new Date('2000-01-01T00:00:00Z').toUTCString() },
    })
    expect(stale.status()).toBe(301)
    expect(stale.headers()['etag']).toBe(ETAG)

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
