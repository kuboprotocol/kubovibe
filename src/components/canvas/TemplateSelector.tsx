import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, FileText, Layout, PenTool, Grid3X3, Presentation, Workflow } from 'lucide-react'

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void
  onClose: () => void
}

const templates = [
  {
    id: 'blank',
    name: 'Em branco',
    description: 'Canvas vazio para criar do zero',
    icon: FileText,
  },
  {
    id: 'wireframe',
    name: 'Wireframe',
    description: 'Template para wireframes de UI',
    icon: Layout,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Mapa mental para ideias',
    icon: PenTool,
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Quadro de tarefas visual',
    icon: Grid3X3,
  },
  {
    id: 'presentation',
    name: 'Apresentação',
    description: 'Slides e storytelling visual',
    icon: Presentation,
  },
  {
    id: 'flowchart',
    name: 'Fluxograma',
    description: 'Diagramas de fluxo e processos',
    icon: Workflow,
  },
]

export default function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Escolha um template</h2>
            <p className="text-muted-foreground mt-1">Comece com um template ou crie do zero</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {templates.map((template, index) => {
            const Icon = template.icon
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
              >
                <Card
                  className="group cursor-pointer p-5 hover:border-primary hover:shadow-lg transition-all duration-200"
                  onClick={() => onSelect(template.id)}
                >
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="p-3 rounded-xl bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{template.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
