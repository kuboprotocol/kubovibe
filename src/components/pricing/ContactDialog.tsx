import { useState } from 'react'
import { Loader2, CheckCircle2, Crown, LifeBuoy, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'

type Reason = 'enterprise' | 'support' | 'other'

const REASON_META: Record<Reason, { label: string; icon: typeof Crown; placeholder: string }> = {
  enterprise: {
    label: 'Quero aumentar meu plano (Enterprise)',
    icon: Crown,
    placeholder: 'Ex: equipe de 15 devs, ~5.000 créditos/mês estimados',
  },
  support: {
    label: 'Suporte técnico',
    icon: LifeBuoy,
    placeholder: 'Descreva o problema que você está enfrentando',
  },
  other: {
    label: 'Outro assunto',
    icon: MessageCircle,
    placeholder: 'Como podemos ajudar?',
  },
}

const VOLUME_OPTIONS = [
  'Até 1.000 créditos/mês',
  '1.000–5.000 créditos/mês',
  '5.000–20.000 créditos/mês',
  'Acima de 20.000 créditos/mês',
  'Não sei ainda',
]

const TEAM_SIZE_OPTIONS = ['1–5 pessoas', '6–20 pessoas', '21–50 pessoas', '50+ pessoas']

const CONTACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-request`

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultReason?: Reason
}

export function ContactDialog({ open, onOpenChange, defaultReason = 'enterprise' }: ContactDialogProps) {
  const [reason, setReason] = useState<Reason>(defaultReason)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [estimatedVolume, setEstimatedVolume] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [website, setWebsite] = useState('') // honeypot, sempre vazio para humanos
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = REASON_META[reason]
  const Icon = meta.icon

  const reset = () => {
    setFullName('')
    setEmail('')
    setCompany('')
    setMessage('')
    setEstimatedVolume('')
    setTeamSize('')
    setSent(false)
    setError(null)
  }

  const handleClose = (next: boolean) => {
    onOpenChange(next)
    if (!next) setTimeout(reset, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(CONTACT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          fullName,
          email,
          company,
          reason,
          message,
          estimatedVolume: reason === 'enterprise' ? estimatedVolume : undefined,
          teamSize: reason === 'enterprise' ? teamSize : undefined,
          website,
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || data?.ok === false) {
        setError('Não conseguimos enviar sua mensagem agora. Tente de novo em instantes.')
        return
      }
      setSent(true)
    } catch {
      setError('Não conseguimos enviar sua mensagem agora. Tente de novo em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <DialogTitle>Mensagem enviada!</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Recebemos sua mensagem e nossa equipe vai responder em até 1 dia útil.
            </p>
            <Button onClick={() => handleClose(false)} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <Badge className="mb-2 w-fit bg-primary/15 text-primary border-primary/30">
                <Icon className="mr-1.5 h-3 w-3" /> Falar com a gente
              </Badge>
              <DialogTitle>Como podemos ajudar?</DialogTitle>
              <DialogDescription>
                Preencha abaixo — nossa equipe responde em até 1 dia útil.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot — invisível para humanos, bots costumam preencher */}
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="space-y-1.5">
                <Label htmlFor="contact-reason">Motivo do contato</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
                  <SelectTrigger id="contact-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REASON_META) as Reason[]).map((r) => (
                      <SelectItem key={r} value={r}>{REASON_META[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Nome completo</Label>
                  <Input id="contact-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">E-mail</Label>
                  <Input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-company">Empresa (opcional)</Label>
                <Input id="contact-company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>

              {reason === 'enterprise' && (
                <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-volume">Volume estimado</Label>
                    <Select value={estimatedVolume} onValueChange={setEstimatedVolume}>
                      <SelectTrigger id="contact-volume">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {VOLUME_OPTIONS.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-team-size">Tamanho do time</Label>
                    <Select value={teamSize} onValueChange={setTeamSize}>
                      <SelectTrigger id="contact-team-size">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEAM_SIZE_OPTIONS.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="contact-message">Mensagem</Label>
                <Textarea
                  id="contact-message"
                  required
                  rows={4}
                  placeholder={meta.placeholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {reason === 'enterprise' ? (
                <p className="text-xs text-muted-foreground">
                  O que você ganha: preço customizado, suporte prioritário e onboarding dedicado.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nossa equipe responde em até 1 dia útil.</p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar mensagem
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ContactDialog
