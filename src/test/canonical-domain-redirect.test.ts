import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { shouldRedirect, buildTarget } from '@/lib/canonicalRedirect'

/**
 * Testes do redirect para o domínio canônico (kubovibe.dev) usado no
 * bootstrap de src/App.tsx. Exercitam a regra real exportada por
 * src/lib/canonicalRedirect.ts — não uma cópia.
 *
 * Regra: dev (localhost), previews (lovable.app / lovableproject.com), o
 * próprio canônico e o fallback *.up.railway.app ficam onde estão; qualquer
 * outro host é mandado para kubovibe.dev preservando caminho, query e hash.
 */

describe('Canonical-domain redirect → kubovibe.dev', () => {
  describe('shouldRedirect()', () => {
    it.each([
      ['kubo-vibe.com'],           // domínio antigo/alternativo
      ['kubovibe.com.br'],
      ['app.kubovibe.dev'],        // só o apex e o www são canônicos
      ['kubovibe.onrender.com'],
    ])('redirects when host = %s', (host) => {
      expect(shouldRedirect(host)).toBe(true)
    })

    it.each([
      ['kubovibe.dev'],                           // canônico
      ['www.kubovibe.dev'],
      ['localhost'],
      ['127.0.0.1'],
      ['id-preview--abc123.lovable.app'],         // sandbox preview
      ['kubo-vibe.lovable.app'],
      ['5ce8b966.lovableproject.com'],
      ['kubo-vibe-dev-production.up.railway.app'], // fallback do Railway
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
  })

  describe('integration: simulated window.location.replace', () => {
    const originalLocation = window.location
    let replaceMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      replaceMock = vi.fn()
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      })
    })

    function stubLocation(href: string) {
      const u = new URL(href)
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
          href: u.href,
          hostname: u.hostname,
          pathname: u.pathname,
          search: u.search,
          hash: u.hash,
          replace: replaceMock,
        },
      })
    }

    function runRedirect() {
      const host = window.location.hostname
      if (shouldRedirect(host)) {
        window.location.replace(buildTarget(window.location))
      }
    }

    it('redirects kubo-vibe.com/foo?x=1#y → kubovibe.dev/foo?x=1#y', () => {
      stubLocation('https://kubo-vibe.com/foo?x=1#y')
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

    it('preserves nested query + multi-segment hash when redirecting', () => {
      stubLocation('https://kubo-vibe.com/app/proj-123/meu-app?ref=email&t=1#top')
      runRedirect()
      expect(replaceMock).toHaveBeenCalledWith(
        'https://kubovibe.dev/app/proj-123/meu-app?ref=email&t=1#top',
      )
    })
  })
})
