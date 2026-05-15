import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { connectors, categories, type ConnectorConfig } from '@/lib/connectorsConfig'
import { ArrowLeft, Search, Zap, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlobalActivityPanel } from '@/components/connectors/GlobalActivityPanel'

export default function ConnectorsHubPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const filtered = connectors.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'all' || c.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const handleConnectorClick = (connector: ConnectorConfig) => {
    if (connector.internalRoute) {
      navigate(connector.internalRoute)
    } else {
      // Sempre passa pela subpágina interna de setup (exige API key) antes
      // de qualquer painel de gerenciamento. Nenhum redirect externo.
      navigate(`/connectors/${connector.slug}/setup`)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Conectores
            </h1>
            <p className="text-sm text-muted-foreground">
              Integre serviços externos à sua plataforma
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Global Activity */}
        <GlobalActivityPanel />

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conectores..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activeCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connectors Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {filtered.map(connector => (
            <motion.button
              key={connector.slug}
              onClick={() => handleConnectorClick(connector)}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
              }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={cn(
                'group relative text-left p-5 rounded-2xl border border-border bg-card',
                'hover:border-primary/40 hover:shadow-glow transition-colors duration-300',
                connector.status === 'coming_soon' && 'opacity-70'
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex items-center justify-center h-12 w-12 rounded-xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${connector.color}15` }}
                >
                  <connector.icon className="h-6 w-6" style={{ color: connector.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{connector.name}</h3>
                    {connector.status === 'coming_soon' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Em breve
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {connector.description}
                  </p>
                </div>
              </div>

              {/* Category tag */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {connector.category}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </motion.button>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Nenhum conector encontrado</p>
            <p className="text-sm mt-1">Tente ajustar seus filtros de busca</p>
          </div>
        )}
      </div>
    </div>
  )
}
