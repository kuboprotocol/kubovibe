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
  X
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

const menuItems = [
  { icon: Settings, label: 'Project settings', action: 'settings' },
  { icon: History, label: 'History', action: 'history' },
  { icon: BookOpen, label: 'Knowledge', action: 'knowledge' },
  { icon: Github, label: 'GitHub', action: 'github' },
  { icon: Link2, label: 'Connectors', action: 'connectors' },
  { icon: Camera, label: 'Take a screenshot', action: 'screenshot' },
  { icon: FileText, label: 'Add reference', action: 'reference' },
  { icon: Paperclip, label: 'Attach', action: 'attach' },
  { icon: Pencil, label: 'Visual edits', action: 'visual' },
]

export default function PromptAttachMenu({ onAttachFile, onScreenshot, onAddReference }: PromptAttachMenuProps) {
  const [open, setOpen] = useState(false)
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false)
  const [referenceUrl, setReferenceUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAction = (action: string) => {
    switch (action) {
      case 'settings':
        // Would open project settings
        console.log('Opening project settings...')
        break
      case 'history':
        // Would show history
        console.log('Opening history...')
        break
      case 'knowledge':
        // Would open knowledge base
        console.log('Opening knowledge base...')
        break
      case 'github':
        // Would open GitHub integration
        window.open('https://github.com', '_blank')
        break
      case 'connectors':
        // Would open connectors panel
        console.log('Opening connectors...')
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
        // Would enable visual edit mode
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
              "p-2.5 rounded-xl transition-all duration-200",
              "bg-primary/10 hover:bg-primary/20 text-primary",
              "border border-primary/20 hover:border-primary/40",
              "hover:shadow-gold"
            )}
          >
            <Plus className={cn(
              "h-4 w-4 transition-transform duration-200",
              open && "rotate-45"
            )} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-56 p-1.5 bg-card/95 backdrop-blur-xl border-border/50"
          align="start"
          sideOffset={8}
        >
          <div className="space-y-0.5">
            {menuItems.map((item) => (
              <button
                key={item.action}
                onClick={() => handleAction(item.action)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                  "text-sm text-muted-foreground hover:text-foreground",
                  "hover:bg-accent/50 transition-colors",
                  "group"
                )}
              >
                <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span>{item.label}</span>
              </button>
            ))}
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
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
