import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  GitBranch, Star, GitFork, ExternalLink, Lock, Globe,
  RefreshCw, ChevronDown, Rocket, Loader2, CheckCircle,
  Copy, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { logConnectorEvent } from '@/hooks/useConnectorLogs'

interface Repo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
  private: boolean
}

interface DeployResult {
  cid: string
  ipfs_url: string
  gateway_url: string
  repo: string
  status: 'deployed' | 'simulated'
  message?: string
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', HTML: '#e34c26',
  CSS: '#563d7c', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600',
  PHP: '#4F5D95', Shell: '#89e051',
}

export default function GitHubReposList() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Deploy state
  const [deploying, setDeploying] = useState<string | null>(null)
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchRepos = async (manual = false) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('github-repos', {
        body: null,
      })
      if (fnError) throw fnError
      const list = data?.repos || []
      setRepos(list)
      if (manual) {
        logConnectorEvent({
          connectorSlug: 'github',
          eventType: 'repos_synced',
          message: `Sincronização concluída: ${list.length} repositórios`,
          status: 'success',
          metadata: { count: list.length },
        })
      }
    } catch (err: any) {
      console.error('Error fetching repos:', err)
      setError('Erro ao carregar repositórios')
      logConnectorEvent({
        connectorSlug: 'github',
        eventType: 'repos_sync_failed',
        message: 'Falha ao sincronizar repositórios',
        status: 'error',
        metadata: { error: err?.message },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRepos(false) }, [])

  const handleDeploy = async (repo: Repo) => {
    setDeploying(repo.full_name)
    setDeployResult(null)
    setDeployError(null)
    setDialogOpen(true)

    logConnectorEvent({
      connectorSlug: 'github',
      eventType: 'ipfs_deploy_started',
      message: `Deploy IPFS iniciado para ${repo.full_name}`,
      status: 'info',
      metadata: { repo: repo.full_name },
    })

    try {
      const { data, error: fnError } = await supabase.functions.invoke('github-ipfs-deploy', {
        body: { repo_full_name: repo.full_name },
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      setDeployResult(data)
      toast.success(`${repo.name} publicado no IPFS!`)
      logConnectorEvent({
        connectorSlug: 'github',
        eventType: 'ipfs_deploy_completed',
        message: `Deploy concluído: ${repo.full_name}`,
        status: 'success',
        metadata: {
          repo: repo.full_name,
          cid: data?.cid,
          gateway_url: data?.gateway_url,
          ipfs_url: data?.ipfs_url,
          deploy_status: data?.status,
        },
      })
    } catch (err: any) {
      console.error('Deploy error:', err)
      const msg = err?.message || 'Erro ao fazer deploy'
      setDeployError(msg)
      toast.error(msg)
      logConnectorEvent({
        connectorSlug: 'github',
        eventType: 'ipfs_deploy_failed',
        message: `Falha no deploy de ${repo.full_name}`,
        status: 'error',
        metadata: { repo: repo.full_name, error: msg },
      })
    } finally {
      setDeploying(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado!')
  }

  const displayed = showAll ? repos : repos.slice(0, 6)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Repositórios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Repositórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchRepos} className="mt-2">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Repositórios
            <Badge variant="secondary" className="text-[10px] ml-1">{repos.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchRepos} className="h-8 w-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {repos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum repositório encontrado.
            </p>
          ) : (
            <>
              {displayed.map(repo => (
                <div
                  key={repo.id}
                  className="p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        {repo.private ? (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-foreground truncate">
                          {repo.name}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {repo.language && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: LANG_COLORS[repo.language] || '#8b8b8b' }}
                            />
                            {repo.language}
                          </span>
                        )}
                        {repo.stargazers_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star className="h-3 w-3" /> {repo.stargazers_count}
                          </span>
                        )}
                        {repo.forks_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <GitFork className="h-3 w-3" /> {repo.forks_count}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">
                          {new Date(repo.updated_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); handleDeploy(repo) }}
                        disabled={deploying === repo.full_name}
                        title="Deploy para IPFS"
                      >
                        {deploying === repo.full_name ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Rocket className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              {repos.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full text-xs text-muted-foreground"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 mr-1 transition-transform', showAll && 'rotate-180')} />
                  {showAll ? 'Mostrar menos' : `Ver todos (${repos.length})`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Deploy Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Deploy IPFS
            </DialogTitle>
            <DialogDescription>
              Publicando repositório na rede descentralizada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Loading */}
            {deploying && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Fazendo deploy...</p>
                  <p className="text-xs text-muted-foreground mt-1">{deploying}</p>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {/* Error */}
            {deployError && !deploying && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Falha no deploy</p>
                  <p className="text-xs text-muted-foreground mt-1">{deployError}</p>
                </div>
              </div>
            )}

            {/* Success */}
            {deployResult && !deploying && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {deployResult.status === 'deployed' ? 'Deploy concluído!' : 'Deploy simulado'}
                  </p>
                  {deployResult.status === 'simulated' && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      {deployResult.message}
                    </p>
                  )}
                </div>

                {/* CID */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">CID</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-secondary px-3 py-2 rounded-lg border border-border font-mono truncate">
                      {deployResult.cid}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(deployResult.cid)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* IPFS URL */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">URL IPFS</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-secondary px-3 py-2 rounded-lg border border-border font-mono truncate">
                      {deployResult.ipfs_url}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(deployResult.ipfs_url)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Gateway URL */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Gateway</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-secondary px-3 py-2 rounded-lg border border-border font-mono truncate">
                      {deployResult.gateway_url}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(deployResult.gateway_url)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(deployResult.gateway_url, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Abrir no navegador
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
