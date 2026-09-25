/**
 * Identidade da marca num único lugar. Para renomear o produto, altere só
 * este arquivo (e `index.html` / manifesto PWA em `vite.config.ts`, que são
 * lidos antes do bundle e por isso repetem os valores).
 *
 * O domínio canônico continua em `src/lib/canonicalRedirect.ts` até o novo
 * domínio (vertal.dev) estar registrado e respondendo — trocar antes disso
 * derrubaria o site.
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
} as const

export const APP_NAME = BRAND.appName
