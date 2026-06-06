import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Save, Download, Share2, Loader2, Film } from 'lucide-react'
import { getSnapshot } from 'tldraw'
import { motion, AnimatePresence } from 'framer-motion'
import TLDrawEditor from '@/components/canvas/TLDrawEditor'
import TemplateSelector from '@/components/canvas/TemplateSelector'
import CanvasInfoPanel from '@/components/canvas/CanvasInfoPanel'
import RunwayDialog from '@/components/runway/RunwayDialog'
import { toast } from 'sonner'

export default function CanvasPage() {
  const { canvasId } = useParams()
  const navigate = useNavigate()
  const [currentCanvasId] = useState(canvasId || crypto.randomUUID())
  const [canvasName, setCanvasName] = useState('Canvas sem nome')
  const [saving, setSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(!canvasId)
  const [showInfo, setShowInfo] = useState(true)
  const [showRunway, setShowRunway] = useState(false)

  useEffect(() => {
    if (canvasId) {
      loadCanvas(canvasId)
    }
  }, [canvasId])

  const loadCanvas = async (id: string) => {
    try {
      const stored = localStorage.getItem(`canvas-${id}`)
      if (stored) {
        const data = JSON.parse(stored)
        setCanvasName(data.name || 'Canvas sem nome')
      }
    } catch (err) {
      console.error('[LoadCanvas] Error:', err)
    }
  }

  const handleSave = useCallback(async (snapshot: any) => {
    setSaving(true)
    try {
      const data = {
        canvasId: currentCanvasId,
        name: canvasName,
        snapshot,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(`canvas-${currentCanvasId}`, JSON.stringify(data))

      // Update canvas list
      const list = JSON.parse(localStorage.getItem('canvas-list') || '[]')
      const existing = list.findIndex((c: any) => c.id === currentCanvasId)
      const entry = { id: currentCanvasId, name: canvasName, updatedAt: data.savedAt }
      if (existing >= 0) {
        list[existing] = entry
      } else {
        list.push(entry)
      }
      localStorage.setItem('canvas-list', JSON.stringify(list))

      toast.success('Canvas salvo com sucesso!')
    } catch (err) {
      toast.error('Erro ao salvar canvas')
    } finally {
      setSaving(false)
    }
  }, [currentCanvasId, canvasName])

  const handleQuickSave = () => {
    const editor = (window as any).tldrawEditor
    if (editor) {
      handleSave(getSnapshot(editor.store))
    }
  }

  const handleExport = (format: 'png' | 'svg' | 'json') => {
    toast.info(`Export ${format.toUpperCase()} — funcionalidade em desenvolvimento`)
  }

  const handleShare = () => {
    const url = `${window.location.origin}/canvas/${currentCanvasId}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado para a área de transferência!')
  }

  const handleTemplateSelect = (templateId: string) => {
    setShowTemplates(false)
    toast.info(`Template "${templateId}" selecionado`)
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border z-20"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-5 w-px bg-border" />
          <Input
            value={canvasName}
            onChange={(e) => setCanvasName(e.target.value)}
            className="text-base font-semibold bg-transparent border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary rounded-md px-2 w-56"
            placeholder="Nome do canvas..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplates(true)}
            className="hidden md:flex text-muted-foreground"
          >
            Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('png')}
            className="text-muted-foreground"
          >
            <Download className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="text-muted-foreground"
          >
            <Share2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Compartilhar</span>
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={handleQuickSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </motion.header>

      {/* Canvas area */}
      <div className="flex-1 relative">
        <AnimatePresence>
          {showTemplates && (
            <TemplateSelector
              onSelect={handleTemplateSelect}
              onClose={() => setShowTemplates(false)}
            />
          )}
        </AnimatePresence>

        {!showTemplates && (
          <TLDrawEditor onSave={handleSave} />
        )}

        <AnimatePresence>
          {showInfo && !showTemplates && (
            <CanvasInfoPanel onClose={() => setShowInfo(false)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
