import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getConnectorBySlug } from '@/lib/connectorsConfig'
import { useGitHubConnection } from '@/hooks/useGitHubConnection'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft, CheckCircle, XCircle, ExternalLink, Copy,
  RefreshCw, Unplug, Loader2, Clock, Activity, Trash2, Share2, RotateCcw,
} from 'lucide-react'
import GitHubReposList from '@/components/connectors/GitHubReposList'
import { LogSimulator } from '@/components/connectors/LogSimulator'
import { useConnectorLogs, logConnectorEvent } from '@/hooks/useConnectorLogs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type StatusFilter = 'all' | 'success' | 'error' | 'info' | 'warning'

export default function ConnectorDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const connector = getConnectorBySlug(slug || '')
  const { user } = useAuth()
  const isAdmin = user?.email === 'kuboprotocol@gmail.com'

  // Real GitHub OAuth hook
  const github = useGitHubConnection()
  const { logs, loading: logsLoading, clearLogs } = useConnectorLogs(slug || '')
  const [searchParams, setSearchParams] = useSearchParams()
  const runFilter = searchParams.get('run')
  const statusFromUrl = (searchParams.get('status') as StatusFilter | null) ?? 'all'
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>(statusFromUrl)
  const [clearing, setClearing] = useState(false)

  // Keep status filter in sync with URL when it changes externally (back/forward, paste)
  useEffect(() => {
    if (statusFromUrl !== statusFilter) setStatusFilterState(statusFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFromUrl])

  const setStatusFilter = (next: StatusFilter) => {
    setStatusFilterState(next)
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev)
      if (next === 'all') sp.delete('status'); else sp.set('status', next)
      return sp
    }, { replace: true })
  }

  const setRunFilter = useCallback((next: string | null) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev)
      if (!next) sp.delete('run'); else sp.set('run', next)
      return sp
    }, { replace: true })
  }, [setSearchParams])

  const dbRunsActive = searchParams.get('runs') === 'db'
  const setDbRunsActive = useCallback((active: boolean) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev)
      if (active) sp.set('runs', 'db'); else sp.delete('runs')
      return sp
    }, { replace: true })
  }, [setSearchParams])

  const hasActiveSlice = Boolean(runFilter) || statusFilter !== 'all' || dbRunsActive

  const buildShareUrl = useCallback(() => {
    const sp = new URLSearchParams()
    if (runFilter) sp.set('run', runFilter)
    if (statusFilter !== 'all') sp.set('status', statusFilter)
    if (dbRunsActive) sp.set('runs', 'db')
    const qs = sp.toString()
    return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`
  }, [runFilter, statusFilter, dbRunsActive])

  const [shareOpen, setShareOpen] = useState(false)

  const activeFilterChips = useMemo(() => ([
    runFilter ? { key: 'run', label: 'run', value: `${runFilter.slice(0, 8)}…` } : null,
    statusFilter !== 'all' ? { key: 'status', label: 'status', value: statusFilter } : null,
    dbRunsActive ? { key: 'runs', label: 'runs', value: 'db' } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[]), [runFilter, statusFilter, dbRunsActive])

  const handleOpenShare = useCallback(() => {
    setShareOpen(true)
  }, [])

  const handleConfirmCopy = useCallback(async () => {
    const url = buildShareUrl()
    const count = activeFilterChips.length
    try {
      await navigator.clipboard.writeText(url)
      const title = count === 0
        ? 'Link copiado (sem filtros ativos)'
        : `Recorte copiado · ${count} filtro${count === 1 ? '' : 's'}`
      toast.success(title, {
        description: (
          <div className="font-mono text-[11px] break-all text-foreground/80">{url}</div>
        ),
        duration: 4000,
      })
      setShareOpen(false)
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }, [buildShareUrl, activeFilterChips])

  const canResetFilters = Boolean(runFilter) || dbRunsActive

  const handleResetFilters = useCallback(() => {
    if (!canResetFilters) return
    const removed: string[] = []
    if (runFilter) removed.push('?run=')
    if (dbRunsActive) removed.push('?runs=db')
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev)
      sp.delete('run')
      sp.delete('runs')
      return sp
    }, { replace: true })
    // Silent confirmation: low-priority info toast, no error variant.
    toast(`Filtros resetados · ${removed.join(' e ')} removido${removed.length === 1 ? '' : 's'}`, {
      description: statusFilter !== 'all'
        ? `Filtro padrão restaurado. Mantido: ?status=${statusFilter}`
        : 'Filtro padrão restaurado.',
      duration: 2500,
    })
  }, [canResetFilters, runFilter, dbRunsActive, statusFilter, setSearchParams])

  const filteredLogs = useMemo(() => {
    let out = logs
    if (statusFilter !== 'all') out = out.filter(l => l.status === statusFilter)
    if (runFilter) {
      out = out.filter(l => {
        const meta = l.metadata as { runId?: string } | null
        return meta?.runId === runFilter
      })
    }
    return out
  }, [logs, statusFilter, runFilter])

  const handleClearLogs = async () => {
    setClearing(true)
    const { error } = await clearLogs()
    setClearing(false)
    if (error) {
      toast.error('Erro ao limpar histórico')
    } else {
      toast.success('Histórico limpo!')
    }
  }

  // Fallback state for non-GitHub connectors
  const [fakeConnected, setFakeConnected] = useState(false)
  const [fakeConnecting, setFakeConnecting] = useState(false)

  if (!connector) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold text-foreground">Conector não encontrado</p>
          <Button onClick={() => navigate('/connectors')}>Voltar aos Conectores</Button>
        </div>
      </div>
    )
  }

  const isGitHub = connector.slug === 'github'
  const isStripe = connector.slug === 'stripe'
  const isConnected = isGitHub ? github.isConnected : fakeConnected
  const connecting = isGitHub ? github.connecting : fakeConnecting

  const handleConnect = async () => {
    if (connector.status === 'coming_soon') {
      toast.info(`${connector.name} estará disponível em breve!`)
      return
    }
    if (isGitHub) {
      github.connect()
    } else if (isStripe) {
      navigate('/connect')
    } else {
      setFakeConnecting(true)
      await new Promise(r => setTimeout(r, 2000))
      setFakeConnected(true)
      setFakeConnecting(false)
      toast.success(`${connector.name} conectado com sucesso!`)
      logConnectorEvent({
        connectorSlug: connector.slug,
        eventType: 'connected',
        message: `${connector.name} conectado (simulado)`,
        status: 'success',
      })
    }
  }

  const handleDisconnect = () => {
    if (isGitHub) {
      github.disconnect()
    } else {
      setFakeConnected(false)
      toast.info(`${connector.name} desconectado.`)
      logConnectorEvent({
        connectorSlug: connector.slug,
        eventType: 'disconnected',
        message: `${connector.name} desconectado`,
        status: 'info',
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const authLabel: Record<string, string> = {
    oauth: 'OAuth 2.0', api_key: 'API Key', webhook: 'Webhook', manual: 'Manual',
  }

  const githubProfileUrl = github.connection?.github_username
    ? `https://github.com/${github.connection.github_username}`
    : ''

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/connectors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex items-center justify-center h-10 w-10 rounded-xl"
            style={{ backgroundColor: `${connector.color}15` }}
          >
            <connector.icon className="h-5 w-5" style={{ color: connector.color }} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display">{connector.name}</h1>
            <p className="text-xs text-muted-foreground">{authLabel[connector.authType]}</p>
          </div>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={cn(
              'gap-1.5',
              isConnected && 'bg-primary/15 text-primary border-primary/30'
            )}
          >
            {isConnected ? (
              <><CheckCircle className="h-3 w-3" /> Conectado</>
            ) : (
              <><XCircle className="h-3 w-3" /> Não conectado</>
            )}
          </Badge>
        </div>
      </div>

      <motion.div
        className="max-w-4xl mx-auto px-4 py-8 space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Overview */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Visão Geral</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{connector.longDescription}</p>
            <div>
              <h4 className="text-sm font-semibold mb-2 text-foreground">Recursos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {connector.features.map(feature => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            {connector.docsUrl && (
              <a href={connector.docsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Ver documentação
              </a>
            )}
          </CardContent>
        </Card>

        {/* Action */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Conexão</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!isConnected ? (
              <Button variant="hero" size="lg" onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
                {connecting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Conectando...</>
                ) : connector.status === 'coming_soon' ? (
                  <><Clock className="h-4 w-4" /> Em breve</>
                ) : (
                  <>Conectar com {connector.name}</>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                {/* GitHub connected info */}
                {isGitHub && github.connection && (
                  <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
                    <div className="flex items-center gap-3">
                      {github.connection.github_avatar_url && (
                        <img src={github.connection.github_avatar_url} alt="" className="h-10 w-10 rounded-full" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          @{github.connection.github_username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Conectado em {new Date(github.connection.connected_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">OAuth</Badge>
                    </div>
                    {githubProfileUrl && (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background px-3 py-2 rounded-lg border border-border font-mono truncate">
                          {githubProfileUrl}
                        </code>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(githubProfileUrl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    {connecting ? 'Reconectando...' : 'Reconectar'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                    <Unplug className="h-3.5 w-3.5 mr-1.5" /> Desconectar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GitHub Repos */}
        {isGitHub && isConnected && <GitHubReposList />}

        {/* Log Simulator (admin only) */}
        {isAdmin && slug && (
          <LogSimulator
            connectorSlug={slug}
            onRunFilterChange={setRunFilter}
            initialRunId={runFilter}
            dbRunsActive={dbRunsActive}
            onDbRunsActiveChange={setDbRunsActive}
          />
        )}

        {/* Activity — sempre que houver logs */}
        {(isConnected || logs.length > 0) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Atividade Recente
              </CardTitle>
              <div className="flex items-center gap-1">
                {canResetFilters && (() => {
                  const removableCount = (runFilter ? 1 : 0) + (dbRunsActive ? 1 : 0)
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      title={`Remove ${removableCount} filtro${removableCount === 1 ? '' : 's'}: ${[runFilter && '?run=', dbRunsActive && '?runs=db'].filter(Boolean).join(' e ')} (mantém ?status=)`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Resetar filtros
                      <Badge
                        variant="secondary"
                        className="h-4 min-w-4 px-1 text-[10px] leading-none rounded-full bg-primary/15 text-primary border-primary/20"
                      >
                        {removableCount}
                      </Badge>
                    </Button>
                  )
                })()}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenShare}
                  className={cn(
                    'h-8 text-xs',
                    hasActiveSlice ? 'text-primary hover:text-primary' : 'text-muted-foreground'
                  )}
                  title={hasActiveSlice ? 'Copiar URL com filtros normalizados' : 'Copiar URL da página (sem filtros)'}
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Compartilhar recorte
                  {hasActiveSlice && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[9px] bg-primary/15 text-primary border-primary/30">
                      {[runFilter && 'run', statusFilter !== 'all' && 'status', dbRunsActive && 'banco'].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
                {logs.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-8">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Limpar histórico de logs?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todos os {logs.length} registros de atividade do conector <strong>{connector.name}</strong> serão permanentemente excluídos. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearLogs}
                          disabled={clearing}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                          Limpar tudo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {runFilter && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Filtrando run:</span>
                  <code className="font-mono text-foreground">{runFilter.slice(0, 8)}…</code>
                  <span className="text-muted-foreground ml-1">({filteredLogs.length} log{filteredLogs.length === 1 ? '' : 's'})</span>
                  <Button
                    variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[11px]"
                    onClick={handleOpenShare}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copiar link
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-6 px-2 text-[11px]"
                    onClick={() => setRunFilter(null)}
                  >
                    Limpar filtro
                  </Button>
                </div>
              )}
              {/* Filter chips */}
              {logs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {([
                    { value: 'all', label: 'Todos', count: logs.length },
                    { value: 'success', label: 'Sucesso', count: logs.filter(l => l.status === 'success').length },
                    { value: 'error', label: 'Erros', count: logs.filter(l => l.status === 'error').length },
                    { value: 'warning', label: 'Avisos', count: logs.filter(l => l.status === 'warning').length },
                    { value: 'info', label: 'Info', count: logs.filter(l => l.status === 'info').length },
                  ] as { value: StatusFilter; label: string; count: number }[]).map(f => (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                        statusFilter === f.value
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary',
                        f.count === 0 && 'opacity-40'
                      )}
                      disabled={f.count === 0 && f.value !== 'all'}
                    >
                      {f.label} <span className="ml-1 opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {logsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {logs.length === 0 ? 'Nenhuma atividade registrada ainda.' : 'Nenhum log para este filtro.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 text-sm">
                      <div className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        log.status === 'success' && 'bg-primary',
                        log.status === 'error' && 'bg-destructive',
                        log.status === 'warning' && 'bg-accent',
                        log.status === 'info' && 'bg-muted-foreground/60',
                      )} />
                      <span className="text-foreground flex-1 truncate">{log.message}</span>
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Share preview dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              Compartilhar recorte
            </DialogTitle>
            <DialogDescription>
              Revise os filtros incluídos antes de copiar a URL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter chips */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Filtros incluídos ({activeFilterChips.length})
              </p>
              {activeFilterChips.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum filtro ativo — o link aponta para a página padrão do conector.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterChips.map(chip => (
                    <Badge
                      key={chip.key}
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/30 font-mono text-[11px] gap-1"
                    >
                      <span className="opacity-70">{chip.label}=</span>
                      <span>{chip.value}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* URL preview */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Preview da URL
              </p>
              <div className="rounded-md border border-border bg-secondary/40 p-3 font-mono text-[11px] text-foreground break-all">
                {buildShareUrl()}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setShareOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCopy}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
