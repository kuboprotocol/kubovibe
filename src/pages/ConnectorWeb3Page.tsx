import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getProvider } from '@/lib/web3Providers'
import Web3ConnectionForm, { type Web3EditingConnection } from '@/components/connectors/Web3ConnectionForm'
import Web3ConnectionList from '@/components/connectors/Web3ConnectionList'

export default function ConnectorWeb3Page() {
  const { provider: providerParam = '' } = useParams<{ provider: string }>()
  const navigate = useNavigate()
  const provider = getProvider(providerParam)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editing, setEditing] = useState<Web3EditingConnection | null>(null)

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <p className="text-lg">Web3 provider not found</p>
          <Button onClick={() => navigate('/connectors')}>Back to connectors</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/connectors/web3')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={() => navigate('/connectors/web3')}
            className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground"
          >
            ← Web3 Hub
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${provider.color}20` }}>
              <span className="text-base font-bold" style={{ color: provider.color }}>{provider.label[0]}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold font-display">{provider.label} · Web3 RPC</h1>
              <p className="text-xs text-muted-foreground">Setup multi-network · KUBO Vibe Dev</p>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-3xl mx-auto px-4 py-8 space-y-6"
      >
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Third-party service</p>
            <p className="text-muted-foreground text-xs">
              {provider.label} is an external provider. Limits, charges, and SLAs are the provider's
              responsibility. KUBO only integrates the RPC using your key (AES-256-GCM encrypted).
            </p>
          </div>
        </Card>

        <Card className="p-4 border-primary/30 bg-primary/5 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Your API Key and RPC URL are encrypted before being stored. Only KUBO's edge functions can decrypt
            them to run connection tests on your behalf.
          </p>
        </Card>

        <Web3ConnectionList
          providerId={provider.id}
          refreshKey={refreshKey}
          onEdit={(row) => {
            const formEl = typeof document !== 'undefined'
              ? document.querySelector('[data-testid="web3-connection-form"]')
              : null
            const isDirty = formEl?.getAttribute('data-dirty') === 'true'
            if (isDirty && !window.confirm('You have unsaved changes. Switch connections and discard them?')) return
            setEditing(row)
            if (typeof window !== 'undefined') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
          }}
        />

        <Web3ConnectionForm
          providerId={provider.id}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSaved={() => {
            setRefreshKey((k) => k + 1)
            setEditing(null)
          }}
        />
      </motion.div>
    </div>
  )
}
