import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sparkles, Zap, Shield, QrCode } from 'lucide-react'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe.png'

export default function PricingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { subscription, refetch } = useSubscription()

  // PIX payload for static key (phone)
  const pixKey = '11945794932'
  const pixPayload = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865406005.005802BR5913KUBO VIBE6008SAOPAULO62070503***6304`

  const handleActivatePlan = async () => {
    if (!user) { navigate('/auth'); return }
    if (subscription?.is_active) { toast.info('Seu plano Beta já está ativo!'); return }

    const { error } = await supabase
      .from('subscriptions' as any)
      .upsert({
        user_id: user.id,
        plan: 'beta',
        edits_used: 0,
        edits_limit: 20,
        is_active: true,
        paid_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id' })

    if (error) { toast.error('Erro ao ativar plano'); return }
    toast.success('Plano Beta ativado com sucesso! 🎉')
    await refetch()
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass glass-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoImg} alt="KUBO VIBE" className="h-8" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 relative z-10">
        {/* Motivational quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Plano Beta Exclusivo</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Cada grande ideia começa com um <span className="text-primary">primeiro passo</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            "O futuro pertence àqueles que acreditam na beleza dos seus sonhos." — Eleanor Roosevelt
          </p>
        </motion.div>

        {/* Plan card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-lg mx-auto"
        >
          <div className="glass glass-border rounded-3xl p-8 shadow-gold">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold mb-4">
                <Zap className="h-3 w-3" /> BETA
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Plano Beta</h2>
              <div className="mt-3">
                <span className="text-4xl font-display font-bold text-primary">R$ 5</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                '20 edições por mês',
                'Acesso ao Builder completo',
                'Templates exclusivos',
                'Suporte da comunidade',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-foreground">
                  <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {/* PIX QR Code */}
            <div className="bg-secondary/50 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <QrCode className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-foreground">Pague via PIX</h3>
              </div>
              <div className="flex justify-center mb-4">
                <div className="bg-background p-4 rounded-xl">
                  <QRCodeSVG
                    value={pixPayload}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Chave PIX (Telefone): <span className="font-mono text-foreground">{pixKey}</span>
              </p>
              <p className="text-center text-xs text-muted-foreground mt-1">
                Valor: <span className="font-bold text-primary">R$ 5,00</span>
              </p>
            </div>

            <Button
              variant="hero"
              className="w-full h-12 rounded-xl text-sm font-semibold"
              onClick={handleActivatePlan}
            >
              {subscription?.is_active ? 'Plano já ativo ✓' : 'Já paguei — Ativar meu plano'}
            </Button>

            {subscription?.is_active && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Edições restantes: <span className="font-bold text-primary">{subscription.edits_limit - subscription.edits_used}</span> de {subscription.edits_limit}
              </p>
            )}
          </div>
        </motion.div>

        {/* Thank you message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-12"
        >
          <div className="glass glass-border rounded-2xl p-6 max-w-lg mx-auto">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-display font-bold text-foreground text-lg mb-2">
              Obrigado por investir no KUBO VIBE! 💛
            </h3>
            <p className="text-sm text-muted-foreground">
              Você faz parte do início de algo incrível. Cada contribuição nos ajuda a construir 
              a plataforma dos sonhos para criadores como você. Juntos, vamos transformar ideias em realidade!
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
