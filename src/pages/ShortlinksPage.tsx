import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Gift, ExternalLink, Check, Clock, Zap, Play, Film, Send, Wallet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe.png'

const DAILY_LINK_LIMIT = 10
const DAILY_AD_LIMIT = 2

interface Shortlink {
  id: string
  slug: string
  title: string
  destination_url: string
  reward_credits: number
  wait_seconds: number
}

export default function ShortlinksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [links, setLinks] = useState<Shortlink[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [todayCount, setTodayCount] = useState(0)
  const [activeLink, setActiveLink] = useState<Shortlink | null>(null)
  const [activeClickId, setActiveClickId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adCount, setAdCount] = useState(0)
  const [watchingAd, setWatchingAd] = useState(false)
  const [adCountdown, setAdCountdown] = useState(0)

  const fetchData = useCallback(async () => {
    if (!user) return

    const { data: linksData } = await supabase
      .from('shortlinks' as any)
      .select('*')
      .eq('is_active', true)
      .limit(10)

    setLinks((linksData as any[]) || [])

    // Count today's completed clicks
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count, data: clicksData } = await supabase
      .from('shortlink_clicks' as any)
      .select('shortlink_id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('clicked_at', todayStart.toISOString())

    setTodayCount(count || 0)
    setCompletedIds(new Set((clicksData as any[] || []).map((c: any) => c.shortlink_id)))

    // Count today's ad rewards
    const { count: adsDone } = await supabase
      .from('ad_rewards' as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())

    setAdCount(adsDone || 0)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const startLink = async (link: Shortlink) => {
    if (!user) { navigate('/auth'); return }
    if (todayCount >= DAILY_LINK_LIMIT) {
      toast.info('Limite diário atingido! Volte amanhã 🌅')
      return
    }

    // Check if already clicked this link today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { data: existing } = await supabase
      .from('shortlink_clicks' as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('shortlink_id', link.id)
      .gte('clicked_at', todayStart.toISOString())
      .limit(1)

    if (existing && existing.length > 0) {
      toast.info('Você já visitou este link hoje!')
      return
    }

    // Register click
    const { data: click, error } = await supabase
      .from('shortlink_clicks' as any)
      .insert({
        user_id: user.id,
        shortlink_id: link.id,
        completed: false,
        reward_credited: 0,
      } as any)
      .select('id')
      .single()

    if (error) {
      toast.error('Erro ao registrar clique')
      return
    }

    setActiveLink(link)
    setActiveClickId((click as any).id)
    setCountdown(link.wait_seconds)
  }

  const completeLink = async () => {
    if (!activeClickId || !activeLink) return
    setCompleting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('complete-shortlink', {
        body: { click_id: activeClickId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (res.error) throw new Error(res.error.message)

      toast.success(`+${activeLink.reward_credits} crédito(s) ganho(s)! 🎉`)
      setTodayCount(c => c + 1)
      setActiveLink(null)
      setActiveClickId(null)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao completar')
    } finally {
      setCompleting(false)
    }
  }

  // Ad countdown timer
  useEffect(() => {
    if (adCountdown <= 0) return
    const t = setTimeout(() => setAdCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [adCountdown])

  const watchAd = async () => {
    if (!user) return
    if (adCount >= DAILY_AD_LIMIT) {
      toast.info('Limite de anúncios atingido hoje!')
      return
    }
    setWatchingAd(true)
    setAdCountdown(10)
  }

  const completeAd = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('unity-ad-reward', {
        body: { reward_type: 'completed' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      toast.success('+0.5 crédito por assistir anúncio! 🎬')
      setAdCount(c => c + 1)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao creditar anúncio')
    } finally {
      setWatchingAd(false)
      setAdCountdown(0)
    }
  }

  const creditsEarned = (todayCount * 0.5) + (adCount * 0.5)
  const progressPercent = (todayCount / DAILY_LINK_LIMIT) * 100

  if (!user) {
    navigate('/auth')
    return null
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoImg} alt="KUBO VIBE" className="h-8" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">{todayCount}/{DAILY_LINK_LIMIT} hoje</span>
            <span className="text-primary font-bold">+{creditsEarned} créditos</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* Credit Wallet Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="glass glass-border rounded-2xl p-5 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-foreground text-lg">💰 Ganhar Créditos</h2>
                <p className="text-sm text-muted-foreground">Até +6 créditos por dia (10 links + 2 anúncios)</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-display font-bold text-primary">+{creditsEarned.toFixed(1)}</div>
                <span className="text-xs text-muted-foreground">ganhos hoje</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="glass glass-border rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progresso diário</span>
            <span className="text-sm font-bold text-primary">{todayCount}/{DAILY_LINK_LIMIT} links</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          {todayCount >= DAILY_LINK_LIMIT && (
            <p className="text-xs text-primary mt-2 text-center">🎉 Parabéns! Limite diário atingido! Volte amanhã.</p>
          )}
        </div>

        {/* Active link (wait screen) */}
        <AnimatePresence>
          {activeLink && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass glass-border rounded-2xl p-6 mb-6 border-primary/30 ring-2 ring-primary/20"
            >
              <div className="text-center">
                <Clock className="h-10 w-10 text-primary mx-auto mb-3 animate-pulse" />
                <h3 className="font-display font-bold text-foreground text-lg mb-1">{activeLink.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">Aguarde para ganhar seu crédito...</p>

                {countdown > 0 ? (
                  <div className="mb-4">
                    <div className="text-4xl font-display font-bold text-primary mb-2">{countdown}s</div>
                    <Progress value={((activeLink.wait_seconds - countdown) / activeLink.wait_seconds) * 100} className="h-2 max-w-xs mx-auto" />
                  </div>
                ) : (
                  <Button
                    variant="hero"
                    className="h-12 px-8 rounded-xl text-sm font-semibold"
                    onClick={completeLink}
                    disabled={completing}
                  >
                    {completing ? 'Creditando...' : `✅ Resgatar +${activeLink.reward_credits} crédito(s)`}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Links grid */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Carregando links...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {links.map((link, i) => {
              const isDone = completedIds.has(link.id)
              return (
              <motion.div
                key={link.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={`glass glass-border rounded-xl p-4 transition-all duration-200 ${isDone ? 'opacity-60' : 'hover:scale-[1.02]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isDone ? 'bg-green-500/20' : 'bg-primary/10'}`}>
                        {isDone ? <Check className="h-5 w-5 text-green-500" /> : link.title.split(' ')[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{link.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {isDone ? '✅ Concluído hoje' : `+${link.reward_credits} crédito • ${link.wait_seconds}s`}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => startLink(link)}
                      disabled={!!activeLink || todayCount >= DAILY_LINK_LIMIT || isDone}
                    >
                      {isDone ? <Check className="h-4 w-4 text-green-500" /> : <ExternalLink className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
              )
            })}
          </div>
        )}

        {/* Unity Ads Bonus Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8">
          <div className="glass glass-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Bônus: Assistir Anúncio</h3>
                <p className="text-xs text-muted-foreground">Assista até {DAILY_AD_LIMIT} anúncios por dia e ganhe +0.5 crédito cada</p>
              </div>
              <span className="ml-auto text-sm font-bold text-primary">{adCount}/{DAILY_AD_LIMIT}</span>
            </div>

            <AnimatePresence>
              {watchingAd ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                  <div className="bg-muted rounded-xl p-6 mb-4 flex flex-col items-center justify-center min-h-[120px]">
                    <Play className="h-8 w-8 text-primary animate-pulse mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Assistindo anúncio...</p>
                    {adCountdown > 0 ? (
                      <div className="text-2xl font-display font-bold text-primary">{adCountdown}s</div>
                    ) : (
                      <Button variant="hero" className="rounded-xl" onClick={completeAd}>
                        ✅ Resgatar +0.5 crédito
                      </Button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl"
                  onClick={watchAd}
                  disabled={adCount >= DAILY_AD_LIMIT}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {adCount >= DAILY_AD_LIMIT ? 'Limite de anúncios atingido hoje' : '🎬 Assistir anúncio (+0.5 crédito)'}
                </Button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Daily summary */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 text-center">
          <div className="inline-flex items-center gap-4 glass glass-border rounded-full px-6 py-3">
            <span className="text-sm text-muted-foreground">Resumo diário:</span>
            <span className="text-sm"><strong className="text-primary">{todayCount}</strong> links = <strong className="text-primary">+{(todayCount * 0.5).toFixed(1)}</strong></span>
            <span className="text-muted-foreground">+</span>
            <span className="text-sm"><strong className="text-primary">{adCount}</strong> anúncios = <strong className="text-primary">+{(adCount * 0.5).toFixed(1)}</strong></span>
            <span className="text-muted-foreground">=</span>
            <span className="text-sm font-bold text-primary">+{creditsEarned.toFixed(1)} total</span>
          </div>
        </motion.div>

        {/* Telegram CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-4 text-center">
          <Button
            variant="outline"
            className="rounded-full gap-2 px-6"
            onClick={() => window.open('https://t.me/kubovibe', '_blank')}
          >
            <Send className="h-4 w-4" />
            📲 Ganhe mais créditos no Telegram
          </Button>
        </motion.div>
      </main>
    </div>
  )
}
