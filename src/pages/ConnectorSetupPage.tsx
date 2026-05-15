import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Loader2, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getConnectorBySlug } from '@/lib/connectorsConfig'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

export default function ConnectorSetupPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const connector = getConnectorBySlug(slug)

  const [accepted, setAccepted] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<{ masked_hint: string | null; updated_at: string } | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('api_credentials')
        .select('masked_hint, updated_at')
        .eq('connector_slug', slug)
        .maybeSingle()
      if (!cancelled) {
        setExisting(data ?? null)
        setLoadingExisting(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

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

  const handleSave = async () => {
    if (!accepted) {
      toast.error('Você precisa aceitar os termos antes de continuar.')
      return
    }
    if (apiKey.trim().length < 8) {
      toast.error('A API Key parece inválida (mínimo 8 caracteres).')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('connector-credentials-save', {
        body: { connector_slug: slug, api_key: apiKey.trim() },
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error))
      toast.success(`${connector.name} conectado com sucesso!`)
      navigate(`/connectors/${slug}`)
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message ?? 'erro desconhecido'}`)
    } finally {
      setSaving(false)
    }
  }

  const Icon = connector.icon

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/connectors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${connector.color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: connector.color }} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display">Conectar {connector.name}</h1>
              <p className="text-xs text-muted-foreground">Setup interno · KUBO Vibe Dev</p>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-3xl mx-auto px-4 py-8 space-y-6"
      >
        {/* Aviso responsabilidade */}
        <Card className="p-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Serviço de terceiros</p>
              <p className="text-muted-foreground">
                <strong>{connector.name}</strong> é um serviço externo, independente da KUBO. Cobranças,
                limites de uso, política de API e segurança da conta são de responsabilidade exclusiva
                do provedor. A KUBO apenas integra e automatiza chamadas usando a sua chave.
              </p>
            </div>
          </div>
        </Card>

        {/* Status atual */}
        {!loadingExisting && existing && (
          <Card className="p-4 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Já existe uma chave configurada</p>
              <p className="text-muted-foreground text-xs">
                {existing.masked_hint ?? '••••'} · atualizada {new Date(existing.updated_at).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="secondary">Substituir abaixo</Badge>
          </Card>
        )}

        {/* Steps */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Como obter sua {connector.apiKeyLabel}
          </h2>
          {connector.setupSteps.map((step, i) => (
            <Card key={i} className="p-4 flex gap-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </Card>
          ))}
          {connector.apiKeyDocsUrl && (
            <a
              href={connector.apiKeyDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Abrir página oficial do {connector.name}
              <ExternalLink className="h-3 w-3" />
              <span className="text-muted-foreground">(site externo)</span>
            </a>
          )}
        </div>

        {/* Form */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Conectar à KUBO</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">{connector.apiKeyLabel}</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              placeholder={connector.apiKeyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">{connector.apiKeyHelp}</p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Sua chave é cifrada com <strong>AES-256-GCM</strong> antes de ser persistida e nunca é
              devolvida em claro ao navegador. Apenas as edge functions da KUBO podem descifrar para
              executar ações em seu nome.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(Boolean(v))}
              disabled={saving}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              Li e aceito que <strong>{connector.name}</strong> é um serviço de terceiros e que a KUBO
              apenas integra/automatiza chamadas usando minha chave.
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate('/connectors')}
              disabled={saving}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !accepted || apiKey.length < 8}
              className={cn('flex-1')}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existing ? 'Atualizar chave' : 'Salvar e ativar'}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
