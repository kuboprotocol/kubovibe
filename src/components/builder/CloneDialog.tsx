import { useState } from 'react'
import { Globe, Loader2, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

interface CloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClone: (url: string) => void
  isCloning: boolean
}

export default function CloneDialog({ open, onOpenChange, onClone, isCloning }: CloneDialogProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    onClone(url.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Clonar Site / App / DApp
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Cole a URL de qualquer site, aplicativo web ou DApp para criar uma cópia visual idêntica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="pl-10 rounded-xl bg-secondary border-border/50"
              disabled={isCloning}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['Sites', 'Web Apps', 'DApps'].map((type) => (
              <div key={type} className="text-center px-2 py-2 rounded-xl bg-primary/5 border border-primary/10">
                <span className="text-xs font-medium text-primary">{type}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A IA irá analisar o design, estrutura e conteúdo do site e gerar um clone funcional em HTML + Tailwind CSS.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={isCloning}>
              Cancelar
            </Button>
            <Button variant="hero" type="submit" disabled={isCloning || !url.trim()} className="rounded-xl">
              {isCloning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Clonando...
                </>
              ) : (
                'Clonar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
