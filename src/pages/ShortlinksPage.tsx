import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Zap, ExternalLink, Wallet, Gift, Send, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe-3d.png'
import StreakCard from '@/components/shortlinks/StreakCard'
import BadgesCard from '@/components/shortlinks/BadgesCard'
import TerraNativeBanner from '@/components/shortlinks/TerraNativeBanner'
import {
  TERRA_ADS_SMARTLINK_1,
  TERRA_ADS_SMARTLINK_LABEL,
  openTerraSmartlink,
} from '@/lib/terraAds'

const DAILY_LIMIT = 10
const CREDIT_PER_VIEW = 0.5
const TENTH_BONUS = 5
const WAIT_DURATION = 60 // 60 seconds fixed for all shortlinks

export default function ShortlinksPage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [waiting, setWaiting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [crediting, setCrediting] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const popupRef = useRef<Window | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [adResult, streakResult] = await Promise.all([
      supabase
        .from('ad_rewards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    setTodayCount(adResult.count || 0)
    if (streakResult.data) {
      setCurrentStreak(streakResult.data.current_streak || 0)
      setLongestStreak(streakResult.data.longest_streak || 0)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const openSmartlink = () => {
    if (!user) { navigate('/auth'); return }
    if (todayCount >= DAILY_LIMIT) {
      toast.info('Limite diário atingido! Volte amanhã 🌅')
      return
    }
    popupRef.current = openTerraSmartlink()
    if (!popupRef.current) {
      toast.error('Não foi possível abrir o shortlink. Desative o bloqueador de pop-ups e tente novamente.')
      return
    }
    setWaiting(true)
    setCountdown(WAIT_DURATION)
  }

  const creditReward = async () => {
    setCrediting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('terra-ad-reward', {
        body: { reward_type: 'completed' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const result = res.data as any
      const newCount = todayCount + 1
      setTodayCount(newCount)

      if (result?.current_streak) {
        setCurrentStreak(result.current_streak)
        setLongestStreak(prev => Math.max(prev, result.current_streak))
      }

      if (newCount >= DAILY_LIMIT) {
        const bonusMsg = result?.streak_bonus > 0
          ? ` + ${result.streak_bonus} bônus de streak 🔥`
          : ''
        toast.success(`🎉 Todos os créditos do dia conquistados!${bonusMsg}`)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
      } else {
        toast.success(`+${CREDIT_PER_VIEW} crédito ganho! 🎉`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao creditar')
    } finally {
      setCrediting(false)
      setWaiting(false)
      setCountdown(0)
    }
  }

  const creditsEarned = todayCount * CREDIT_PER_VIEW
  const progressPercent = (todayCount / DAILY_LIMIT) * 100
  const remaining = DAILY_LIMIT - todayCount

  if (!user) { navigate('/auth'); return null }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="glass glass-border rounded-2xl p-8 max-w-md">
          <h1 className="font-display font-bold text-2xl text-foreground mb-3">🚧 Em breve</h1>
          <p className="text-muted-foreground mb-6">
            Esta funcionalidade está sendo preparada e estará disponível em breve. Fique ligado!
          </p>
          <Button variant="hero" className="rounded-xl" onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] pointer-events-none"
          >
            {Array.from({ length: 60 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: -20,
                  rotate: 0,
                  scale: Math.random() * 0.5 + 0.5,
                }}
                animate={{
                  y: window.innerHeight + 20,
                  rotate: Math.random() * 720 - 360,
                  x: Math.random() * window.innerWidth,
                }}
                transition={{
                  duration: Math.random() * 2 + 2,
                  delay: Math.random() * 1.5,
                  ease: 'easeIn',
                }}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][i % 8],
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoImg} alt="KUBO VIBE" className="h-8" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-primary font-bold">+{creditsEarned.toFixed(1)} créditos</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* TERRA ADS - Smartlink section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="glass glass-border rounded-2xl p-5 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-foreground text-lg">TERRA ADS - Smartlink</h2>
                <p className="text-xs text-muted-foreground">{TERRA_ADS_SMARTLINK_LABEL}</p>
                <p className="text-sm text-muted-foreground mt-1">Acesse {DAILY_LIMIT} shortlinks por dia</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-display font-bold text-primary">+{creditsEarned.toFixed(1)}</div>
                <span className="text-xs text-muted-foreground">ganhos hoje</span>
              </div>
            </div>
          </div>
        </motion.div>

        <StreakCard currentStreak={currentStreak} longestStreak={longestStreak} />
        <BadgesCard />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass glass-border rounded-2xl p-4 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progresso diário</span>
            <span className="text-sm font-bold text-primary">{todayCount}/{DAILY_LIMIT}</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          {todayCount >= DAILY_LIMIT && (
            <p className="text-xs text-primary mt-2 text-center">🎉 Parabéns! Todos os créditos ganhos! Volte amanhã.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="mb-8">
          <AnimatePresence mode="wait">
            {waiting ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass glass-border rounded-2xl p-6 border-primary/30 ring-2 ring-primary/20 text-center"
              >
                <h3 className="font-display font-bold text-foreground text-lg mb-1">Shortlink aberto em nova aba</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Permaneça na página do shortlink até o timer acabar, depois resgate seu crédito.
                </p>
                {countdown > 0 ? (
                  <div className="mb-2">
                    <div className="text-5xl font-display font-bold text-primary mb-3">{countdown}s</div>
                    <Progress value={((WAIT_DURATION - countdown) / WAIT_DURATION) * 100} className="h-2 max-w-xs mx-auto" />
                  </div>
                ) : (
                  <Button
                    variant="hero"
                    className="h-14 px-10 rounded-xl text-base font-bold"
                    onClick={creditReward}
                    disabled={crediting}
                  >
                    {crediting ? 'Creditando...' : `✅ Resgatar +${CREDIT_PER_VIEW} crédito`}
                  </Button>
                )}
                <div className="mt-4">
                  <a
                    href={TERRA_ADS_SMARTLINK_1}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-primary"
                  >
                    Reabrir shortlink
                  </a>
                </div>
              </motion.div>
            ) : (
              <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button
                  variant="hero"
                  className="w-full h-20 rounded-2xl text-lg font-display font-bold gap-3 relative overflow-hidden"
                  onClick={openSmartlink}
                  disabled={todayCount >= DAILY_LIMIT || loading}
                >
                  {todayCount >= DAILY_LIMIT ? (
                    <>🎉 Limite atingido! Volte amanhã</>
                  ) : (
                    <>
                      <ExternalLink className="h-6 w-6" />
                      🔗 Abrir shortlink TERRA ADS (+{CREDIT_PER_VIEW} crédito)
                      <span className="absolute top-2 right-3 text-xs opacity-70">{remaining} restantes</span>
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="glass glass-border rounded-2xl p-5">
            <h3 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Resumo de hoje
            </h3>
            <div className="space-y-2">
              {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    i < todayCount ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i < todayCount ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm flex-1 ${i < todayCount ? 'text-green-500' : 'text-muted-foreground'}`}>
                    Shortlink {i + 1}
                  </span>
                  <span className={`text-sm font-bold ${i < todayCount ? 'text-primary' : 'text-muted-foreground/50'}`}>
                    +{CREDIT_PER_VIEW}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total ganho hoje</span>
              <span className="text-lg font-display font-bold text-primary">+{creditsEarned.toFixed(1)} créditos</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6 flex flex-col items-center gap-3">
          <Button
            variant="outline"
            className="rounded-full gap-2 px-6"
            onClick={() => navigate('/leaderboard')}
          >
            <Trophy className="h-4 w-4" />
            🏆 Ver Ranking de Streaks
          </Button>
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
