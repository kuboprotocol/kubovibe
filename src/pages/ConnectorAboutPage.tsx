import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, KeyRound, LayoutDashboard, Loader2, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { getConnectorBySlug } from '@/lib/connectorsConfig'

const SCROLL_KEY_PREFIX = 'connector-about-scroll:'
const NAV_STATE_KEY_PREFIX = 'connector-about-nav:'
const DEFAULT_NAV_LOCK_MS = 600

type NavTarget = 'hub' | 'panel' | 'setup' | 'docs'

const NAV_LABELS: Record<NavTarget, string> = {
  hub: 'lista de conectores',
  panel: 'painel do conector',
  setup: 'setup do conector',
  docs: 'documentação oficial',
}

interface ConnectorAboutPageProps {
  navLockMs?: number
}

export default function ConnectorAboutPage({ navLockMs = DEFAULT_NAV_LOCK_MS }: ConnectorAboutPageProps = {}) {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const connector = getConnectorBySlug(slug)

  if (!connector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <p className="text-lg">Conector não encontrado</p>
          <Button onClick={() => navigate('/connectors')}>Voltar aos conectores</Button>
        </div>
      </div>
    )
  }

  const Icon = connector.icon
  const isComingSoon = connector.status === 'coming_soon'
  const scrollKey = `${SCROLL_KEY_PREFIX}${slug}`
  const navStateKey = `${NAV_STATE_KEY_PREFIX}${slug}`
  const location = useLocation()

  // Restore scroll on mount and whenever location key changes (popstate/forward)
  useEffect(() => {
    const saved = sessionStorage.getItem(scrollKey)
    if (saved) window.scrollTo({ top: parseInt(saved, 10), behavior: 'auto' })
  }, [scrollKey, location.key])

  useEffect(() => {
    const onScroll = () => sessionStorage.setItem(scrollKey, String(window.scrollY))
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [scrollKey])

  // Sync scroll on browser back/forward (popstate)
  useEffect(() => {
    const onPopState = () => {
      const saved = sessionStorage.getItem(scrollKey)
      if (saved) {
        requestAnimationFrame(() => window.scrollTo({ top: parseInt(saved, 10), behavior: 'auto' }))
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [scrollKey])

  const navLockRef = useRef(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Persisted loading state per slug (survives remount/popstate within timeout)
  const [navTarget, setNavTarget] = useState<NavTarget | null>(() => {
    try {
      const raw = sessionStorage.getItem(navStateKey)
      if (!raw) return null
      const { target, expiresAt } = JSON.parse(raw) as { target: NavTarget; expiresAt: number }
      if (Date.now() < expiresAt) return target
      sessionStorage.removeItem(navStateKey)
      return null
    } catch {
      return null
    }
  })
  const isNavigating = navTarget !== null
  const [announcement, setAnnouncement] = useState('')

  const clearNavState = useCallback(() => {
    navLockRef.current = false
    setNavTarget(null)
    sessionStorage.removeItem(navStateKey)
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current)
      lockTimerRef.current = null
    }
  }, [navStateKey])

  // Auto-expire persisted nav state
  useEffect(() => {
    if (!navTarget) return
    const raw = sessionStorage.getItem(navStateKey)
    let remaining = navLockMs
    if (raw) {
      try {
        const { expiresAt } = JSON.parse(raw) as { expiresAt: number }
        remaining = Math.max(0, expiresAt - Date.now())
      } catch {/* noop */}
    }
    navLockRef.current = true
    lockTimerRef.current = setTimeout(clearNavState, remaining)
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    }
  }, [navTarget, navStateKey, navLockMs, clearNavState])

  // Clear lock when route actually changes away
  useEffect(() => () => clearNavState(), [clearNavState])

  const beginNav = useCallback((target: NavTarget) => {
    if (navLockRef.current) return false
    navLockRef.current = true
    const expiresAt = Date.now() + navLockMs
    try {
      sessionStorage.setItem(navStateKey, JSON.stringify({ target, expiresAt }))
    } catch {/* noop */}
    sessionStorage.setItem(scrollKey, String(window.scrollY))
    setNavTarget(target)
    setAnnouncement(`Abrindo ${NAV_LABELS[target]}…`)
    return true
  }, [navLockMs, navStateKey, scrollKey])

  const safeNav = (target: NavTarget, fn: () => void) => {
    if (!beginNav(target)) return
    fn()
  }

  const goToPanel = () => safeNav('panel', () => navigate(`/connectors/${connector.slug}`))
  const goToHub = () => safeNav('hub', () => navigate('/connectors'))
  const handleStartSetup = () => {
    if (isComingSoon) return
    safeNav('setup', () => navigate(`/connectors/${connector.slug}/setup`))
  }
  const handleOpenDocs = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isNavigating) { e.preventDefault(); return }
    beginNav('docs')
  }

  // Block keyboard activation (Enter/Space) on links/buttons while navigating
  const blockKeyWhenBusy = (e: React.KeyboardEvent) => {
    if (!isNavigating) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const onBreadcrumbClick = (target: 'hub' | 'panel') => (e: React.MouseEvent) => {
    if (!beginNav(target)) { e.preventDefault() }
  }

  return (
    <div className="min-h-screen bg-background text-foreground" onKeyDownCapture={blockKeyWhenBusy}>
      {/* Live region for navigation announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goToHub} aria-label="Voltar para conectores" disabled={isNavigating} className="min-h-11 min-w-11">
            {navTarget === 'hub' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${connector.color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: connector.color }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold font-display truncate">{connector.name}</h1>
              <p className="text-xs text-muted-foreground truncate">
                Detalhes do conector · KUBO Vibe Dev
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" onClick={goToPanel} disabled={isNavigating}>
              {navTarget === 'panel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutDashboard className="h-4 w-4" />}
              {navTarget === 'panel' ? 'Abrindo…' : 'Painel do conector'}
            </Button>
            <Button onClick={handleStartSetup} disabled={isComingSoon || isNavigating}>
              {navTarget === 'setup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isComingSoon ? 'Em breve' : navTarget === 'setup' ? 'Abrindo…' : 'Iniciar setup'}
              {!isComingSoon && navTarget !== 'setup' && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Breadcrumbs — synced with router */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to="/connectors"
                  onClick={onBreadcrumbClick('hub')}
                  onKeyDown={blockKeyWhenBusy}
                  aria-busy={navTarget === 'hub'}
                  aria-disabled={isNavigating && navTarget !== 'hub'}
                  tabIndex={isNavigating && navTarget !== 'hub' ? -1 : 0}
                  className="inline-flex items-center gap-1.5"
                >
                  {navTarget === 'hub' && <Loader2 className="h-3 w-3 animate-spin" />}
                  Conectores
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to={`/connectors/${connector.slug}`}
                  onClick={onBreadcrumbClick('panel')}
                  aria-busy={navTarget === 'panel'}
                  className="inline-flex items-center gap-1.5"
                >
                  {navTarget === 'panel' && <Loader2 className="h-3 w-3 animate-spin" />}
                  Painel do conector
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage aria-current="page">Sobre</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-4xl mx-auto px-4 py-8 space-y-6"
      >
        {/* Hero */}
        <Card className="p-6 sm:p-8 relative overflow-hidden border-primary/20">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              background: `radial-gradient(600px circle at 0% 0%, ${connector.color}, transparent 60%)`,
            }}
          />
          <div className="relative space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {connector.category}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {connector.authType.replace('_', ' ')}
              </Badge>
              {isComingSoon && (
                <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display">
              Conecte {connector.name} ao seu workspace
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              {connector.longDescription}
            </p>
            <div className="flex gap-3 flex-wrap pt-2">
              <Button onClick={handleStartSetup} disabled={isComingSoon || isNavigating} size="lg">
                {navTarget === 'setup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isComingSoon ? 'Em breve' : navTarget === 'setup' ? 'Abrindo…' : 'Iniciar setup'}
                {!isComingSoon && navTarget !== 'setup' && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={goToPanel}
                disabled={isNavigating}
              >
                {navTarget === 'panel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutDashboard className="h-4 w-4" />}
                {navTarget === 'panel' ? 'Abrindo…' : 'Painel do conector'}
              </Button>
              {connector.docsUrl && (
                <Button asChild variant="outline" size="lg">
                  <a href={connector.docsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Documentação oficial
                  </a>
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Features */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Recursos disponíveis</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {connector.features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/30"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Setup steps */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Como funciona o setup</h3>
          </div>
          <ol className="space-y-3">
            {connector.setupSteps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          {connector.apiKeyDocsUrl && (
            <a
              href={connector.apiKeyDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Abrir página de credenciais do {connector.name}
              <ExternalLink className="h-3 w-3" />
              <span className="text-muted-foreground">(site externo)</span>
            </a>
          )}
        </Card>

        {/* Security */}
        <Card className="p-6 space-y-3 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold">Segurança</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua chave é cifrada com <strong>AES-256-GCM</strong> antes de ser persistida e nunca é
            devolvida em claro ao navegador. Apenas as edge functions da KUBO podem descifrar para
            executar ações em seu nome.
          </p>
        </Card>

        {/* Footer shortcuts */}
        <nav aria-label="Navegação relacionada" className="pt-2 pb-4 border-t border-border/50 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm">
            <button
              type="button"
              onClick={goToHub}
              disabled={isNavigating}
              aria-busy={navTarget === 'hub'}
              className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 min-h-11 disabled:opacity-60"
            >
              {navTarget === 'hub' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
              {navTarget === 'hub' ? 'Abrindo…' : 'Todos os conectores'}
            </button>
            <button
              type="button"
              onClick={goToPanel}
              disabled={isNavigating}
              aria-busy={navTarget === 'panel'}
              className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium min-h-11 disabled:opacity-60"
            >
              {navTarget === 'panel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutDashboard className="h-4 w-4" />}
              {navTarget === 'panel' ? 'Abrindo painel…' : 'Ir para o painel do conector'}
              {navTarget !== 'panel' && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        {/* Sticky bottom CTA on mobile */}
        <div className="sticky bottom-4 sm:hidden flex items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 min-h-11"
            onClick={goToPanel}
            disabled={isNavigating}
            aria-label="Abrir painel do conector"
            aria-busy={navTarget === 'panel'}
          >
            {navTarget === 'panel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutDashboard className="h-4 w-4" />}
            {navTarget === 'panel' ? 'Abrindo…' : 'Painel'}
          </Button>
          <Button
            onClick={handleStartSetup}
            disabled={isComingSoon || isNavigating}
            size="lg"
            className="flex-1 shadow-glow min-h-11"
            aria-label={isComingSoon ? 'Em breve' : 'Iniciar setup do conector'}
            aria-busy={navTarget === 'setup'}
          >
            {navTarget === 'setup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isComingSoon ? 'Em breve' : navTarget === 'setup' ? 'Abrindo…' : 'Setup'}
            {!isComingSoon && navTarget !== 'setup' && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
