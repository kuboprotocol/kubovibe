import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { logConnectorEvent } from '@/hooks/useConnectorLogs'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  FlaskConical, Loader2, Play, Trash2, Pencil, Plus, ArrowUp, ArrowDown,
  X, Save, RotateCcw, Filter, Database, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type StatusOverride = 'auto' | 'success' | 'error' | 'warning' | 'info'
type StepStatus = 'success' | 'error' | 'info' | 'warning'

interface Step {
  eventType: string
  message: string
  status: StepStatus
  metadata?: Record<string, unknown>
  delayMs: number
}

interface ScenarioDef {
  label: string
  description: string
  steps: Step[]
  custom?: boolean
}

const BUILTIN_SCENARIOS: Record<string, ScenarioDef> = {
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

const STORAGE_KEY = 'kubo:custom-log-scenarios'

function loadCustomScenarios(): Record<string, ScenarioDef> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ScenarioDef>
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, { ...v, custom: true }])
    )
  } catch {
    return {}
  }
}

function saveCustomScenarios(scenarios: Record<string, ScenarioDef>) {
  const cleaned = Object.fromEntries(
    Object.entries(scenarios).map(([k, v]) => {
      const { custom: _custom, ...rest } = v
      return [k, rest]
    })
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
}

const statusColor = (s: StepStatus) =>
  s === 'success' ? 'text-emerald-500' :
  s === 'error' ? 'text-destructive' :
  s === 'warning' ? 'text-amber-500' : 'text-blue-500'

interface LogSimulatorProps {
  connectorSlug: string
  onRunFilterChange?: (runId: string | null) => void
  initialRunId?: string | null
  dbRunsActive?: boolean
  onDbRunsActiveChange?: (active: boolean) => void
}

export function LogSimulator({ connectorSlug, onRunFilterChange, initialRunId, dbRunsActive, onDbRunsActiveChange }: LogSimulatorProps) {
  const { user } = useAuth()
  const [customScenarios, setCustomScenarios] = useState<Record<string, ScenarioDef>>(() => loadCustomScenarios())
  const allScenarios = useMemo(
    () => ({ ...BUILTIN_SCENARIOS, ...customScenarios }),
    [customScenarios]
  )

  const [scenarioKey, setScenarioKey] = useState<string>('repos_synced')
  const [statusOverride, setStatusOverride] = useState<StatusOverride>('auto')
  const [speed, setSpeed] = useState([1])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [clearing, setClearing] = useState(false)

  // Run history (this connector) — for filtering by runId
  interface RunRecord { id: string; label: string; startedAt: number; eventCount: number; fromDb?: boolean; mine?: boolean }
  const [runs, setRuns] = useState<RunRecord[]>(() =>
    initialRunId ? [{ id: initialRunId, label: 'Run compartilhado', startedAt: Date.now(), eventCount: 0 }] : []
  )
  const [selectedRunId, setSelectedRunId] = useState<string>(initialRunId ?? 'all')
  const [loadingRuns, setLoadingRuns] = useState(false)

  // Sync external URL changes (back/forward) into local selection
  useEffect(() => {
    const next = initialRunId ?? 'all'
    setSelectedRunId(prev => (prev === next ? prev : next))
    if (initialRunId) {
      setRuns(prev => prev.some(r => r.id === initialRunId)
        ? prev
        : [{ id: initialRunId, label: 'Run compartilhado', startedAt: Date.now(), eventCount: 0 }, ...prev])
    }
  }, [initialRunId])

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editLabel, setEditLabel] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSteps, setEditSteps] = useState<Step[]>([])

  const current = allScenarios[scenarioKey] ?? BUILTIN_SCENARIOS.repos_synced

  useEffect(() => {
    saveCustomScenarios(customScenarios)
  }, [customScenarios])

  useEffect(() => {
    onRunFilterChange?.(selectedRunId === 'all' ? null : selectedRunId)
  }, [selectedRunId, onRunFilterChange])

  const openEditor = (mode: 'edit' | 'new') => {
    if (mode === 'new') {
      setEditLabel('Novo Cenário')
      setEditDescription('Descreva o fluxo aqui')
      setEditSteps([
        { eventType: 'custom_event', message: 'Primeiro evento', status: 'info', delayMs: 0 },
      ])
    } else {
      setEditLabel(current.label)
      setEditDescription(current.description)
      setEditSteps(current.steps.map(s => ({ ...s })))
    }
    setEditorOpen(true)
  }

  const updateStep = (index: number, patch: Partial<Step>) => {
    setEditSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  const addStep = () => {
    setEditSteps(prev => [
      ...prev,
      { eventType: 'custom_event', message: 'Novo evento', status: 'info', delayMs: 1000 },
    ])
  }

  const removeStep = (index: number) => {
    setEditSteps(prev => prev.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    setEditSteps(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSaveCustom = () => {
    if (!editLabel.trim()) {
      toast.error('Dê um nome ao cenário')
      return
    }
    if (editSteps.length === 0) {
      toast.error('Adicione pelo menos um passo')
      return
    }
    const key = `custom_${editLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}_${Date.now().toString(36)}`
    const def: ScenarioDef = {
      label: editLabel.trim(),
      description: editDescription.trim() || 'Cenário personalizado',
      steps: editSteps,
      custom: true,
    }
    setCustomScenarios(prev => ({ ...prev, [key]: def }))
    setScenarioKey(key)
    setEditorOpen(false)
    toast.success(`Cenário "${def.label}" salvo`)
  }

  const handleRunOnce = async () => {
    // Run from the editor without saving — just executes editSteps
    setEditorOpen(false)
    await runSteps(editSteps, editLabel || 'Cenário customizado')
  }

  const handleDeleteCustom = (key: string) => {
    setCustomScenarios(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    if (scenarioKey === key) setScenarioKey('repos_synced')
    toast.success('Cenário personalizado removido')
  }

  const runSteps = async (steps: Step[], label: string) => {
    if (steps.length === 0) return
    setRunning(true)
    setProgress(0)
    const speedFactor = speed[0]
    const runId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const startedAt = Date.now()
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        await new Promise(r => setTimeout(r, step.delayMs / speedFactor))
        await logConnectorEvent({
          connectorSlug,
          eventType: step.eventType,
          message: step.message,
          status: statusOverride === 'auto' ? step.status : statusOverride,
          metadata: { ...step.metadata, simulated: true, scenario: scenarioKey, runId, runLabel: label },
        })
        setProgress(((i + 1) / steps.length) * 100)
      }
      setRuns(prev => [{ id: runId, label, startedAt, eventCount: steps.length }, ...prev].slice(0, 20))
      setSelectedRunId(runId)
      toast.success(`Cenário "${label}" executado (${steps.length} eventos) • run ${runId.slice(0, 8)}`)
    } catch (err) {
      toast.error('Erro ao gerar logs simulados')
      console.error(err)
    } finally {
      setRunning(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const handleRun = () => runSteps(current.steps, current.label)

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
      setRuns([])
      setSelectedRunId('all')
    }
  }

  const handleClearByRun = async () => {
    if (!user || selectedRunId === 'all') return
    setClearing(true)
    const selected = runs.find(r => r.id === selectedRunId)
    const needsAdmin = selected?.mine === false
    let deletedCount = 0
    let error: unknown = null

    if (needsAdmin) {
      const { data, error: rpcErr } = await supabase.rpc('admin_clear_connector_run', {
        _connector_slug: connectorSlug,
        _run_id: selectedRunId,
      })
      error = rpcErr
      deletedCount = (data as number | null) ?? 0
    } else {
      const { error: delErr, count } = await supabase
        .from('connector_activity_logs')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('connector_slug', connectorSlug)
        .filter('metadata->>runId', 'eq', selectedRunId)
      error = delErr
      deletedCount = count ?? 0
    }
    setClearing(false)
    if (error) {
      toast.error('Erro ao limpar logs do run')
      console.error(error)
      return
    }
    toast.success(`${deletedCount} log(s) do run ${selectedRunId.slice(0, 8)} removido(s)`)
    setRuns(prev => prev.filter(r => r.id !== selectedRunId))
    setSelectedRunId('all')
  }

  const loadDbRuns = async () => {
    setLoadingRuns(true)
    const { data, error } = await supabase.rpc('admin_list_connector_runs', {
      _connector_slug: connectorSlug,
      _limit: 50,
    })
    setLoadingRuns(false)
    if (error) {
      toast.error('Erro ao carregar runs do banco (apenas admin)')
      console.error(error)
      return
    }
    type Row = { run_id: string; run_label: string; event_count: number; started_at: string; user_id: string; is_mine: boolean }
    const rows = (data as Row[] | null) ?? []
    const dbRuns: RunRecord[] = rows.map(r => ({
      id: r.run_id,
      label: r.run_label,
      startedAt: new Date(r.started_at).getTime(),
      eventCount: Number(r.event_count) || 0,
      fromDb: true,
      mine: r.is_mine,
    }))
    // Merge: DB rows are source of truth; keep current selection if still present
    setRuns(prev => {
      const sessionOnly = prev.filter(p => !dbRuns.some(d => d.id === p.id))
      return [...dbRuns, ...sessionOnly]
    })
    toast.success(`${dbRuns.length} run(s) carregados do banco`)
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
            <Select value={scenarioKey} onValueChange={setScenarioKey} disabled={running}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BUILTIN_SCENARIOS).map(([key, s]) => (
                  <SelectItem key={key} value={key}>{s.label}</SelectItem>
                ))}
                {Object.keys(customScenarios).length > 0 && (
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-t border-border mt-1 pt-2">
                    Personalizados
                  </div>
                )}
                {Object.entries(customScenarios).map(([key, s]) => (
                  <SelectItem key={key} value={key}>★ {s.label}</SelectItem>
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
          <Slider value={speed} onValueChange={setSpeed} min={0.5} max={5} step={0.5} disabled={running} />
        </div>

        <div className="rounded-lg bg-secondary/30 p-3 text-xs">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <p className="font-medium text-foreground">{current.description}</p>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost" size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => openEditor('edit')}
                disabled={running}
              >
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => openEditor('new')}
                disabled={running}
              >
                <Plus className="h-3 w-3 mr-1" /> Novo
              </Button>
              {current.custom && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                  onClick={() => handleDeleteCustom(scenarioKey)}
                  disabled={running}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-0.5 text-muted-foreground">
            {current.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="opacity-50">{i + 1}.</span>
                <span className={statusColor(s.status)}>●</span>
                <span className="truncate">{s.message}</span>
                <span className="ml-auto text-[10px] opacity-50 shrink-0">+{s.delayMs}ms</span>
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

        <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Filtrar por execução (runId)</Label>
            {selectedRunId !== 'all' && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {selectedRunId.slice(0, 8)}
              </Badge>
            )}
            <Button
              variant="ghost" size="sm"
              onClick={loadDbRuns}
              disabled={loadingRuns || running || clearing}
              className="ml-auto h-7 px-2 text-[11px]"
            >
              {loadingRuns
                ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                : <Database className="h-3 w-3 mr-1" />}
              Carregar do banco
            </Button>
          </div>

          {runs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2">
              Nenhum run nesta sessão. Execute um cenário ou clique em <strong>Carregar do banco</strong> para listar runs anteriores (admin).
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Select value={selectedRunId} onValueChange={setSelectedRunId} disabled={running || clearing}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os runs ({runs.length})</SelectItem>
                    {runs.map(r => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        <span className="font-mono opacity-60">{r.id.slice(0, 8)}</span>
                        {' · '}{r.label} · {r.eventCount} ev · {new Date(r.startedAt).toLocaleTimeString()}
                        {r.fromDb && r.mine === false && ' · 👥 outra sessão'}
                        {r.fromDb && r.mine && ' · 💾 banco'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline" size="sm"
                      disabled={selectedRunId === 'all' || running || clearing}
                      className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Limpar este run
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar logs deste run?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Apenas os logs do run <code className="text-xs bg-secondary px-1 py-0.5 rounded font-mono">{selectedRunId.slice(0, 8)}</code> serão removidos.
                        {runs.find(r => r.id === selectedRunId)?.mine === false && (
                          <span className="block mt-2 text-amber-600">
                            <Users className="h-3 w-3 inline mr-1" />
                            Este run pertence a outra sessão/usuário. Será removido via privilégio de admin.
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearByRun}
                        disabled={clearing}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                        Excluir run
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {selectedRunId === 'all'
                  ? 'Mostrando todos os logs do conector. Selecione um run para isolar.'
                  : 'O painel de logs será filtrado para este runId apenas.'}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleRun} disabled={running || clearing} className="flex-1" variant="outline">
            {running ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Gerando logs... ({Math.round(progress)}%)</>
            ) : (
              <><Play className="h-3.5 w-3.5 mr-1.5" /> Executar cenário ({current.steps.length} eventos)</>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={running || clearing}
                className="sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                Limpar simulados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar logs simulados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Apenas os logs gerados pelo simulador (com <code className="text-xs bg-secondary px-1 py-0.5 rounded">simulated: true</code>) serão excluídos deste conector. Logs reais serão preservados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearSimulated}
                  disabled={clearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                  Excluir simulados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-amber-500" />
              Editor de Cenário
            </DialogTitle>
            <DialogDescription>
              Personalize a sequência de eventos. Salve como cenário customizado ou execute uma vez sem salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Passos ({editSteps.length})</Label>
                <Button variant="ghost" size="sm" onClick={addStep} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar passo
                </Button>
              </div>

              <AnimatePresence initial={false}>
                {editSteps.map((step, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                      <span className={cn('text-base leading-none', statusColor(step.status))}>●</span>
                      <Input
                        value={step.message}
                        onChange={e => updateStep(i, { message: e.target.value })}
                        placeholder="Mensagem do log"
                        className="h-8 flex-1 text-xs"
                      />
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, -1)} disabled={i === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(i, 1)} disabled={i === editSteps.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeStep(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pl-8">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                        <Input
                          value={step.eventType}
                          onChange={e => updateStep(i, { eventType: e.target.value })}
                          placeholder="event_type"
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Status</Label>
                        <Select value={step.status} onValueChange={(v) => updateStep(i, { status: v as StepStatus })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="success">Sucesso</SelectItem>
                            <SelectItem value="error">Erro</SelectItem>
                            <SelectItem value="warning">Aviso</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Atraso (ms)</Label>
                        <Input
                          type="number" min={0} step={100}
                          value={step.delayMs}
                          onChange={e => updateStep(i, { delayMs: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {editSteps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhum passo. Adicione um para começar.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Cancelar
            </Button>
            <Button variant="outline" onClick={handleRunOnce} disabled={editSteps.length === 0}>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Executar sem salvar
            </Button>
            <Button onClick={handleSaveCustom} disabled={editSteps.length === 0 || !editLabel.trim()}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar cenário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
