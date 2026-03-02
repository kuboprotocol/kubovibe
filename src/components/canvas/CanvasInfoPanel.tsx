import { motion } from 'framer-motion'
import { X, Type, Shapes, Image, Grid3X3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CanvasInfoPanelProps {
  onClose: () => void
}

const features = [
  { icon: Type, label: 'Texto rico com fontes customizadas' },
  { icon: Shapes, label: 'Formas geométricas e conectores inteligentes' },
  { icon: Image, label: 'Upload de imagens e ícones' },
  { icon: Grid3X3, label: 'Grid e snapping automático' },
]

const shortcuts = [
  { key: 'Ctrl+S', action: 'Salvar' },
  { key: 'Ctrl+A', action: 'Selecionar tudo' },
  { key: 'Ctrl+0', action: 'Ajustar zoom' },
  { key: 'Ctrl+Shift+E', action: 'Export PNG' },
]

export default function CanvasInfoPanel({ onClose }: CanvasInfoPanelProps) {
  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="absolute top-4 right-4 z-10 w-72 rounded-xl bg-card border border-border p-5 shadow-lg"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">🎨 Canvas Infinito</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2.5 mb-5">
        {features.map((feat, i) => {
          const Icon = feat.icon
          return (
            <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>{feat.label}</span>
            </div>
          )
        })}
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground mb-2">⌨️ Atalhos Rápidos</p>
        <div className="space-y-1.5">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                {s.key}
              </kbd>
              <span className="text-muted-foreground">{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
