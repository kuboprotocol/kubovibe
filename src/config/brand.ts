/**
 * Identidade da marca num único lugar. Para renomear o produto ou trocar o
 * domínio, altere só este arquivo: a interface, o manifesto PWA
 * (`vite.config.ts`), o `index.html` (canonical/og:url, via plugin do Vite),
 * o `sitemap.xml`/`robots.txt` gerados no build e o redirect de domínio
 * (`src/lib/canonicalRedirect.ts`) leem daqui.
 */
export const BRAND = {
  /** Nome do produto exibido na interface. */
  appName: 'Vertal Vibe Dev',
  /** Versão em caixa alta usada no logotipo e em títulos de destaque. */
  wordmark: 'VERTAL VIBE DEV',
  /** Nome curto (PWA, espaços apertados). */
  shortName: 'Vertal',
  /** Empresa responsável (termos, privacidade, copyright). */
  company: 'KUBO Protocol',
  /** Domínio definitivo da marca. */
  domain: 'vertal.dev',
  /** Domínio anterior; passa a redirecionar para `domain` quando a troca liga. */
  legacyDomain: 'kubovibe.dev',
  /**
   * Liga a troca de domínio. Só vire para `true` depois que vertal.dev e
   * www.vertal.dev estiverem verificados e com SSL no Railway: a partir daí
   * kubovibe.dev redireciona para vertal.dev e todo o SEO (canonical,
   * og:url, sitemap) aponta para o domínio novo. Virar antes derruba o site.
   */
  primaryDomainLive: false,
} as const

export const APP_NAME = BRAND.appName

/** Origem canônica do site (SEO, links absolutos, redirect de domínio). */
export const SITE_ORIGIN = `https://${
  BRAND.primaryDomainLive ? BRAND.domain : BRAND.legacyDomain
}`
