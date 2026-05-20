import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Zap, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PROVIDERS } from '@/lib/web3Providers'

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  alchemy: Zap,
  infura: Zap,
  'custom-rpc': Server,
}

export default function ConnectorWeb3HubPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/connectors')} aria-label="Voltar para conectores">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
              Conectores Web3
            </h1>
            <p className="text-sm text-muted-foreground">
              Escolha um provedor RPC para conectar EVM, Solana ou UTXO chains.
            </p>
          </div>
        </div>
      </header>

      <main>
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none"
          data-testid="web3-providers-grid"
          aria-label="Provedores Web3 disponíveis"
        >
          {PROVIDERS.map((p) => {
            const Icon = ICONS[p.id] ?? Zap
            const href = `/connectors/web3/${p.id}`
            return (
              <motion.li
                key={p.id}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
              >
                <motion.a
                  href={href}
                  data-testid={`web3-provider-card-${p.id}`}
                  data-href={href}
                  onClick={(e) => {
                    // SPA navigation; allow modifier/middle-click to keep default
                    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as React.MouseEvent).button === 1) return
                    e.preventDefault()
                    navigate(href)
                  }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  aria-label={`Abrir ${p.label} · ${p.supportedNetworks.length} networks · ${href}`}
                  className="group block text-left p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-glow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Card className="border-0 bg-transparent shadow-none p-0 space-y-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${p.color}15` }}
                        aria-hidden="true"
                      >
                        <Icon className="h-6 w-6" style={{ color: p.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-foreground">{p.label}</h2>
                        <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      <span>{p.supportedNetworks.length} networks</span>
                      <ExternalLink className="h-3.5 w-3.5 group-hover:text-primary transition-colors" aria-hidden="true" />
                    </div>
                  </Card>
                </motion.a>
              </motion.li>
            )
          })}
        </motion.ul>
      </main>
    </div>
  )
}
