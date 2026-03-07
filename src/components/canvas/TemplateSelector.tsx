import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, FileText, Layout, PenTool, Grid3X3, Presentation, Workflow, Search, Map, Users, Target, Lightbulb, Layers, Box, GitBranch, BarChart3 } from 'lucide-react'

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void
  onClose: () => void
}

const categories = [
  { id: 'all', label: 'Todos' },
  { id: 'design', label: 'Design & UI' },
  { id: 'diagram', label: 'Diagramas' },
  { id: 'planning', label: 'Planejamento' },
  { id: 'brainstorm', label: 'Brainstorm' },
]

const templates = [
  // Design & UI
  { id: 'blank', name: 'Em branco', description: 'Canvas vazio para criar do zero', icon: FileText, category: 'design' },
  { id: 'wireframe', name: 'Wireframe', description: 'Template para wireframes de UI', icon: Layout, category: 'design' },
  { id: 'mockup-mobile', name: 'Mockup Mobile', description: 'Protótipo de telas mobile', icon: Box, category: 'design' },
  { id: 'mockup-desktop', name: 'Mockup Desktop', description: 'Protótipo de telas desktop', icon: Layers, category: 'design' },
  { id: 'design-system', name: 'Design System', description: 'Componentes e tokens visuais', icon: Grid3X3, category: 'design' },

  // Diagramas
  { id: 'flowchart', name: 'Fluxograma', description: 'Diagramas de fluxo e processos', icon: Workflow, category: 'diagram' },
  { id: 'sitemap', name: 'Sitemap', description: 'Mapa de navegação do site', icon: Map, category: 'diagram' },
  { id: 'erd', name: 'Diagrama ER', description: 'Modelagem de banco de dados', icon: GitBranch, category: 'diagram' },
  { id: 'architecture', name: 'Arquitetura', description: 'Diagrama de arquitetura de sistema', icon: Layers, category: 'diagram' },
  { id: 'sequence', name: 'Diagrama de Sequência', description: 'Fluxo de comunicação entre serviços', icon: BarChart3, category: 'diagram' },

  // Planejamento
  { id: 'kanban', name: 'Kanban', description: 'Quadro de tarefas visual', icon: Grid3X3, category: 'planning' },
  { id: 'roadmap', name: 'Roadmap', description: 'Timeline de produto e features', icon: Target, category: 'planning' },
  { id: 'sprint-retro', name: 'Sprint Retro', description: 'Board de retrospectiva ágil', icon: Users, category: 'planning' },
  { id: 'user-story-map', name: 'User Story Map', description: 'Mapeamento de histórias do usuário', icon: Map, category: 'planning' },
  { id: 'presentation', name: 'Apresentação', description: 'Slides e storytelling visual', icon: Presentation, category: 'planning' },

  // Brainstorm
  { id: 'brainstorm', name: 'Brainstorm', description: 'Mapa mental para ideias', icon: PenTool, category: 'brainstorm' },
  { id: 'mindmap', name: 'Mind Map', description: 'Mapa mental com ramificações', icon: Lightbulb, category: 'brainstorm' },
  { id: 'swot', name: 'Análise SWOT', description: 'Forças, Fraquezas, Oportunidades, Ameaças', icon: Grid3X3, category: 'brainstorm' },
  { id: 'lean-canvas', name: 'Lean Canvas', description: 'Canvas de modelo de negócios enxuto', icon: Layout, category: 'brainstorm' },
  { id: 'empathy-map', name: 'Mapa de Empatia', description: 'Entenda o que o usuário pensa e sente', icon: Users, category: 'brainstorm' },
]

export default function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = templates.filter(t => {
    const matchCategory = activeCategory === 'all' || (!search && t.category === activeCategory)
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

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
        className="w-full max-w-3xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Escolha um template</h2>
            <p className="text-muted-foreground mt-1">Comece com um template ou crie do zero</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-secondary/50 border-border/50 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mb-4 bg-secondary/30 p-1 rounded-xl w-fit">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.map((template, index) => {
            const Icon = template.icon
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * index }}
              >
                <Card
                  className="group cursor-pointer p-4 hover:border-primary hover:shadow-lg transition-all duration-200"
                  onClick={() => onSelect(template.id)}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="p-2.5 rounded-xl bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{template.name}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
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
