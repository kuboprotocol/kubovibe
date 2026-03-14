import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Search, ArrowRight, Star } from 'lucide-react'
import { templatePreviews } from './templatePreviews'
import { categories, templates } from './templatesData'

export interface Template {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  prompt: string
  icon: any
  color: string
  popular?: boolean
}

interface TemplateGalleryProps {
  onSelect: (template: Template) => void
  onClose: () => void
}

export default function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = templates.filter(t => {
    const matchCategory = activeCategory === 'all' || !search && t.category === activeCategory
    const matchSearch = !search || 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    return matchCategory && matchSearch
  })

  const popularTemplates = templates.filter(t => t.popular)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex bg-background/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-col w-full h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Templates</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Escolha um template para começar rapidamente
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-secondary/50 border-border/50 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Category Sidebar */}
          <div className="w-52 border-r border-border/50 p-3 overflow-y-auto shrink-0">
            {categories.map(cat => {
              const Icon = cat.icon
              const count = cat.id === 'all' ? templates.length : templates.filter(t => t.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 ${
                    activeCategory === cat.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{cat.label}</span>
                  <span className="ml-auto text-[10px] opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Template Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Popular section when viewing all */}
            {activeCategory === 'all' && !search && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-display font-semibold text-foreground">Populares</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {popularTemplates.map((template, i) => (
                    <TemplateCard key={template.id} template={template} index={i} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-semibold text-foreground">
                {activeCategory === 'all' && !search ? 'Todos os templates' : `${filtered.length} template${filtered.length !== 1 ? 's' : ''}`}
              </h3>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum template encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((template, i) => (
                  <TemplateCard key={template.id} template={template} index={i} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TemplateCard({ template, index, onSelect }: { template: Template; index: number; onSelect: (t: Template) => void }) {
  const Icon = template.icon
  const previewHtml = templatePreviews[template.id]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <button
        onClick={() => onSelect(template)}
        className="w-full text-left group rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-glow transition-all duration-300 overflow-hidden"
      >
        {/* Visual preview */}
        <div className="h-32 relative overflow-hidden bg-muted">
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="w-[400%] h-[400%] origin-top-left pointer-events-none border-0"
              style={{ transform: 'scale(0.25)' }}
              title={template.name}
              sandbox=""
              tabIndex={-1}
            />
          ) : (
            <div className={`h-full bg-gradient-to-br ${template.color} opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
              <Icon className="h-10 w-10 text-white/90 drop-shadow-lg" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {template.popular && (
            <Badge className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-foreground border-border/50 text-[10px] px-1.5 py-0">
              <Star className="h-2.5 w-2.5 mr-0.5 fill-current text-amber-500" />
              Popular
            </Badge>
          )}
        </div>
        <div className="p-4">
          <h4 className="font-display font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
            {template.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {template.description}
          </p>
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {template.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            Usar template
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </button>
    </motion.div>
  )
}
