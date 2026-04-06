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
        .from('projects')
        .select('generated_code, is_published, title')
        .eq('id', projectId)
        .maybeSingle()

      if (err || !data) {
        setError('Projeto não encontrado')
      } else if (!data.is_published) {
        setError('Este projeto não está publicado')
      } else if (!data.generated_code) {
        setError('Projeto sem conteúdo')
      } else {
        setHtml(data.generated_code)
        document.title = data.title || 'Kubo Vibe App'
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

  return (
    <iframe
      srcDoc={html!}
      title="Published App"
      className="w-full h-screen border-0"
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
    />
  )
}
