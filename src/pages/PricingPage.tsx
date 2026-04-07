import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sparkles, Zap, Crown, Rocket, Star, Gift, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import logoImg from '@/assets/logo-kubovibe.png'

const packages = [
  { id: 'free', name: 'Free', price: '$0', priceNum: 0, credits: 5, description: 'Try Kubo Vibe with no commitment', icon: Gift, badge: '🎁', color: 'from-muted to-secondary', borderColor: 'border-border', isFree: true },
  { id: 'starter', name: 'Starter', price: '$4.99', priceNum: 4.99, credits: 25, description: 'Ideal to get started', icon: Zap, badge: '⚡', color: 'from-secondary to-muted', borderColor: 'border-border' },
  { id: 'basic', name: 'Basic', price: '$19.99', priceNum: 19.99, credits: 80, description: 'Great cost-benefit ratio', icon: Star, badge: '⭐', color: 'from-secondary to-muted', borderColor: 'border-border' },
  { id: 'pro', name: 'Pro', price: '$39.99', priceNum: 39.99, credits: 120, description: 'For active users', icon: Crown, badge: '👑', color: 'from-secondary to-muted', borderColor: 'border-primary/30' },
  { id: 'advanced', name: 'Advanced', price: '$59.99', priceNum: 59.99, credits: 200, description: 'Balance between volume and savings', icon: Sparkles, badge: '⭐', popular: true, color: 'from-primary/20 to-accent', borderColor: 'border-primary/50' },
  { id: 'elite', name: 'Elite', price: '$99.99', priceNum: 99.99, credits: 350, description: 'Maximum performance, lowest cost per credit', icon: Rocket, badge: '🚀', bestValue: true, color: 'from-primary/15 to-accent/50', borderColor: 'border-primary/40' },
] as Array<{ id: string; name: string; price: string; priceNum: number; credits: number; description: string; icon: any; badge: string; color: string; borderColor: string; isFree?: boolean; popular?: boolean; bestValue?: boolean }>

export default function PricingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      toast.success('Payment completed! Credits will be added shortly 🎉')
    } else if (checkout === 'cancelled') {
      toast.info('Checkout cancelled')
    }
  }, [searchParams])

  const handleCheckout = async (pkg: typeof packages[number]) => {
    if (!user) { navigate('/auth'); return }

    if (pkg.isFree) {
      const { error } = await supabase
        .from('subscriptions')
        .upsert({ user_id: user.id, plan: 'free', edits_used: 0, edits_limit: 5, is_active: true, paid_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) toast.error('Error activating free plan')
      else toast.success('Free plan activated! 🎁 5 credits available')
      return
    }

    setLoadingId(pkg.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('stripe-checkout', {
        body: { plan_id: pkg.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const { checkout_url } = res.data
      if (checkout_url) window.location.href = checkout_url
      else toast.error('Error creating checkout')
    } catch (err: any) {
      toast.error(err.message || 'Error processing payment')
    } finally {
      setLoadingId(null)
    }
  }

  const costPerCredit = (pkg: typeof packages[number]) => {
    if (pkg.isFree) return '—'
    return `$${(pkg.priceNum / pkg.credits).toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />

      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoImg} alt="KUBO VIBE" className="h-8" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Credit Packages</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            Supercharge your <span className="text-primary">creations</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Choose the ideal package for you. More credits = lower cost per use.</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 bg-secondary/50 px-3 py-1.5 rounded-full">
              💳 Powered by Stripe — Secure checkout
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 max-w-6xl mx-auto">
          {packages.map((pkg, i) => {
            const Icon = pkg.icon
            return (
              <motion.div key={pkg.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="relative">
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">⭐ Most popular</span>
                  </div>
                )}
                {pkg.bestValue && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">🚀 Best value</span>
                  </div>
                )}
                <div className={`h-full glass rounded-2xl p-6 border ${pkg.borderColor} transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${pkg.popular ? 'ring-2 ring-primary/50 shadow-gold' : ''} ${pkg.bestValue ? 'ring-1 ring-primary/30' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-foreground text-lg">{pkg.name}</h3>
                  </div>
                  <div className="mb-4"><span className="text-3xl font-display font-bold text-foreground">{pkg.price}</span></div>
                  <div className="bg-primary/10 rounded-xl px-4 py-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Credits</span>
                      <span className="text-2xl font-display font-bold text-primary">{pkg.credits}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary flex-shrink-0" />{pkg.description}</li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary flex-shrink-0" />Cost per credit: <span className="font-semibold text-foreground">{costPerCredit(pkg)}</span></li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary flex-shrink-0" />Full Builder access</li>
                  </ul>
                  <Button
                    variant={pkg.popular || pkg.bestValue ? 'hero' : 'outline'}
                    className="w-full h-11 rounded-xl text-sm font-semibold"
                    onClick={() => handleCheckout(pkg)}
                    disabled={loadingId === pkg.id}
                  >
                    {loadingId === pkg.id ? 'Processing...' : pkg.isFree ? 'Start free' : `Buy ${pkg.credits} credits`}
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center mt-12 md:mt-16">
          <div className="glass glass-border rounded-2xl p-6 max-w-2xl mx-auto">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-display font-bold text-foreground text-lg mb-2">Kubo Vibe — Web3 Super App 💛</h3>
            <p className="text-sm text-muted-foreground">
              Integrates wallets, dApps and gamified experiences in a single ecosystem.
              Simplifies blockchain and enables scalable growth with sustainable monetization.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
