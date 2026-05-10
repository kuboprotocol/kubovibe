import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Loader2 } from 'lucide-react'

export default function PublicAppPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Wrap fragments in a minimal HTML scaffold so apps without an explicit
  // <html><body> still render full-screen with a sane white background
  // (otherwise the iframe inherits the dark host theme → black screen).
  const wrappedHtml = (() => {
    const code = html || ''
    const hasDoctype = /<!doctype\s+html/i.test(code)
    const hasHtmlTag = /<html[\s>]/i.test(code)
    if (hasDoctype || hasHtmlTag) return code
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#ffffff;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh}</style></head><body>${code}</body></html>`
  })()

  return (
    <div className="relative w-full h-screen">
      <iframe
        srcDoc={wrappedHtml}
        title="Published App"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-modals"
        style={{ backgroundColor: '#ffffff' }}
      />
      {/* Badge */}
      <a
        href="https://kubovibe.lovable.app"
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
