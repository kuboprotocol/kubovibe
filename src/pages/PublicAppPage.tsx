import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2 } from 'lucide-react'
import { wrapPreviewHtml, subscribePreviewLogs, type PreviewLogEntry } from '@/lib/iframePreview'
import PreviewAuditPanel from '@/components/builder/PreviewAuditPanel'

export default function PublicAppPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const debug = searchParams.get('debug') === '1'
  const previewId = `public-app:${projectId ?? 'unknown'}`
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<PreviewLogEntry[]>([])

  useEffect(() => {
    if (!projectId) { setError('Projeto não encontrado'); setLoading(false); return }

    const load = async () => {
      const { data, error: err } = await supabase
        .from('published_projects' as never)
        .select('generated_code, is_published, title')
        .eq('id', projectId)
        .maybeSingle() as { data: { generated_code: string | null; is_published: boolean; title: string | null } | null; error: unknown }

      if (err || !data) {
        setError('Projeto não encontrado')
      } else if (!data.is_published) {
        setError('Este projeto não está publicado')
      } else if (!data.generated_code) {
        setError('Projeto sem conteúdo')
      } else {
        setHtml(data.generated_code)
        const appName = (data.title || '').trim()
        document.title = appName ? `${appName} · Kubo Vibe` : 'Kubo Vibe App'
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  // Capture iframe console/error events (always on — used by ?debug=1 overlay
  // and useful for diagnosing black-screen reports).
  useEffect(() => {
    return subscribePreviewLogs((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry]
        return next.length > 500 ? next.slice(-500) : next
      })
    }, { previewId })
  }, [previewId])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">{error}</p>
          <a href="/" className="text-sm text-primary hover:underline">Voltar ao início</a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen">
      <iframe
        srcDoc={wrapPreviewHtml(html || '', { previewId })}
        title="Published App"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-modals"
        style={{ backgroundColor: '#ffffff' }}
      />
      {debug && (
        <PreviewAuditPanel
          logs={logs}
          onClear={() => setLogs([])}
          defaultOpen
        />
      )}
      {/* Badge */}
      <a
        href="https://kubovibe.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-xs font-medium text-muted-foreground hover:text-foreground group"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-primary group-hover:animate-pulse" />
        Built with <span className="font-semibold text-foreground">Kubo Vibe</span>
      </a>
    </div>
  )
}
