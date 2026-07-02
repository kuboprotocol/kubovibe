import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Loader2, Sparkles, Crown, Zap, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { getPlanConfig, PLAN_CONFIG } from '@/lib/planConfig'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import Navbar from '@/components/landing/Navbar'
import { cn } from '@/lib/utils'

type Period = 'monthly' | 'annual' | 'lifetime'

const ESSENTIALS = ['free', 'starter', 'pro', 'premium_1', 'premium_2']
const BUSINESS = ['business_1', 'business_2', 'business_3', 'business_4', 'business_5', 'business_6', 'business_7']

const BADGES: Record<string, { label: string; tone: 'popular' | 'value' }> = {
  pro: { label: '⭐ Mais Popular', tone: 'popular' },
  business_2: { label: '🔥 Melhor Custo-Benefício', tone: 'value' },
}

function priceFor(monthly: number, period: Period): { display: string; suffix: string } {
  if (monthly === 0) return { display: '$0', suffix: '/ para sempre' }
  if (period === 'monthly') return { display: `$${monthly.toFixed(2)}`, suffix: '/ mês' }
  if (period === 'annual') {
    const yearly = monthly * 12 * 0.8
    return { display: `$${yearly.toFixed(2)}`, suffix: '/ ano' }
  }
  return { display: `$${(monthly * 6).toFixed(2)}`, suffix: 'pagamento único' }
}

function featuresFor(plan: string): string[] {
  const cfg = getPlanConfig(plan)
  const feats: string[] = []
  if (plan === 'free') {
    feats.push(`✓ ${cfg.signupCredits} créditos no cadastro (1x)`)
  } else {
    feats.push(`✓ ${cfg.dailyCredits} créditos por dia`)
  }
  feats.push('✓ 10 shortlinks/dia (+9.5 créditos)')
  if (cfg.adFrequencyHours === null) {
    feats.push('✓ Sem anúncios interruptivos')
  } else {
    feats.push(`✓ Anúncios a cada ${cfg.adFrequencyHours}h`)
  }
  feats.push('✓ TERRA ADS Smartlink incluso')
  if (['pro', 'premium_1', 'premium_2'].includes(plan) || plan.startsWith('business') || plan === 'enterprise') {
    feats.push('✓ Suporte por email')
  }
  if (plan.startsWith('business') || plan === 'enterprise') {
    feats.push('✓ Suporte prioritário')
    feats.push('✓ Acordo de parceria KUBO')
  }
  const tierNum = Number(plan.replace('business_', '')) || 0
  if (tierNum >= 3 || plan === 'enterprise') feats.push('✓ API Access')
  if (tierNum >= 5 || plan === 'enterprise') feats.push('✓ SLA garantido')
  if (tierNum >= 7 || plan === 'enterprise') feats.push('✓ Manager dedicado')
  return feats
}

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

interface PlanCardProps {
  plan: string
  period: Period
  currentPlan?: string
  loadingPlan: string | null
  onCheckout: (plan: string) => void
  onFree: () => void
  variant?: 'default' | 'gold'
}

function PlanCard({ plan, period, currentPlan, loadingPlan, onCheckout, onFree, variant = 'default' }: PlanCardProps) {
  const cfg = getPlanConfig(plan)
  const badge = BADGES[plan]
  const price = priceFor(cfg.priceUsd, period)
  const isCurrent = currentPlan === plan
  const isFree = plan === 'free'
  const loading = loadingPlan === plan
  const isGold = variant === 'gold'
  const isPopular = badge?.tone === 'popular'

  return (
    <motion.div
      variants={itemAnim}
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-6 backdrop-blur-xl transition-all',
        'bg-card/40 border-border/60 hover:border-primary/40 hover:-translate-y-1',
        isGold && 'bg-gradient-to-b from-primary/10 to-card/40 border-primary/30',
        isPopular && 'ring-2 ring-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)]',
      )}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            className={cn(
              'px-3 py-1 text-xs font-semibold whitespace-nowrap',
              badge.tone === 'popular' && 'bg-primary text-primary-foreground',
              badge.tone === 'value' && 'bg-emerald-500 text-white',
            )}
          >
            {badge.label}
          </Badge>
        </div>
      )}
      {isGold && (
        <Crown className="absolute top-4 right-4 h-4 w-4 text-primary/60" aria-hidden />
      )}

      <div className="mb-4">
        <h3 className="font-display text-xl font-bold tracking-tight">{cfg.displayName}</h3>
        <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
          {isFree ? 'Comece grátis' : isGold ? 'Business Tier' : 'Plano essencial'}
        </p>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-bold">{price.display}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{price.suffix}</p>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5 text-sm">
        {featuresFor(plan).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-foreground/85">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{f.replace(/^✓\s*/, '')}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <Button disabled variant="secondary" className="w-full">
          Plano atual
        </Button>
      ) : isFree ? (
        <Button onClick={onFree} variant="outline" className="w-full">
          Começar Grátis
        </Button>
      ) : (
        <Button
          onClick={() => onCheckout(plan)}
          disabled={loading}
          className={cn('w-full', isGold && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecionando…
            </>
          ) : (
            <>Assinar com Stripe <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      )}
    </motion.div>
  )
}

export default function PricingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { subscription } = useSubscription()
  const [period, setPeriod] = useState<Period>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const currentPlan = subscription?.plan

  const handleStripeCheckout = async (plan: string) => {
    if (!user) {
      navigate('/auth')
      return
    }
    setLoadingPlan(plan)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan, period },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (error) throw error
      if (data?.url) window.open(data.url, '_blank')
    } catch {
      toast.error('Erro ao iniciar checkout. Tente novamente.')
    } finally {
      setLoadingPlan(null)
    }
  }

  const enterpriseCfg = useMemo(() => getPlanConfig('enterprise'), [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge variant="outline" className="mb-5 border-primary/30 bg-primary/5 text-primary uppercase tracking-widest">
            <Sparkles className="mr-1.5 h-3 w-3" /> KUBO Protocol · Planos e Preços
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Escolha o plano ideal
            <span className="block bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              para o seu crescimento
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Desde criadores individuais até grandes empresas — temos o plano certo para você escalar com IA.
          </p>

          {/* Toggle */}
          <div className="mt-9 inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 p-1 backdrop-blur-xl">
            {(['monthly', 'annual', 'lifetime'] as Period[]).map((p) => {
              const active = period === p
              const label = p === 'monthly' ? 'Mensal' : p === 'annual' ? 'Anual' : 'Lifetime'
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'relative rounded-full px-5 py-2 text-sm font-medium transition-all',
                    active ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  {p === 'annual' && (
                    <span className="ml-2 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                      -20%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {period === 'annual' && (
            <p className="mt-3 text-xs text-emerald-400">Economize 20% pagando anualmente</p>
          )}
          {period === 'lifetime' && (
            <p className="mt-3 text-xs text-primary">Pagamento único · sem recorrência</p>
          )}
        </motion.section>

        {/* Grupo 1 — Essenciais */}
        <motion.section
          variants={containerAnim}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-16"
        >
          <div className="mb-8 flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">Planos Essenciais</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {ESSENTIALS.map((plan) => (
              <PlanCard
                key={plan}
                plan={plan}
                period={period}
                currentPlan={currentPlan}
                loadingPlan={loadingPlan}
                onCheckout={handleStripeCheckout}
                onFree={() => navigate('/auth')}
              />
            ))}
          </div>
        </motion.section>

        {/* Grupo 2 — Business */}
        <motion.section
          variants={containerAnim}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-20"
        >
          <div className="mb-8 flex items-center gap-3">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">Planos Business</h2>
            <Badge variant="outline" className="border-primary/30 text-primary">Parceria KUBO</Badge>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BUSINESS.map((plan) => (
              <PlanCard
                key={plan}
                plan={plan}
                period={period}
                currentPlan={currentPlan}
                loadingPlan={loadingPlan}
                onCheckout={handleStripeCheckout}
                onFree={() => {}}
                variant="gold"
              />
            ))}
          </div>
        </motion.section>

        {/* Grupo 3 — Enterprise */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-20"
        >
          <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-8 backdrop-blur-xl md:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.25),transparent_60%)]" aria-hidden />
            <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <Badge className="mb-4 bg-primary/20 text-primary border-primary/40">
                  <Crown className="mr-1.5 h-3 w-3" /> Enterprise
                </Badge>
                <h3 className="font-display text-3xl font-bold sm:text-4xl">Sob consulta</h3>
                <p className="mt-3 text-muted-foreground">
                  Solução personalizada para grandes empresas com necessidades específicas de escala, segurança e integração.
                </p>
                <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    `${enterpriseCfg.dailyCredits} créditos por dia`,
                    'API Access completo',
                    'SLA garantido',
                    'Manager dedicado',
                    'Onboarding personalizado',
                    'Acordo de parceria KUBO',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-start gap-4 md:items-end">
                <a href="mailto:contato@kuboprotocol.com" className="w-full md:w-auto">
                  <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto">
                    Falar com nossa equipe <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground">Resposta em até 24h úteis</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Comparação */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24"
        >
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-bold">Compare os principais recursos</h2>
            <p className="mt-2 text-muted-foreground">Visão rápida do que muda entre os tiers</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-background/30">
                <tr>
                  <th className="p-4 text-left font-semibold">Feature</th>
                  <th className="p-4 text-center font-semibold">Free</th>
                  <th className="p-4 text-center font-semibold text-primary">Pro</th>
                  <th className="p-4 text-center font-semibold">Business 1</th>
                  <th className="p-4 text-center font-semibold text-primary">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  ['Créditos/dia', '5 (1x)', '5', '12', '1.200'],
                  ['Shortlinks/dia', '10', '10', '10', '10'],
                  ['Anúncios', '6h', '24h', 'Sem', 'Sem'],
                  ['Suporte', '—', 'Email', 'Prioritário', 'Dedicado'],
                  ['API', '—', '—', '—', '✓'],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i} className={cn('p-4', i === 0 ? 'text-left font-medium' : 'text-center text-muted-foreground')}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24"
        >
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-bold">Perguntas frequentes</h2>
          </div>
          <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card/40 p-2 backdrop-blur-xl">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger className="px-4 text-left">O que são créditos na KUBO Vibe?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">
                  Créditos são a moeda interna que alimenta gerações de IA, deploys e ações premium. Cada plano oferece um volume diário, e você pode acumular créditos extras completando shortlinks e convidando amigos.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger className="px-4 text-left">Posso cancelar a qualquer momento?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">
                  Sim. Todos os planos recorrentes podem ser cancelados a qualquer momento diretamente no portal do Stripe. Você continua com acesso até o fim do ciclo já pago.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger className="px-4 text-left">O que são os shortlinks e como ganho créditos?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">
                  Todo dia você pode completar até 10 shortlinks TERRA ADS na página /shortlinks. Cada um libera +0,5 crédito e o 10º libera +5 bônus, totalizando +9,5 créditos por dia.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger className="px-4 text-left">O que é o Acordo de Parceria Business?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">
                  Nos planos Business e Enterprise, assinamos um acordo de parceria KUBO que garante suporte prioritário, SLA, integrações customizadas e coexpansão de casos de uso.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger className="px-4 text-left">Como funciona o plano Lifetime?</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">
                  O Lifetime é um pagamento único equivalente a 6 meses do plano escolhido, garantindo acesso vitalício aos créditos e recursos daquele tier sem cobranças recorrentes.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </motion.section>

        {/* CTA final */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Tem dúvidas? Escreva para{' '}
            <a href="mailto:contato@kuboprotocol.com" className="text-primary hover:underline">
              contato@kuboprotocol.com
            </a>{' '}
            — respondemos em até 24h.
          </p>
          {/* Sanity check: ensure PLAN_CONFIG keys used above still exist */}
          <span className="sr-only">{Object.keys(PLAN_CONFIG).join(',')}</span>
        </motion.section>
      </main>
    </div>
  )
}
