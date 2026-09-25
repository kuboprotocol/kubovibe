import { describe, it, expect } from 'vitest'
import { renderRobots, renderSitemap, sitemapUrls } from '../../vite-plugins/seo'
import { ALTERNATIVES, findAlternative } from '@/config/alternatives'
import { BRAND, SITE_ORIGIN } from '@/config/brand'

describe('SEO: sitemap, robots e páginas de comparação', () => {
  it('SITE_ORIGIN segue a chave de troca de domínio', () => {
    const expected = BRAND.primaryDomainLive ? BRAND.domain : BRAND.legacyDomain
    expect(SITE_ORIGIN).toBe(`https://${expected}`)
  })

  it('sitemap usa a origem informada e inclui cada página de comparação', () => {
    const urls = sitemapUrls('https://vertal.dev')
    expect(urls).toContain('https://vertal.dev/')
    expect(urls).toContain('https://vertal.dev/alternativas')
    for (const a of ALTERNATIVES) {
      expect(urls).toContain(`https://vertal.dev/alternativas/${a.slug}`)
    }
    expect(urls.every((u) => u.startsWith('https://vertal.dev/'))).toBe(true)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('sitemap não expõe áreas logadas nem admin', () => {
    const xml = renderSitemap('https://vertal.dev')
    expect(xml).toMatch(/^<\?xml version="1.0"/)
    expect(xml).not.toMatch(/\/admin|\/dashboard|\/builder/)
  })

  it('robots aponta para o sitemap e bloqueia /admin/', () => {
    const txt = renderRobots('https://vertal.dev')
    expect(txt).toContain('Sitemap: https://vertal.dev/sitemap.xml')
    expect(txt).toContain('Disallow: /admin/')
  })

  it('slugs de comparação são únicos e em minúsculas', () => {
    const slugs = ALTERNATIVES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
    expect(findAlternative('lovable')?.name).toBe('Lovable')
    expect(findAlternative('nao-existe')).toBeUndefined()
  })
})
