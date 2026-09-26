import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import Navbar from '@/components/landing/Navbar'
import { Button } from '@/components/ui/button'
import { APP_NAME, BRAND } from '@/config/brand'
import {
  ALTERNATIVES,
  CATEGORY_LABEL,
  VERTAL_FEATURES,
  findAlternative,
  type Alternative,
  type AlternativeCategory,
} from '@/config/alternatives'
import { usePageSeo } from '@/hooks/usePageSeo'

function TrademarkNotice() {
  return (
    <p className="mt-12 text-xs text-muted-foreground/70 leading-relaxed">
      Todas as marcas citadas pertencem aos respectivos donos. O {APP_NAME} não tem
      afiliação com essas empresas; as descrições são informativas e podem mudar com o tempo.
    </p>
  )
}

function StartCta() {
  const navigate = useNavigate()
  return (
    <Button size="lg" className="rounded-xl" onClick={() => navigate('/auth')}>
      Começar grátis no {APP_NAME} <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  )
}

function AlternativesIndex() {
  usePageSeo({
    title: `Alternativas: ${APP_NAME} vs Lovable, Bolt, Replit, Cursor e mais`,
    description: `Compare o ${APP_NAME} com Lovable, Bolt.new, Replit, Bubble, Cursor, Trae, Vercel, Railway, Cloudflare e Render. Crie apps com IA, backend e Web3 em um só lugar.`,
    path: '/alternativas',
  })

  const categories = Object.keys(CATEGORY_LABEL) as AlternativeCategory[]
  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          {APP_NAME} e as outras ferramentas
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Procurando Lovable, Bolt, Replit, Cursor ou uma hospedagem como Vercel e Railway?
          Veja onde o {APP_NAME} se encaixa e quando ele é a melhor escolha.
        </p>
      </header>

      {categories.map((cat) => {
        const items = ALTERNATIVES.filter((a) => a.category === cat)
        if (!items.length) return null
        return (
          <section key={cat} className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((a) => (
                <Link
                  key={a.slug}
                  to={`/alternativas/${a.slug}`}
                  className="group rounded-2xl border border-border bg-card/50 p-5 transition-colors hover:border-primary/60"
                >
                  <p className="font-semibold group-hover:text-primary">
                    {a.category === 'concept' ? `${a.name} com o ${APP_NAME}` : `${APP_NAME} vs ${a.name}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      <StartCta />
      <TrademarkNotice />
    </>
  )
}

function AlternativeDetail({ alt }: { alt: Alternative }) {
  const isConcept = alt.category === 'concept'
  const title = isConcept
    ? `${alt.name}: crie apps com IA no ${APP_NAME}`
    : `Alternativa ao ${alt.name}: ${APP_NAME} vs ${alt.name}`
  usePageSeo({
    title,
    description: `${alt.summary} Veja quando o ${APP_NAME} (${BRAND.domain}) é a melhor escolha: IA, backend, Web3 e domínio em um só lugar.`,
    path: `/alternativas/${alt.slug}`,
  })

  return (
    <>
      <Link to="/alternativas" className="text-sm text-muted-foreground hover:text-foreground">
        ← Todas as comparações
      </Link>
      <h1 className="mt-4 text-3xl md:text-5xl font-display font-bold tracking-tight">{title}</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{isConcept ? `O que é ${alt.name}` : `O que é o ${alt.name}`}</h2>
        <p className="mt-2 text-muted-foreground">{alt.summary}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Quando escolher o {APP_NAME}</h2>
        <ul className="mt-3 space-y-2">
          {alt.whyVertal.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {alt.together && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Usando os dois juntos</h2>
          <p className="mt-2 text-muted-foreground">{alt.together}</p>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
        <h2 className="text-xl font-semibold">O que vem no {APP_NAME}</h2>
        <ul className="mt-3 space-y-2">
          {VERTAL_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <StartCta />
        </div>
      </section>

      <TrademarkNotice />
    </>
  )
}

export default function AlternativesPage() {
  const { slug } = useParams<{ slug?: string }>()
  const alt = findAlternative(slug)
  if (slug && !alt) return <Navigate to="/alternativas" replace />

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {alt ? <AlternativeDetail alt={alt} /> : <AlternativesIndex />}
      </main>
    </div>
  )
}
