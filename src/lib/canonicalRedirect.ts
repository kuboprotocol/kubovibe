/**
 * Regra do redirect para o domínio canônico, usada no bootstrap em
 * `src/App.tsx`. Fica num módulo próprio para que o teste
 * (`src/test/canonical-domain-redirect.test.ts`) exercite a regra real, e
 * não uma cópia que pode ficar desatualizada.
 *
 * O domínio canônico vem de `src/config/brand.ts` (`BRAND.primaryDomainLive`):
 * - desligado: kubovibe.dev é canônico e vertal.dev também serve o app;
 * - ligado: vertal.dev é canônico e kubovibe.dev redireciona para ele.
 */
import { BRAND, SITE_ORIGIN } from '@/config/brand'

export const CANONICAL_ORIGIN = SITE_ORIGIN

function apexAndWww(domain: string): string[] {
  return [domain, `www.${domain}`]
}

/** Hosts onde o app roda sem redirecionar: dev, previews e os domínios da marca. */
export function isAllowedHost(host: string, live: boolean = BRAND.primaryDomainLive): boolean {
  const brandHosts = live
    ? apexAndWww(BRAND.domain)
    : [...apexAndWww(BRAND.legacyDomain), ...apexAndWww(BRAND.domain)]
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('lovableproject.com') ||
    host.includes('lovable.app') ||
    brandHosts.includes(host) ||
    // Temporário: domínio de fallback no Railway, enquanto o certificado do
    // domínio próprio não está ativo. Remover deste allowlist assim que o
    // certificado do domínio canônico estiver funcionando normalmente.
    host.endsWith('.up.railway.app')
  )
}

export function shouldRedirect(host: string, live: boolean = BRAND.primaryDomainLive): boolean {
  return !isAllowedHost(host, live)
}

/** Mesmo caminho, query e hash, só que no domínio canônico. */
export function buildTarget(
  loc: { pathname: string; search: string; hash: string },
  origin: string = CANONICAL_ORIGIN,
): string {
  return `${origin}${loc.pathname}${loc.search}${loc.hash}`
}
