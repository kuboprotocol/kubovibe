import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Unit tests for the canonical-domain redirect that lives in src/App.tsx.
 *
 * The logic is mirrored here (single source of truth would require a small
 * helper export — kept inline for now to avoid touching the bootstrap path).
 * If the inline rule in App.tsx changes, update `shouldRedirect`/`buildTarget`
 * to match and these tests will keep regressions from sneaking through.
 */

const TARGET_HOST = 'https://kubovibe.dev'

function shouldRedirect(host: string): boolean {
  return /(^|\.)lovable\.app$/i.test(host) && !host.startsWith('id-preview--')
}

function buildTarget(loc: { pathname: string; search: string; hash: string }) {
  return `${TARGET_HOST}${loc.pathname}${loc.search}${loc.hash}`
}

describe('Canonical-domain redirect: lovable.app → kubovibe.dev', () => {
  describe('shouldRedirect()', () => {
    it.each([
      ['kubovibe.lovable.app', true],
      ['lovable.app', true],
      ['foo.bar.lovable.app', true],
      ['LOVABLE.APP', true], // case-insensitive
    ])('redirects when host = %s', (host, expected) => {
      expect(shouldRedirect(host)).toBe(expected)
    })

    it.each([
      ['id-preview--abc123.lovable.app'], // sandbox preview
      ['kubovibe.dev'],                   // canonical
      ['www.kubovibe.dev'],
      ['localhost'],
      ['127.0.0.1'],
      ['evil-lovable.app.com'],           // host suffix attack
      ['mylovable.app'],                  // not a subdomain
    ])('does NOT redirect when host = %s', (host) => {
      expect(shouldRedirect(host)).toBe(false)
    })
  })

  describe('buildTarget()', () => {
    it('preserves path, query and hash exactly', () => {
      const url = buildTarget({
        pathname: '/connectors/github',
        search: '?run=abc123&tab=logs',
        hash: '#section-2',
      })
      expect(url).toBe(
        'https://kubovibe.dev/connectors/github?run=abc123&tab=logs#section-2',
      )
    })

    it('handles root path with no query/hash', () => {
      expect(buildTarget({ pathname: '/', search: '', hash: '' }))
        .toBe('https://kubovibe.dev/')
    })

    it('preserves encoded characters in path & query', () => {
      const url = buildTarget({
        pathname: '/app/My%20Project',
        search: '?q=hello%20world&x=%26',
        hash: '',
      })
      expect(url).toBe(
        'https://kubovibe.dev/app/My%20Project?q=hello%20world&x=%26',
      )
    })

    it('preserves only-hash and only-query variants', () => {
      expect(buildTarget({ pathname: '/dash', search: '', hash: '#x' }))
        .toBe('https://kubovibe.dev/dash#x')
      expect(buildTarget({ pathname: '/dash', search: '?a=1', hash: '' }))
        .toBe('https://kubovibe.dev/dash?a=1')
    })
  })

  describe('integration: simulated window.location.replace', () => {
    let originalLocation: Location
    let replaceMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      originalLocation = window.location
      replaceMock = vi.fn()
    })
    afterEach(() => {
      // @ts-expect-error restore
      window.location = originalLocation
    })

    function stubLocation(href: string) {
      const u = new URL(href)
      // @ts-expect-error override read-only location for the test
      delete window.location
      // @ts-expect-error inject mock
      window.location = {
        href: u.href,
        hostname: u.hostname,
        pathname: u.pathname,
        search: u.search,
        hash: u.hash,
        replace: replaceMock,
      }
    }

    function runRedirect() {
      const host = window.location.hostname
      if (shouldRedirect(host)) {
        const target = buildTarget(window.location)
        window.location.replace(target)
      }
    }

    it('redirects kubovibe.lovable.app/foo?x=1#y → kubovibe.dev/foo?x=1#y', () => {
      stubLocation('https://kubovibe.lovable.app/foo?x=1#y')
      runRedirect()
      expect(replaceMock).toHaveBeenCalledWith('https://kubovibe.dev/foo?x=1#y')
    })

    it('does not redirect when already on kubovibe.dev', () => {
      stubLocation('https://kubovibe.dev/dashboard')
      runRedirect()
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('does not redirect from id-preview sandbox', () => {
      stubLocation('https://id-preview--5ce8b966.lovable.app/builder')
      runRedirect()
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('does not redirect from localhost (dev)', () => {
      stubLocation('http://localhost:8080/auth?redirect=/dashboard')
      runRedirect()
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('preserves nested query + multi-segment hash on the public app URL', () => {
      stubLocation(
        'https://kubovibe.lovable.app/app/proj-123/meu-app?ref=email&t=1#top',
      )
      runRedirect()
      expect(replaceMock).toHaveBeenCalledWith(
        'https://kubovibe.dev/app/proj-123/meu-app?ref=email&t=1#top',
      )
    })
  })
})
