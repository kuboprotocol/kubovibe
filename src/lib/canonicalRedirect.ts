/**
 * Regra do redirect para o domínio canônico (kubovibe.dev), usada no
 * bootstrap em `src/App.tsx`. Fica num módulo próprio para que o teste
 * (`src/test/canonical-domain-redirect.test.ts`) exercite a regra real, e
 * não uma cópia que pode ficar desatualizada.
 */

export const CANONICAL_ORIGIN = 'https://kubovibe.dev'

/** Hosts onde o app roda sem redirecionar: dev, previews e o próprio canônico. */
export function isAllowedHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('lovableproject.com') ||
    host.includes('lovable.app') ||
    host === 'kubovibe.dev' ||
    host === 'www.kubovibe.dev' ||
    // Temporário: domínio de fallback no Railway, enquanto o certificado do
    // kubovibe.dev está bloqueado por pendência de pagamento na conta Railway
    // (ver histórico do projeto). Remover deste allowlist assim que o
    // certificado do domínio próprio voltar a funcionar normalmente.
    host.endsWith('.up.railway.app')
  )
}

export function shouldRedirect(host: string): boolean {
  return !isAllowedHost(host)
}

/** Mesmo caminho, query e hash, só que no domínio canônico. */
export function buildTarget(loc: { pathname: string; search: string; hash: string }): string {
  return `${CANONICAL_ORIGIN}${loc.pathname}${loc.search}${loc.hash}`
}
