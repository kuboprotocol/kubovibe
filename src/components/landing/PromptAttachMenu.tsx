import { useState, useRef } from 'react'
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
  Rocket
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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

export default function PromptAttachMenu({ onAttachFile, onScreenshot, onAddReference }: PromptAttachMenuProps) {
  const [open, setOpen] = useState(false)
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false)
  const [referenceUrl, setReferenceUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAction = (action: string) => {
    switch (action) {
      case 'settings':
        console.log('Opening project settings...')
        break
      case 'history':
        console.log('Opening history...')
        break
      case 'knowledge':
        console.log('Opening knowledge base...')
        break
      case 'github':
        window.open('https://github.com', '_blank')
        break
      case 'figma':
        window.open('https://figma.com', '_blank')
        break
      case 'connectors':
        console.log('Opening connectors...')
        break
      case 'payments':
        console.log('Opening payments setup...')
        break
      case 'mcp':
        console.log('Opening MCP servers...')
        break
      case 'mvp':
        console.log('Opening MVP builder...')
        break
      case 'deploy':
        console.log('Opening deploy panel...')
        break
      case 'screenshot':
        onScreenshot()
        break
      case 'reference':
        setReferenceDialogOpen(true)
        setOpen(false)
        return
      case 'attach':
        fileInputRef.current?.click()
        break
      case 'visual':
        console.log('Enabling visual edits...')
        break
    }
    setOpen(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onAttachFile(file)
    }
  }

  const handleReferenceSubmit = () => {
    if (referenceUrl.trim()) {
      onAddReference(referenceUrl)
      setReferenceUrl('')
      setReferenceDialogOpen(false)
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
        accept="image/*,.pdf,.txt,.md"
      />
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button 
            className={cn(
              "relative p-2.5 rounded-xl transition-all duration-300",
              "bg-primary/10 hover:bg-primary/20 text-primary",
              "border border-primary/20 hover:border-primary/40",
              "hover:shadow-glow group"
            )}
          >
            <Plus className={cn(
              "h-4 w-4 transition-transform duration-300",
              open && "rotate-45"
            )} />
            {/* Pulsing ring — KUBO VIBE exclusive */}
            <span className="absolute inset-0 rounded-xl border border-primary/30 animate-ping opacity-20 pointer-events-none" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-64 p-2 bg-card/95 backdrop-blur-xl border-border/50 shadow-glow-lg"
          align="start"
          sideOffset={8}
        >
          {/* Header */}
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
                {section.items.map((item) => (
                  <button
                    key={item.action}
                    onClick={() => handleAction(item.action)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                      "text-sm text-muted-foreground hover:text-foreground",
                      "hover:bg-accent/50 transition-all duration-200",
                      "group/item"
                    )}
                  >
                    <div className="flex items-center justify-center h-6 w-6 rounded-md bg-secondary/80 group-hover/item:bg-primary/15 transition-colors">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground group-hover/item:text-primary transition-colors" />
                    </div>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider",
                        badgeClasses[item.badge] || 'bg-secondary text-secondary-foreground'
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-border/30 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-primary/50" />
              <span className="text-[10px] text-muted-foreground/50">Powered by KUBO VIBE</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reference URL Dialog */}
      {referenceDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add Reference URL</h3>
              <button 
                onClick={() => setReferenceDialogOpen(false)}
                className="p-1 hover:bg-accent rounded-lg transition-colors"
              >
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReferenceSubmit()
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setReferenceDialogOpen(false)}
                className="flex-1 px-4 py-2 border border-border rounded-xl text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReferenceSubmit}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
