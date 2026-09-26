/**
 * Vite plugin: SEO a partir de `src/config/brand.ts`.
 *
 * - `index.html`: substitui `%SITE_ORIGIN%` (canonical, og:url, JSON-LD) pela
 *   origem canônica do site.
 * - build: gera `sitemap.xml` (páginas públicas + /alternativas/*) e
 *   `robots.txt` apontando para o sitemap.
 *
 * Assim a troca de domínio (`BRAND.primaryDomainLive`) muda todo o SEO de uma vez.
 */
import type { Plugin } from "vite";
import { SITE_ORIGIN } from "../src/config/brand";
import { ALTERNATIVES } from "../src/config/alternatives";

/** Rotas públicas indexáveis (sem login). */
const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/alternativas",
  "/download",
  "/docs",
  "/support",
  "/anywhere",
  "/terms",
  "/privacy",
];

export function sitemapUrls(origin: string = SITE_ORIGIN): string[] {
  const paths = [
    ...PUBLIC_ROUTES,
    ...ALTERNATIVES.map((a) => `/alternativas/${a.slug}`),
  ];
  return paths.map((p) => `${origin}${p === "/" ? "/" : p}`);
}

export function renderSitemap(origin: string = SITE_ORIGIN): string {
  const urls = sitemapUrls(origin)
    .map((loc) => `  <url><loc>${loc}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(origin: string = SITE_ORIGIN): string {
  return `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function seoPlugin(): Plugin {
  return {
    name: "vertal-seo",
    // "pre" roda antes da substituição de %ENV% do próprio Vite, que avisaria
    // sobre %SITE_ORIGIN% por não ser variável de ambiente.
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.split("%SITE_ORIGIN%").join(SITE_ORIGIN),
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: renderSitemap() });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: renderRobots() });
    },
  };
}
