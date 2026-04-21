import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { logConnectorEvent } from '@/hooks/useConnectorLogs'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { FlaskConical, Loader2, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Scenario = 'repos_synced' | 'ipfs_deploy_success' | 'ipfs_deploy_failure' | 'oauth_lifecycle' | 'rate_limit' | 'mixed'
type StatusOverride = 'auto' | 'success' | 'error' | 'warning' | 'info'

interface Step {
  eventType: string
  message: string
  status: 'success' | 'error' | 'info' | 'warning'
  metadata?: Record<string, unknown>
  delayMs: number // delay before this step
}

const SCENARIOS: Record<Scenario, { label: string; description: string; steps: Step[] }> = {
  repos_synced: {
    label: 'Sincronização de Repositórios',
    description: 'Busca → processamento → sucesso',
    steps: [
      { eventType: 'repos_fetch_started', message: 'Buscando repositórios na API do GitHub...', status: 'info', delayMs: 0 },
      { eventType: 'repos_processing', message: 'Processando metadados de 12 repositórios', status: 'info', delayMs: 1200, metadata: { count: 12 } },
      { eventType: 'repos_synced', message: 'Sincronizados 12 repositórios com sucesso', status: 'success', delayMs: 1500, metadata: { count: 12, duration_ms: 2700 } },
    ],
  },
  ipfs_deploy_success: {
    label: 'Deploy IPFS — Sucesso',
    description: 'Build → upload → publicado com URL',
    steps: [
      { eventType: 'ipfs_deploy_started', message: 'Deploy IPFS iniciado para awesome-project', status: 'info', delayMs: 0, metadata: { repo: 'awesome-project' } },
      { eventType: 'ipfs_build', message: 'Compilando arquivos estáticos...', status: 'info', delayMs: 1500 },
      { eventType: 'ipfs_uploading', message: 'Enviando 142 arquivos para o IPFS', status: 'info', delayMs: 2000, metadata: { files: 142 } },
      { eventType: 'ipfs_deploy_completed', message: 'Deploy concluído: https://awesome-project.ipfs.dweb.link', status: 'success', delayMs: 2500, metadata: { ipfs_url: 'https://awesome-project.ipfs.dweb.link' } },
    ],
  },
  ipfs_deploy_failure: {
    label: 'Deploy IPFS — Falha',
    description: 'Build → erro de tamanho/timeout',
    steps: [
      { eventType: 'ipfs_deploy_started', message: 'Deploy IPFS iniciado para huge-repo', status: 'info', delayMs: 0 },
      { eventType: 'ipfs_build', message: 'Compilando arquivos...', status: 'info', delayMs: 1500 },
      { eventType: 'ipfs_size_warning', message: 'Aviso: bundle excede 40MB', status: 'warning', delayMs: 1800, metadata: { size_mb: 42 } },
      { eventType: 'ipfs_deploy_failed', message: 'Falha: repositório excede limite de 50MB', status: 'error', delayMs: 1500, metadata: { error: 'Size limit exceeded' } },
    ],
  },
  oauth_lifecycle: {
    label: 'Ciclo OAuth Completo',
    description: 'Conectar → uso → desconectar',
    steps: [
      { eventType: 'oauth_started', message: 'Iniciando autorização OAuth com GitHub', status: 'info', delayMs: 0 },
      { eventType: 'connected', message: 'Conectado como @testuser', status: 'success', delayMs: 1500, metadata: { username: 'testuser' } },
      { eventType: 'token_refreshed', message: 'Token de acesso renovado automaticamente', status: 'info', delayMs: 2000 },
      { eventType: 'disconnected', message: 'Conexão removida pelo usuário', status: 'info', delayMs: 1500 },
    ],
  },
  rate_limit: {
    label: 'Rate Limit',
    description: 'Aviso → erro de limite atingido',
    steps: [
      { eventType: 'api_call', message: 'Requisição à API do GitHub', status: 'success', delayMs: 0 },
      { eventType: 'rate_limit_warning', message: 'Aviso: 50 requisições restantes', status: 'warning', delayMs: 1000, metadata: { remaining: 50 } },
      { eventType: 'rate_limit_exceeded', message: 'Limite de requisições excedido — aguarde 1h', status: 'error', delayMs: 1500, metadata: { reset_in_seconds: 3600 } },
    ],
  },
  mixed: {
    label: 'Cenário Misto',
    description: 'Variedade de eventos e status',
    steps: [
      { eventType: 'connected', message: 'Conectado com sucesso', status: 'success', delayMs: 0 },
      { eventType: 'repos_synced', message: '8 repositórios sincronizados', status: 'success', delayMs: 1000 },
      { eventType: 'rate_limit_warning', message: 'API próxima do limite', status: 'warning', delayMs: 1200 },
      { eventType: 'ipfs_deploy_started', message: 'Deploy iniciado', status: 'info', delayMs: 1000 },
      { eventType: 'ipfs_deploy_failed', message: 'Falha no deploy: timeout', status: 'error', delayMs: 1500 },
      { eventType: 'ipfs_deploy_completed', message: 'Retry concluído com sucesso', status: 'success', delayMs: 1800 },
    ],
  },
}

interface LogSimulatorProps {
  connectorSlug: string
}

export function LogSimulator({ connectorSlug }: LogSimulatorProps) {
  const { user } = useAuth()
  const [scenario, setScenario] = useState<Scenario>('repos_synced')
  const [statusOverride, setStatusOverride] = useState<StatusOverride>('auto')
  const [speed, setSpeed] = useState([1]) // 1x default
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [clearing, setClearing] = useState(false)

  const current = SCENARIOS[scenario]

  const handleClearSimulated = async () => {
    if (!user) return
    setClearing(true)
    const { error, count } = await supabase
      .from('connector_activity_logs')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('connector_slug', connectorSlug)
      .filter('metadata->>simulated', 'eq', 'true')
    setClearing(false)
    if (error) {
      toast.error('Erro ao limpar logs simulados')
      console.error(error)
    } else {
      toast.success(`${count ?? 0} log(s) simulado(s) removido(s)`)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setProgress(0)
    const steps = current.steps
    const speedFactor = speed[0]

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        await new Promise(r => setTimeout(r, step.delayMs / speedFactor))
        await logConnectorEvent({
          connectorSlug,
          eventType: step.eventType,
          message: step.message,
          status: statusOverride === 'auto' ? step.status : statusOverride,
          metadata: { ...step.metadata, simulated: true, scenario },
        })
        setProgress(((i + 1) / steps.length) * 100)
      }
      toast.success(`Cenário "${current.label}" executado (${steps.length} eventos)`)
    } catch (err) {
      toast.error('Erro ao gerar logs simulados')
      console.error(err)
    } finally {
      setRunning(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  return (
    <Card className="border-dashed border-amber-500/40 bg-amber-500/[0.02]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          Simulador de Logs
          <Badge variant="secondary" className="text-[10px] ml-auto bg-amber-500/15 text-amber-600 border-amber-500/30">
            DEV ONLY
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cenário</Label>
            <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)} disabled={running}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCENARIOS) as Scenario[]).map(key => (
                  <SelectItem key={key} value={key}>
                    {SCENARIOS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forçar status</Label>
            <Select value={statusOverride} onValueChange={(v) => setStatusOverride(v as StatusOverride)} disabled={running}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (do cenário)</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Velocidade</Label>
            <span className="text-xs text-muted-foreground">{speed[0]}x</span>
          </div>
          <Slider
            value={speed}
            onValueChange={setSpeed}
            min={0.5}
            max={5}
            step={0.5}
            disabled={running}
          />
        </div>

        <div className="rounded-lg bg-secondary/30 p-3 text-xs">
          <p className="font-medium text-foreground mb-1.5">{current.description}</p>
          <div className="space-y-0.5 text-muted-foreground">
            {current.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="opacity-50">{i + 1}.</span>
                <span className={
                  s.status === 'success' ? 'text-emerald-500' :
                  s.status === 'error' ? 'text-destructive' :
                  s.status === 'warning' ? 'text-amber-500' : 'text-blue-500'
                }>●</span>
                <span className="truncate">{s.message}</span>
              </div>
            ))}
          </div>
        </div>

        {running && (
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full bg-amber-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        <Button
          onClick={handleRun}
          disabled={running}
          className="w-full"
          variant="outline"
        >
          {running ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Gerando logs... ({Math.round(progress)}%)</>
          ) : (
            <><Play className="h-3.5 w-3.5 mr-1.5" /> Executar cenário ({current.steps.length} eventos)</>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
