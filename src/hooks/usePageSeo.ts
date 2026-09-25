import { useEffect } from 'react'
import { SITE_ORIGIN } from '@/config/brand'

interface PageSeo {
  title: string
  description: string
  /** Caminho da página, ex.: "/alternativas/lovable". */
  path: string
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Título, descrição e canonical por página (SPA). O domínio vem de
 * `SITE_ORIGIN`, então segue a troca de domínio de `src/config/brand.ts`.
 */
export function usePageSeo({ title, description, path }: PageSeo) {
  useEffect(() => {
    const url = `${SITE_ORIGIN}${path}`
    const prevTitle = document.title
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    const prevCanonical = canonical.href
    canonical.href = url

    return () => {
      document.title = prevTitle
      if (canonical) canonical.href = prevCanonical
    }
  }, [title, description, path])
}
