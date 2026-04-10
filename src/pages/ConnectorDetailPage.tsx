import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getConnectorBySlug } from '@/lib/connectorsConfig'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Unplug,
  Loader2,
  Clock,
  Activity,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function ConnectorDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const connector = getConnectorBySlug(slug || '')

  const [isConnected, setIsConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [repoUrl] = useState('https://github.com/kubo-protocol/kubo-vibe')

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

  const handleConnect = async () => {
    if (connector.status === 'coming_soon') {
      toast.info(`${connector.name} estará disponível em breve!`)
      return
    }
    setConnecting(true)
    // Simulate OAuth / connection flow
    await new Promise(r => setTimeout(r, 2000))
    setIsConnected(true)
    setConnecting(false)
    toast.success(`${connector.name} conectado com sucesso!`)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    toast.info(`${connector.name} desconectado.`)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const authLabel: Record<string, string> = {
    oauth: 'OAuth 2.0',
    api_key: 'API Key',
    webhook: 'Webhook',
    manual: 'Manual',
  }

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
              isConnected && 'bg-green-500/15 text-green-400 border-green-500/30'
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

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visão Geral</CardTitle>
          </CardHeader>
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
              <a
                href={connector.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver documentação
              </a>
            )}
          </CardContent>
        </Card>

        {/* Action */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected ? (
              <Button
                variant="hero"
                size="lg"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full sm:w-auto"
              >
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
                {/* Connected info */}
                {connector.slug === 'github' && (
                  <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Repositório</span>
                      <Badge variant="secondary" className="text-[10px]">HTTPS</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background px-3 py-2 rounded-lg border border-border font-mono truncate">
                        {repoUrl}
                      </code>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(repoUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleConnect}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Reconectar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Trocar conta
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                    <Unplug className="h-3.5 w-3.5 mr-1.5" />
                    Desconectar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity / Logs (when connected) */}
        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { time: 'Agora', event: 'Conexão estabelecida', status: 'success' },
                  { time: '—', event: 'Nenhuma sincronização anterior', status: 'neutral' },
                ].map((log, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        log.status === 'success' && 'bg-green-400',
                        log.status === 'error' && 'bg-destructive',
                        log.status === 'neutral' && 'bg-muted-foreground/40'
                      )}
                    />
                    <span className="text-muted-foreground flex-1">{log.event}</span>
                    <span className="text-xs text-muted-foreground/60">{log.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
