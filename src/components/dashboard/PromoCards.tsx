import { useNavigate } from 'react-router-dom'
import { Gift, Zap, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function PromoCards() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  const referralCode = user?.id?.slice(0, 8) ?? ''
  const referralLink = `https://kubovibe.lovable.app/auth?ref=${referralCode}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
      {/* Referral Card */}
      <div className="glass glass-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/30 transition-all duration-300 group">
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
          <Gift className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground text-sm">Convide amigos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ganhe 100 créditos por indicação paga</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="mt-2 h-7 px-3 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 gap-1.5"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>
      </div>

      {/* Upgrade Card */}
      <div
        className="glass glass-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/30 transition-all duration-300 cursor-pointer group"
        onClick={() => navigate('/pricing')}
      >
        <div className="h-12 w-12 rounded-xl bg-accent/50 flex items-center justify-center shrink-0">
          <Zap className="h-6 w-6 text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground text-sm">Upgrade para Business</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Desbloqueie mais recursos e créditos</p>
          <span className="inline-block mt-2 text-xs text-primary font-medium">Ver planos →</span>
        </div>
      </div>
    </div>
  )
}
