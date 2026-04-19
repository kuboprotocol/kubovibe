import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getConnectorBySlug } from '@/lib/connectorsConfig'
import { useGitHubConnection } from '@/hooks/useGitHubConnection'
import {
  ArrowLeft, CheckCircle, XCircle, ExternalLink, Copy,
  RefreshCw, Unplug, Loader2, Clock, Activity, Settings,
} from 'lucide-react'
import GitHubReposList from '@/components/connectors/GitHubReposList'
import { useConnectorLogs, logConnectorEvent } from '@/hooks/useConnectorLogs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ConnectorDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const connector = getConnectorBySlug(slug || '')

  // Real GitHub OAuth hook
  const github = useGitHubConnection()
  const { logs, loading: logsLoading } = useConnectorLogs(slug || '')

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

        {/* Activity */}
        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando logs...
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
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
    </div>
  )
}
