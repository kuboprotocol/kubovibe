import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Settings,
  History,
  BookOpen,
  Github,
  Link2,
  Camera,
  FileText,
  Paperclip,
  Pencil,
  X,
  Figma,
  CreditCard,
  Zap,
  Server,
  Globe,
  Sparkles,
  Layers,
  Rocket,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  KeyRound,
  FileJson,
  ArrowLeft,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PromptAttachMenuProps {
  onAttachFile: (file: File) => void
  onScreenshot: () => void
  onAddReference: (url: string) => void
}

const menuSections = [
  {
    title: 'Project',
    items: [
      { icon: Settings, label: 'Project settings', action: 'settings', badge: null },
      { icon: History, label: 'History', action: 'history', badge: null },
      { icon: BookOpen, label: 'Knowledge', action: 'knowledge', badge: null },
      { icon: Pencil, label: 'Visual edits', action: 'visual', badge: 'NEW' },
    ],
  },
  {
    title: 'Connectors',
    items: [
      { icon: Github, label: 'GitHub', action: 'github', badge: null },
      { icon: Figma, label: 'Figma', action: 'figma', badge: null },
      { icon: Link2, label: 'More connectors', action: 'connectors', badge: null },
    ],
  },
  {
    title: 'Services',
    items: [
      { icon: CreditCard, label: 'Payments (Stripe / AdMob)', action: 'payments', badge: 'PRO' },
      { icon: Server, label: 'MCP Servers', action: 'mcp', badge: null },
      { icon: Rocket, label: 'MVP Builder', action: 'mvp', badge: 'KUBO' },
      { icon: Globe, label: 'Deploy & Publish', action: 'deploy', badge: null },
    ],
  },
  {
    title: 'Attach',
    items: [
      { icon: Camera, label: 'Take a screenshot', action: 'screenshot', badge: null },
      { icon: FileText, label: 'Add reference', action: 'reference', badge: null },
      { icon: Paperclip, label: 'Upload file', action: 'attach', badge: null },
    ],
  },
]

type View = 'main' | 'connectors' | 'confirm-external'
type ExternalTarget = { id: 'github' | 'figma'; label: string; url: string; icon: typeof Github }
const EXTERNAL_TARGETS: Record<'github' | 'figma', ExternalTarget> = {
  github: { id: 'github', label: 'GitHub', url: 'https://github.com', icon: Github },
  figma: { id: 'figma', label: 'Figma', url: 'https://figma.com', icon: Figma },
}

export default function PromptAttachMenu({ onAttachFile, onScreenshot, onAddReference }: PromptAttachMenuProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('main')
  const [externalTarget, setExternalTarget] = useState<ExternalTarget | null>(null)
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false)
  const [referenceUrl, setReferenceUrl] = useState('')
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [customMode, setCustomMode] = useState<'api' | 'json'>('api')
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customJson, setCustomJson] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeAll = () => { setOpen(false); setView('main') }

  const handleAction = (action: string) => {
    switch (action) {
      case 'github':
      case 'figma':
        setExternalTarget(EXTERNAL_TARGETS[action])
        setView('confirm-external')
        return
      case 'connectors': setView('connectors'); return
      case 'screenshot': onScreenshot(); break
      case 'reference': setReferenceDialogOpen(true); closeAll(); return
      case 'attach': fileInputRef.current?.click(); break
      default: console.log(`Action: ${action}`)
    }
    closeAll()
  }

  const confirmExternalNavigation = () => {
    if (externalTarget) {
      window.open(externalTarget.url, '_blank', 'noopener,noreferrer')
      toast.warning(`Redirecionado para ${externalTarget.label} — fora do KUBO VIBE`)
    }
    setExternalTarget(null)
    closeAll()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onAttachFile(file)
  }

  const handleReferenceSubmit = () => {
    if (referenceUrl.trim()) {
      onAddReference(referenceUrl)
      setReferenceUrl('')
      setReferenceDialogOpen(false)
    }
  }

  const handleGoToConnectors = () => {
    closeAll()
    navigate('/connectors')
  }

  const handleSaveCustom = () => {
    try {
      if (customMode === 'json') JSON.parse(customJson)
      const entry = {
        id: crypto.randomUUID(),
        name: customName.trim() || 'Conector personalizado',
        mode: customMode,
        url: customUrl.trim() || null,
        apiKey: customKey.trim() || null,
        json: customMode === 'json' ? customJson : null,
        createdAt: new Date().toISOString(),
      }
      const existing = JSON.parse(localStorage.getItem('kubo:custom-connectors') || '[]')
      existing.push(entry)
      localStorage.setItem('kubo:custom-connectors', JSON.stringify(existing))
      toast.success('Conector personalizado salvo localmente')
      setCustomDialogOpen(false)
      setCustomName(''); setCustomUrl(''); setCustomKey(''); setCustomJson('')
    } catch {
      toast.error('JSON inválido')
    }
  }

  const badgeClasses: Record<string, string> = {
    NEW: 'bg-accent text-accent-foreground',
    PRO: 'bg-primary/20 text-primary',
    KUBO: 'gradient-primary text-primary-foreground',
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.rar"
      />

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setView('main') }}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "relative p-2.5 rounded-xl transition-all duration-300",
              "bg-primary/10 hover:bg-primary/20 text-primary",
              "border border-primary/20 hover:border-primary/40",
              "hover:shadow-glow group"
            )}
          >
            <Plus className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-45")} />
            <span className="absolute inset-0 rounded-xl border border-primary/30 animate-ping opacity-20 pointer-events-none" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-2 bg-card/95 backdrop-blur-xl border-border/50 shadow-glow-lg"
          align="start"
          sideOffset={8}
        >
          {view === 'main' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-display font-bold text-primary tracking-wider uppercase">KUBO Tools</span>
              </div>

              <div className="space-y-1">
                {menuSections.map((section) => (
                  <div key={section.title}>
                    <div className="px-3 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        {section.title}
                      </span>
                    </div>
                    {section.items.map((item) => {
                      const isConnectorsRoot = item.action === 'connectors'
                      const isExternal = item.action === 'github' || item.action === 'figma'
                      const showChevron = isConnectorsRoot || isExternal
                      return (
                        <button
                          key={item.action}
                          onClick={() => handleAction(item.action)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                            "text-sm text-muted-foreground hover:text-foreground",
                            "hover:bg-accent/50 transition-all duration-200 group/item"
                          )}
                        >
                          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-secondary/80 group-hover/item:bg-primary/15 transition-colors">
                            <item.icon className="h-3.5 w-3.5 text-muted-foreground group-hover/item:text-primary transition-colors" />
                          </div>
                          <span className="flex-1 text-left flex items-center gap-1.5">
                            {item.label}
                            {isExternal && <ShieldAlert className="h-3 w-3 text-destructive/70" />}
                          </span>
                          {item.badge && (
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider",
                              badgeClasses[item.badge] || 'bg-secondary text-secondary-foreground'
                            )}>
                              {item.badge}
                            </span>
                          )}
                          {showChevron && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t border-border/30 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-primary/50" />
                  <span className="text-[10px] text-muted-foreground/50">Powered by KUBO VIBE</span>
                </div>
              </div>
            </>
          )}

          {view === 'connectors' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  onClick={() => setView('main')}
                  className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <Link2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-display font-bold text-primary tracking-wider uppercase">Conectores</span>
              </div>

              <div className="mx-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/5 flex gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-destructive/90 mb-0.5">Você será redirecionado</p>
                  <p>Páginas externas e conectores próprios <strong>não são assegurados</strong> pelo KUBO VIBE. Use por sua conta e risco.</p>
                </div>
              </div>

              <button
                onClick={handleGoToConnectors}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors group/item"
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-secondary/80 group-hover/item:bg-primary/15 transition-colors">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground group-hover/item:text-primary" />
                </div>
                <span className="flex-1 text-left">Abrir hub de conectores</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>

              <button
                onClick={() => { setCustomMode('api'); setCustomDialogOpen(true); closeAll() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors group/item"
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-secondary/80 group-hover/item:bg-primary/15 transition-colors">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground group-hover/item:text-primary" />
                </div>
                <span className="flex-1 text-left">Adicionar minha API</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider bg-secondary text-secondary-foreground">CUSTOM</span>
              </button>

              <button
                onClick={() => { setCustomMode('json'); setCustomDialogOpen(true); closeAll() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors group/item"
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-secondary/80 group-hover/item:bg-primary/15 transition-colors">
                  <FileJson className="h-3.5 w-3.5 text-muted-foreground group-hover/item:text-primary" />
                </div>
                <span className="flex-1 text-left">Importar JSON</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider bg-secondary text-secondary-foreground">CUSTOM</span>
              </button>

              <div className="mt-1 pt-2 border-t border-border/30 px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground/50">Salvo localmente neste navegador</span>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {referenceDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add Reference URL</h3>
              <button onClick={() => setReferenceDialogOpen(false)} className="p-1 hover:bg-accent rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="url"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleReferenceSubmit() }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setReferenceDialogOpen(false)} className="flex-1 px-4 py-2 border border-border rounded-xl text-muted-foreground hover:bg-accent">Cancel</button>
              <button onClick={handleReferenceSubmit} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">Add</button>
            </div>
          </div>
        </div>
      )}

      {customDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                {customMode === 'api' ? <KeyRound className="h-4 w-4 text-primary" /> : <FileJson className="h-4 w-4 text-primary" />}
                {customMode === 'api' ? 'Adicionar API personalizada' : 'Importar JSON personalizado'}
              </h3>
              <button onClick={() => setCustomDialogOpen(false)} className="p-1 hover:bg-accent rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 p-2.5 rounded-lg border border-destructive/30 bg-destructive/5 flex gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Conectores personalizados são salvos <strong>apenas no seu navegador</strong> e <strong>não são auditados</strong> pelo KUBO VIBE.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="custom-name" className="text-xs">Nome</Label>
                <Input id="custom-name" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Meu conector" className="mt-1" />
              </div>

              {customMode === 'api' ? (
                <>
                  <div>
                    <Label htmlFor="custom-url" className="text-xs">Endpoint URL</Label>
                    <Input id="custom-url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://api.exemplo.com" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="custom-key" className="text-xs">API Key</Label>
                    <Input id="custom-key" type="password" value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="sk-..." className="mt-1" />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="custom-json" className="text-xs">JSON de configuração</Label>
                  <Textarea
                    id="custom-json"
                    value={customJson}
                    onChange={(e) => setCustomJson(e.target.value)}
                    placeholder='{ "endpoint": "...", "headers": {...} }'
                    className="mt-1 font-mono text-xs min-h-[140px]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setCustomDialogOpen(false)} className="flex-1 px-4 py-2 border border-border rounded-xl text-muted-foreground hover:bg-accent">Cancelar</button>
              <button onClick={handleSaveCustom} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
