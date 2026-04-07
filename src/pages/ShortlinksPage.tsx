import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Zap, Play, Wallet, Send, Gift } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe.png'

const DAILY_LIMIT = 10
const CREDIT_PER_VIEW = 0.5
const UNITY_GAME_ID = 'zw52l859eq65bwtg'
const UNITY_AD_UNIT_ID = 'Rewarded_Android'

declare global {
  interface Window {
    UnityAds?: {
      init: (gameId: string, testMode: boolean) => void
      isReady: (adUnitId: string) => boolean
      show: (adUnitId: string, options?: { onComplete?: () => void; onSkip?: () => void; onError?: (msg: string) => void }) => void
    }
    unityAdsReady?: boolean
  }
}

export default function ShortlinksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [watching, setWatching] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [crediting, setCrediting] = useState(false)
  const [unityLoaded, setUnityLoaded] = useState(false)
  const unityInitRef = useRef(false)

  // Load Unity Ads SDK
  useEffect(() => {
    if (unityInitRef.current) return
    unityInitRef.current = true

    const script = document.createElement('script')
    script.src = 'https://unity-ads.unity3d.com/webview/public/config/UnityAds.js'
    script.async = true
    script.onload = () => {
      try {
        window.UnityAds?.init(UNITY_GAME_ID, true) // testMode = true
        setUnityLoaded(true)
        console.log('Unity Ads initialized ✓')
      } catch (e) {
        console.warn('Unity Ads init failed:', e)
      }
    }
    script.onerror = () => console.warn('Unity Ads SDK failed to load')
    document.head.appendChild(script)
  }, [])

  const fetchData = useCallback(async () => {
    if (!user) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('ad_rewards' as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())

    setTodayCount(count || 0)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const showAd = () => {
    if (!user) { navigate('/auth'); return }
    if (todayCount >= DAILY_LIMIT) {
      toast.info('Limite diário atingido! Volte amanhã 🌅')
      return
    }

    setWatching(true)

    // Try real Unity Ads first
    if (unityLoaded && window.UnityAds?.isReady(UNITY_AD_UNIT_ID)) {
      window.UnityAds.show(UNITY_AD_UNIT_ID, {
        onComplete: () => {
          setCountdown(0)
          creditReward()
        },
        onSkip: () => {
          toast.info('Assista o vídeo completo para ganhar créditos')
          setWatching(false)
        },
        onError: (msg) => {
          console.warn('Unity Ad error:', msg)
          // Fallback to timer
          setCountdown(10)
        },
      })
    } else {
      // Fallback: simulated ad with timer (for dev/web)
      setCountdown(10)
    }
  }

  const creditReward = async () => {
    setCrediting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('unity-ad-reward', {
        body: { reward_type: 'completed' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      toast.success(`+${CREDIT_PER_VIEW} crédito ganho! 🎉`)
      setTodayCount(c => c + 1)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao creditar')
    } finally {
      setCrediting(false)
      setWatching(false)
      setCountdown(0)
    }
  }

  const creditsEarned = todayCount * CREDIT_PER_VIEW
  const progressPercent = (todayCount / DAILY_LIMIT) * 100
  const remaining = DAILY_LIMIT - todayCount

  if (!user) { navigate('/auth'); return null }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
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
        {/* Wallet Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="glass glass-border rounded-2xl p-5 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-foreground text-lg">💰 Ganhar Créditos</h2>
                <p className="text-sm text-muted-foreground">Assista {DAILY_LIMIT} vídeos por dia</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-display font-bold text-primary">+{creditsEarned.toFixed(1)}</div>
                <span className="text-xs text-muted-foreground">ganhos hoje</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress */}
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

        {/* Main CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <AnimatePresence mode="wait">
            {watching ? (
              <motion.div
                key="watching"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass glass-border rounded-2xl p-8 border-primary/30 ring-2 ring-primary/20"
              >
                <div className="text-center">
                  <Play className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
                  <h3 className="font-display font-bold text-foreground text-lg mb-1">Assistindo vídeo...</h3>
                  <p className="text-muted-foreground text-sm mb-4">Aguarde o final para ganhar seu crédito</p>

                  {countdown > 0 ? (
                    <div className="mb-4">
                      <div className="text-5xl font-display font-bold text-primary mb-3">{countdown}s</div>
                      <Progress value={((10 - countdown) / 10) * 100} className="h-2 max-w-xs mx-auto" />
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
                </div>
              </motion.div>
            ) : (
              <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button
                  variant="hero"
                  className="w-full h-20 rounded-2xl text-lg font-display font-bold gap-3 relative overflow-hidden"
                  onClick={showAd}
                  disabled={todayCount >= DAILY_LIMIT || loading}
                >
                  {todayCount >= DAILY_LIMIT ? (
                    <>🎉 Limite atingido! Volte amanhã</>
                  ) : (
                    <>
                      <Play className="h-6 w-6" />
                      🎬 Assistir Vídeo (+{CREDIT_PER_VIEW} crédito)
                      <span className="absolute top-2 right-3 text-xs opacity-70">{remaining} restantes</span>
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Rewards breakdown */}
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
                    Vídeo {i + 1}
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

        {/* Telegram CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6 text-center">
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
