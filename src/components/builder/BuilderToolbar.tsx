import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Eye, Code, Monitor, Smartphone, Tablet,
  RotateCw, ExternalLink, Share2, Save, Loader2, Download,
  LayoutTemplate, Zap, MoreHorizontal, Copy, Check, Globe, Layers,
  CircleDot, RotateCcw,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe-3d.png'

export type DeviceFrame = 'desktop' | 'tablet' | 'mobile'

interface BuilderToolbarProps {
  projectTitle: string
  activeTab: 'preview' | 'code'
  onTabChange: (tab: 'preview' | 'code') => void
  deviceFrame: DeviceFrame
  onDeviceFrameChange: (frame: DeviceFrame) => void
  landscape?: boolean
  onToggleLandscape?: () => void
  onRefreshPreview: () => void
  onSave: () => void
  onDownload: () => void
  onShowTemplates: () => void
  onCloneSite: () => void
  onPublish: () => Promise<string | null>
  saving: boolean
  hasCode: boolean
  editsRemaining: number | null
  isSubscribed: boolean
  generatedCode: string
  isPublished: boolean
  publishedUrl: string | null
}

export default function BuilderToolbar({
  projectTitle, activeTab, onTabChange, deviceFrame, onDeviceFrameChange,
  landscape = false, onToggleLandscape,
  onRefreshPreview, onSave, onDownload, onShowTemplates, onCloneSite, onPublish,
  saving, hasCode, editsRemaining, isSubscribed, generatedCode,
  isPublished, publishedUrl,
}: BuilderToolbarProps) {
  const navigate = useNavigate()
  const [shareCopied, setShareCopied] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)

  const handleShare = () => {
    const url = publishedUrl || window.location.href
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setShareCopied(false), 2000)
  }

  const handlePublish = async () => {
    if (!generatedCode) { toast.error('Nenhum código para publicar'); return }
    setPublishing(true)
    try {
      const url = await onPublish()
      if (url) {
        setJustPublished(true)
        toast.success('Projeto publicado com sucesso! 🎉')
        setTimeout(() => setJustPublished(false), 3000)
      }
    } catch {
      toast.error('Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  const handleCopyUrl = () => {
    if (publishedUrl) {
      navigator.clipboard.writeText(publishedUrl)
      setUrlCopied(true)
      toast.success('URL copiada!')
      setTimeout(() => setUrlCopied(false), 2000)
    }
  }

  const handleOpenInNewTab = () => {
    if (publishedUrl) {
      window.open(publishedUrl, '_blank')
    } else if (generatedCode) {
      const blob = new Blob([generatedCode], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    }
  }

  const devices: { frame: DeviceFrame; icon: typeof Monitor; label: string }[] = [
    { frame: 'desktop', icon: Monitor, label: 'Desktop' },
    { frame: 'tablet', icon: Tablet, label: 'Tablet' },
    { frame: 'mobile', icon: Smartphone, label: 'Mobile' },
  ]

  return (
    <header className="flex items-center justify-between px-3 py-1.5 glass glass-border z-20 h-12">
      {/* Left: Navigation + Logo */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <img src={logoImg} alt="KUBO VIBE" className="h-5" />

        {/* Tabs: Preview / Code */}
        <div className="flex items-center gap-0.5 bg-secondary/60 rounded-lg p-0.5 ml-2">
          <button
            onClick={() => onTabChange('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${
              activeTab === 'preview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => onTabChange('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
              activeTab === 'code'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* More tools */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onDownload} disabled={!hasCode}>
              <Download className="h-3.5 w-3.5 mr-2" /> Download HTML
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowTemplates}>
              <LayoutTemplate className="h-3.5 w-3.5 mr-2" /> Templates
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCloneSite}>
              <Layers className="h-3.5 w-3.5 mr-2" /> Clonar Site / DApp
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleOpenInNewTab} disabled={!hasCode}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir em nova aba
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center: Device frames + Path + Refresh */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 bg-secondary/60 rounded-lg p-0.5">
          {devices.map(({ frame, icon: Icon, label }) => (
            <button
              key={frame}
              onClick={() => onDeviceFrameChange(frame)}
              title={label}
              className={`p-1.5 rounded-md transition-all duration-200 ${
                deviceFrame === frame
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          {deviceFrame !== 'desktop' && onToggleLandscape && (
            <button
              onClick={onToggleLandscape}
              title={landscape ? 'Retrato' : 'Paisagem'}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <RotateCcw className={`h-3.5 w-3.5 transition-transform ${landscape ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
          <span>/</span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md" onClick={handleOpenInNewTab} title="Abrir externamente">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md" onClick={onRefreshPreview} title="Recarregar preview">
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Right: Status + Edits + Share + Publish */}
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium border ${
          isPublished
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <CircleDot className="h-2.5 w-2.5" />
          {isPublished ? 'Publicado' : 'Editando'}
        </div>

        {isSubscribed && editsRemaining !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary">
            <Zap className="h-3 w-3" />
            {editsRemaining}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleShare}
        >
          {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          Share
        </Button>

        {hasCode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
            onClick={onSave}
            disabled={saving}
            title="Salvar"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
        )}

        {/* Visualizar */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs rounded-lg gap-1.5"
          onClick={handleOpenInNewTab}
          disabled={!hasCode}
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar
        </Button>

        {/* Publish */}
        <Button
          variant="hero"
          size="sm"
          className="h-8 text-xs rounded-lg px-4 font-semibold"
          onClick={() => hasCode ? setPublishOpen(true) : toast.error('Gere um código primeiro')}
        >
          {isPublished ? 'Atualizar' : 'Publicar 🚀'}
        </Button>
      </div>

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="glass rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {isPublished ? 'Atualizar projeto' : 'Publicar projeto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Seu projeto <span className="font-semibold text-foreground">"{projectTitle}"</span> será salvo e {isPublished ? 'atualizado' : 'publicado'}.
            </p>
            {publishedUrl && (
              <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2 border border-border/50">
                <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs text-foreground truncate flex-1 font-mono">{publishedUrl}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyUrl}>
                  {urlCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => window.open(publishedUrl, '_blank')}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button variant="hero" onClick={handlePublish} disabled={publishing} className="rounded-xl">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {justPublished ? '✓ Publicado!' : publishing ? 'Publicando...' : isPublished ? 'Atualizar' : 'Publicar 🚀'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
