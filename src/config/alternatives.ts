/**
 * Páginas "Alternativa a X" / "Vertal vs X" (rotas /alternativas e
 * /alternativas/:slug). Servem para quem pesquisa por outras ferramentas
 * encontrar o Vertal com uma comparação honesta.
 *
 * Regras de conteúdo (uso nominativo de marca):
 * - descrever o outro produto de forma neutra e factual, sem depreciar;
 * - listar só recursos do Vertal que existem de fato no produto;
 * - manter o aviso de que as marcas pertencem aos respectivos donos.
 */

export type AlternativeCategory = 'builder' | 'editor' | 'hosting' | 'concept'

export interface Alternative {
  slug: string
  /** Nome do produto como o dono o escreve. */
  name: string
  category: AlternativeCategory
  /** Descrição neutra do outro produto. */
  summary: string
  /** Em que situação o Vertal é a melhor escolha. */
  whyVertal: string[]
  /** Quando faz sentido usar os dois juntos (ex.: hospedagem). */
  together?: string
}

export const CATEGORY_LABEL: Record<AlternativeCategory, string> = {
  builder: 'Construtores de apps com IA',
  editor: 'Editores de código com IA',
  hosting: 'Hospedagem e deploy',
  concept: 'Conceitos',
}

/** Recursos do Vertal usados nas comparações. */
export const VERTAL_FEATURES = [
  'Descreva o app em linguagem natural e a IA gera o código (React + Vite + Tailwind)',
  'Backend pronto com banco Postgres, autenticação e funções serverless',
  'Web3 nativo: carteiras, tokens e contratos inteligentes',
  'Integração com GitHub, Gmail, Slack e conectores próprios',
  'Agente local (Windows, macOS e Linux) e extensão para VS Code',
  'Registro de domínios e deploy a partir do mesmo painel',
  'Créditos transparentes, com plano gratuito para começar',
]

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'lovable',
    name: 'Lovable',
    category: 'builder',
    summary: 'Lovable é um construtor de aplicações web com IA: você descreve o app em linguagem natural e ele gera o projeto.',
    whyVertal: [
      'Você quer Web3 (carteiras, tokens, contratos) integrado desde o início',
      'Você quer créditos transparentes e um agente local no seu computador',
      'Você quer conectores (GitHub, Gmail, Slack) e domínio no mesmo lugar',
    ],
  },
  {
    slug: 'bolt',
    name: 'Bolt.new',
    category: 'builder',
    summary: 'Bolt.new, da StackBlitz, gera e executa aplicações full-stack direto no navegador a partir de um prompt.',
    whyVertal: [
      'Você precisa de backend com banco, autenticação e funções já configurados',
      'Você quer publicar com domínio próprio e acompanhar tudo num painel',
      'Você quer recursos Web3 prontos para usar',
    ],
  },
  {
    slug: 'replit',
    name: 'Replit',
    category: 'builder',
    summary: 'Replit é um ambiente de desenvolvimento online com agente de IA, execução de código e hospedagem.',
    whyVertal: [
      'Você não programa e quer criar o app só descrevendo o que precisa',
      'Você quer Web3 e conectores de negócio sem configurar nada',
      'Você quer rodar agentes no seu computador pelo agente local',
    ],
  },
  {
    slug: 'bubble',
    name: 'Bubble',
    category: 'builder',
    summary: 'Bubble é uma plataforma no-code visual para construir aplicações web arrastando componentes.',
    whyVertal: [
      'Você quer que a IA construa por você, em vez de montar tela por tela',
      'Você quer ser dono do código gerado e poder levá-lo para o GitHub',
      'Você quer recursos Web3 nativos',
    ],
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    category: 'editor',
    summary: 'Cursor é um editor de código com IA, baseado no VS Code, voltado para desenvolvedores.',
    whyVertal: [
      'Você não quer instalar nem operar um editor de código',
      'Você quer o app publicado, com backend e domínio, sem sair do navegador',
      'Se você já usa um editor, a extensão do Vertal para VS Code conecta os dois',
    ],
  },
  {
    slug: 'trae',
    name: 'Trae',
    category: 'editor',
    summary: 'Trae é um editor de código com IA voltado para desenvolvedores.',
    whyVertal: [
      'Você quer criar apps completos sem escrever código',
      'Você quer backend, Web3 e deploy integrados',
      'Você quer acompanhar custos por créditos num único painel',
    ],
  },
  {
    slug: 'vercel',
    name: 'Vercel',
    category: 'hosting',
    summary: 'Vercel é uma plataforma de deploy e hospedagem para aplicações web, conhecida pelo Next.js.',
    whyVertal: [
      'Você ainda não tem o app: o Vertal cria e publica',
      'Você quer backend, banco e autenticação sem montar a infraestrutura',
    ],
    together: 'O código gerado pelo Vertal é um projeto padrão e pode ser hospedado também na Vercel.',
  },
  {
    slug: 'railway',
    name: 'Railway',
    category: 'hosting',
    summary: 'Railway é uma plataforma para fazer deploy de aplicações, bancos de dados e serviços.',
    whyVertal: [
      'Você quer criar o app antes de pensar em infraestrutura',
      'Você quer IA, Web3 e conectores prontos',
    ],
    together: 'O Vertal pode publicar seu app em infraestruturas como a Railway.',
  },
  {
    slug: 'cloudflare',
    name: 'Cloudflare',
    category: 'hosting',
    summary: 'Cloudflare oferece rede global, DNS, segurança e hospedagem na borda (Workers e Pages).',
    whyVertal: [
      'Você quer o app criado por IA, não só a infraestrutura',
      'Você quer backend e Web3 integrados sem configurar serviços',
    ],
    together: 'Domínios e DNS na Cloudflare funcionam normalmente com apps do Vertal.',
  },
  {
    slug: 'render',
    name: 'Render',
    category: 'hosting',
    summary: 'Render é uma plataforma de hospedagem para aplicações web, APIs e bancos de dados.',
    whyVertal: [
      'Você quer ir da ideia ao app publicado sem montar a infraestrutura',
      'Você quer IA, Web3 e conectores prontos',
    ],
    together: 'O código gerado pelo Vertal pode ser hospedado também na Render.',
  },
  {
    slug: 'vibe-coding',
    name: 'Vibe coding',
    category: 'concept',
    summary: 'Vibe coding é criar software descrevendo o que você quer em linguagem natural e deixando a IA escrever o código.',
    whyVertal: [
      'O Vertal é uma plataforma de vibe coding completa: da ideia ao app publicado',
      'Backend, Web3 e domínio no mesmo lugar',
    ],
  },
]

export function findAlternative(slug: string | undefined): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug)
}
