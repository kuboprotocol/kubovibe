import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Eye, Code, Monitor, Smartphone, Tablet,
  RotateCw, ExternalLink, Share2, Save, Loader2, Download,
  LayoutTemplate, Zap, MoreHorizontal, Copy, Check, Globe, Layers,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import logoImg from '@/assets/logo-kubovibe.png'

export type DeviceFrame = 'desktop' | 'tablet' | 'mobile'

interface BuilderToolbarProps {
  projectTitle: string
  activeTab: 'preview' | 'code'
  onTabChange: (tab: 'preview' | 'code') => void
  deviceFrame: DeviceFrame
  onDeviceFrameChange: (frame: DeviceFrame) => void
  onRefreshPreview: () => void
  onSave: () => void
  onDownload: () => void
  onShowTemplates: () => void
  onCloneSite: () => void
  saving: boolean
  hasCode: boolean
  editsRemaining: number | null
  isSubscribed: boolean
  generatedCode: string
}

export default function BuilderToolbar({
  projectTitle, activeTab, onTabChange, deviceFrame, onDeviceFrameChange,
  onRefreshPreview, onSave, onDownload, onShowTemplates, onCloneSite,
  saving, hasCode, editsRemaining, isSubscribed, generatedCode,
}: BuilderToolbarProps) {
  const navigate = useNavigate()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setShareCopied(false), 2000)
  }

  const handlePublish = async () => {
    if (!generatedCode) { toast.error('Nenhum código para publicar'); return }
    setPublishing(true)
    // Simulate publish (save + mark as published)
    await onSave()
    setTimeout(() => {
      setPublishing(false)
      setPublished(true)
      toast.success('Projeto publicado com sucesso! 🎉')
      setTimeout(() => { setPublished(false); setPublishOpen(false) }, 2000)
    }, 1500)
  }

  const handleOpenInNewTab = () => {
    if (!generatedCode) return
    const blob = new Blob([generatedCode], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
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
        {/* Device frame selector */}
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
        </div>

        {/* Path breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
          <span>/</span>
        </div>

        {/* Refresh + Open external */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
            onClick={onRefreshPreview}
            title="Recarregar preview"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
            onClick={onRefreshPreview}
            title="Recarregar preview"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Right: Edits + Share + Publish */}
      <div className="flex items-center gap-2">
        {isSubscribed && editsRemaining !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary">
            <Zap className="h-3 w-3" />
            {editsRemaining}
          </div>
        )}

        {/* Share */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleShare}
        >
          {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          Share
        </Button>

        {/* Save */}
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

        {/* Publish */}
        <Button
          variant="hero"
          size="sm"
          className="h-8 text-xs rounded-lg px-4 font-semibold"
          onClick={() => hasCode ? setPublishOpen(true) : toast.error('Gere um código primeiro')}
        >
          Publish
        </Button>
      </div>

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="glass rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Publicar projeto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seu projeto <span className="font-semibold text-foreground">"{projectTitle}"</span> será salvo e publicado.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button variant="hero" onClick={handlePublish} disabled={publishing} className="rounded-xl">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {published ? '✓ Publicado!' : publishing ? 'Publicando...' : 'Publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
