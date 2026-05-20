import { useEffect, useState } from 'react'
import { Loader2, Plug, Trash2, ExternalLink, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { getNetwork } from '@/lib/web3Networks'
import Web3StatusPill from './Web3StatusPill'
import type { Web3EditingConnection } from './Web3ConnectionForm'

interface Row {
  id: string
  provider: string
  network: string
  connection_name: string
  explorer_url: string
  api_key_hint: string | null
  last_status: string
  last_block: number | null
  last_latency_ms: number | null
  last_checked_at: string | null
  updated_at: string
}

export default function Web3ConnectionList({
  providerId,
  refreshKey = 0,
  onEdit,
}: {
  providerId: string
  refreshKey?: number
  onEdit?: (row: Web3EditingConnection) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('web3_connections')
      .select('id, provider, network, connection_name, explorer_url, api_key_hint, last_status, last_block, last_latency_ms, last_checked_at, updated_at')
      .eq('provider', providerId)
      .order('updated_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [providerId, refreshKey])

  // Realtime: status mudou no servidor → atualiza linha
  useEffect(() => {
    const channel = supabase
      .channel(`web3-conn-${providerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'web3_connections', filter: `provider=eq.${providerId}` },
        () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  async function handleTest(id: string) {
    setBusyId(id)
    try {
      const { data, error } = await supabase.functions.invoke('web3-connection-test', { body: { id } })
      if (error) throw error
      const r = data as { ok: boolean; blockNumber?: number; latencyMs: number; detail?: string; status: number }
      if (r.ok) toast.success(`OK · block ${r.blockNumber ?? '?'} · ${r.latencyMs}ms`)
      else toast.error(`Falha: ${r.detail ?? `HTTP ${r.status}`}`)
    } catch (e: any) { toast.error(e.message ?? 'erro') }
    finally { setBusyId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta conexão?')) return
    setBusyId(id)
    try {
      const { error } = await supabase.functions.invoke('web3-connection-delete', { body: { id } })
      if (error) throw error
      toast.success('Conexão removida')
      load()
    } catch (e: any) { toast.error(e.message ?? 'erro') }
    finally { setBusyId(null) }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (rows.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Conexões salvas</h3>
      {rows.map((r) => {
        const net = getNetwork(r.network)
        return (
          <Card key={r.id} className="p-4 flex items-center gap-4 flex-wrap" data-testid="web3-connection-row" data-connection-id={r.id}>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium truncate">{r.connection_name}</p>
                <Web3StatusPill status={r.last_status} checking={busyId === r.id} />
              </div>
              <p className="text-xs text-muted-foreground">
                {net?.label ?? r.network} · {r.api_key_hint ?? '••••'}
                {r.last_block != null && <> · block {r.last_block}</>}
                {r.last_latency_ms != null && <> · {r.last_latency_ms}ms</>}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild aria-label="Abrir explorer">
                <a href={r.explorer_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleTest(r.id)} disabled={busyId === r.id} aria-label="Testar" data-testid="row-test">
                {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              </Button>
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit({
                    id: r.id,
                    network: r.network,
                    connection_name: r.connection_name,
                    explorer_url: r.explorer_url,
                    api_key_hint: r.api_key_hint,
                  })}
                  disabled={busyId === r.id}
                  aria-label="Editar"
                  data-testid="row-edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => handleDelete(r.id)} disabled={busyId === r.id} aria-label="Remover" data-testid="row-delete">
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
