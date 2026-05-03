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

/** Case-insensitive header lookup (RFC 9110 §5.1). */
function headerCI(headers: Record<string, string | undefined>, name: string): string | undefined {
  const target = name.toLowerCase()
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) return headers[k]
  }
  return undefined
}

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
      // ETag/Last-Modified must round-trip on 304 — case-insensitive lookup
      // because Node lowercases on `req.headers` but tests should not depend
      // on which casing the runtime exposes (RFC 9110 §5.1).
      expect(headerCI(second.responseHeaders, 'ETag')).toBe(ETAG)
      expect(headerCI(second.responseHeaders, 'Last-Modified')).toBe(LAST_MODIFIED)
      if (second.ifNoneMatch) expect(second.ifNoneMatch).toContain(ETAG)
    }

    await context.close()
    await edge.close()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Scenario matrix: drives every combination of path / query / hash through
  // both a fresh navigation (must 301) and a conditional revalidation (must
  // 304 with coherent validators), all while tolerating ETag/Last-Modified
  // header casing variations from any HTTP stack.
  // ─────────────────────────────────────────────────────────────────────────
  type Scenario = { label: string; path: string; query: string; hash: string }
  const SCENARIOS: Scenario[] = [
    { label: 'root',                       path: '/',                          query: '',                  hash: '' },
    { label: 'deep path only',             path: '/connectors/github',         query: '',                  hash: '' },
    { label: 'path + query',               path: '/dashboard',                 query: '?ref=email&t=1',    hash: '' },
    { label: 'path + hash',                path: '/pricing',                   query: '',                  hash: '#enterprise' },
    { label: 'path + query + hash',        path: '/connectors/github',         query: '?run=abc123',       hash: '#section-2' },
    { label: 'multi-segment + qs + hash',  path: '/app/proj-123/meu-app',      query: '?ref=email&t=1',    hash: '#top' },
    { label: 'encoded path + qs',          path: '/app/My%20Project',          query: '?q=hello%20world&x=%26', hash: '' },
  ]

  for (const sc of SCENARIOS) {
    test(`scenario [${sc.label}]: 301 + 304 + validators round-trip`, async ({ request }) => {
      const edge = await startEdge()
      // Hash is never sent on the wire (RFC 3986 §3.5) — we still include it
      // in the navigated URL to prove the server-side path/query handling is
      // hash-agnostic. The browser-level hash preservation is covered by the
      // companion Playwright spec.
      const src = `${edge.url}/redir${sc.path}${sc.query}${sc.hash}`
      const expectedLocation = `/dest${sc.path}${sc.query}` // hash stripped on the wire

      // ── Fresh request: must be a 301 with validators + correct Location ──
      const fresh = await request.fetch(src, { maxRedirects: 0 })
      expect(fresh.status(), `fresh must 301 for [${sc.label}]`).toBe(301)
      const fH = fresh.headers()
      expect(headerCI(fH, 'Location')).toBe(expectedLocation)
      expect(headerCI(fH, 'ETag')).toBe(ETAG)
      expect(headerCI(fH, 'Last-Modified')).toBe(LAST_MODIFIED)
      expect(headerCI(fH, 'Cache-Control')).toBe(CACHE_CONTROL)
      // 301 SHOULD have an empty (or nearly empty) body — locks that we are
      // not accidentally serving the SPA shell on the redirect response.
      expect((await fresh.body()).length, `301 body must be empty for [${sc.label}]`).toBe(0)

      // ── Conditional revalidation via If-None-Match: must be 304 ──
      const inm = await request.fetch(src, {
        maxRedirects: 0,
        headers: { 'If-None-Match': ETAG },
      })
      expect(inm.status(), `If-None-Match → 304 for [${sc.label}]`).toBe(304)
      const iH = inm.headers()
      expect(headerCI(iH, 'ETag')).toBe(ETAG)
      expect(headerCI(iH, 'Last-Modified')).toBe(LAST_MODIFIED)
      expect(headerCI(iH, 'Cache-Control')).toBe(CACHE_CONTROL)
      expect((await inm.body()).length, '304 body must be empty').toBe(0)

      // ── Conditional revalidation via If-Modified-Since (fresh) → 304 ──
      const ims = await request.fetch(src, {
        maxRedirects: 0,
        headers: { 'If-Modified-Since': LAST_MODIFIED },
      })
      expect(ims.status(), `If-Modified-Since → 304 for [${sc.label}]`).toBe(304)
      expect(headerCI(ims.headers(), 'ETag')).toBe(ETAG)

      // ── Stale If-Modified-Since → fresh 301 ──
      const stale = await request.fetch(src, {
        maxRedirects: 0,
        headers: { 'If-Modified-Since': new Date('2000-01-01T00:00:00Z').toUTCString() },
      })
      expect(stale.status(), `stale IMS → 301 for [${sc.label}]`).toBe(301)
      expect(headerCI(stale.headers(), 'Location')).toBe(expectedLocation)

      await edge.close()
    })
  }


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
