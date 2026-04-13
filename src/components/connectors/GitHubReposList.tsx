import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  GitBranch, Star, GitFork, ExternalLink, Lock, Globe,
  RefreshCw, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4F5D95',
  Shell: '#89e051',
}

export default function GitHubReposList() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const fetchRepos = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('github-repos', {
        body: null,
      })
      if (fnError) throw fnError
      setRepos(data?.repos || [])
    } catch (err: any) {
      console.error('Error fetching repos:', err)
      setError('Erro ao carregar repositórios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRepos() }, [])

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
              <a
                key={repo.id}
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
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
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                </div>
              </a>
            ))}
            {repos.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); setShowAll(!showAll) }}
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
  )
}
