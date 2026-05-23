import { useEffect, useRef, useState } from 'react'
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

const UNDO_WINDOW_MS = 6000

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
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const confirmInputRef = useRef<HTMLInputElement | null>(null)
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const lastTriggerId = useRef<string | null>(null)
  // Undo bookkeeping: id -> { row, timer, undone }
  const pendingUndo = useRef<Map<string, { row: Row; timer: number; undone: boolean }>>(new Map())

  function openDeleteDialog(row: Row, trigger: HTMLButtonElement | null) {
    if (trigger) {
      triggerRefs.current.set(row.id, trigger)
      lastTriggerId.current = row.id
    }
    setPendingDelete(row)
    setConfirmText('')
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) {
      const id = lastTriggerId.current
      setPendingDelete(null)
      setConfirmText('')
      requestAnimationFrame(() => {
        if (id) triggerRefs.current.get(id)?.focus()
      })
    }
  }

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

  function restoreRow(row: Row) {
    setRows((prev) => {
      if (prev.some((r) => r.id === row.id)) return prev
      const next = [row, ...prev]
      return next.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    })
  }

  async function commitDelete(row: Row) {
    try {
      const { error } = await supabase.functions.invoke('web3-connection-delete', { body: { id: row.id } })
      if (error) throw error
      // success: nothing else to do, row already removed
    } catch (e: any) {
      // Janela de undo já expirou — usuário declinou desfazer. Tratamos como
      // falha terminal: NÃO restauramos a linha automaticamente para não
      // confundir o usuário; expomos ação "Tentar novamente" no toast.
      toast.error('Falha ao remover conexão', {
        description: e?.message ?? 'Erro ao chamar serviço de remoção.',
        action: {
          label: 'Tentar novamente',
          onClick: () => { commitDelete(row) },
        },
      })
    } finally {
      pendingUndo.current.delete(row.id)
    }
  }

  function scheduleDelete(row: Row) {
    // Optimistic remove
    setRows((prev) => prev.filter((r) => r.id !== row.id))

    const timer = window.setTimeout(() => {
      const entry = pendingUndo.current.get(row.id)
      if (!entry || entry.undone) return
      commitDelete(row)
    }, UNDO_WINDOW_MS)

    pendingUndo.current.set(row.id, { row, timer, undone: false })

    toast.success('Conexão removida', {
      description: `${row.connection_name} · desfazer disponível por ${UNDO_WINDOW_MS / 1000}s`,
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Desfazer',
        onClick: () => {
          const entry = pendingUndo.current.get(row.id)
          if (!entry) return
          entry.undone = true
          window.clearTimeout(entry.timer)
          pendingUndo.current.delete(row.id)
          restoreRow(row)
          toast.message('Remoção desfeita', { description: row.connection_name })
        },
      },
    })
  }

  function performDelete(row: Row) {
    setPendingDelete(null)
    setConfirmText('')
    scheduleDelete(row)
  }

  // Required token: "<connection_name>#<provider>:<id-prefix>"
  // ID prefix uses the first 8 chars of UUID — enough to be deliberate without forcing full UUID.
  const idPrefix = pendingDelete ? pendingDelete.id.slice(0, 8) : ''
  const requiredConfirm = pendingDelete
    ? `${pendingDelete.connection_name}#${pendingDelete.provider}:${idPrefix}`
    : ''
  const canConfirm = !!pendingDelete && confirmText.trim() === requiredConfirm.trim()

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      pendingUndo.current.forEach((e) => window.clearTimeout(e.timer))
      pendingUndo.current.clear()
    }
  }, [])

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
              <Button
                ref={(el) => {
                  if (el) triggerRefs.current.set(r.id, el)
                }}
                variant="outline"
                size="sm"
                onClick={(e) => openDeleteDialog(r, e.currentTarget)}
                disabled={busyId === r.id}
                aria-label={`Remover conexão ${r.connection_name}`}
                aria-haspopup="dialog"
                data-testid="row-delete"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          </Card>
        )
      })}

      <AlertDialog open={!!pendingDelete} onOpenChange={handleDialogOpenChange}>
        <AlertDialogContent
          data-testid="web3-delete-dialog"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            requestAnimationFrame(() => confirmInputRef.current?.focus())
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão Web3?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong> após a janela de desfazer (
              {UNDO_WINDOW_MS / 1000}s). A conexão{' '}
              <strong>{pendingDelete?.connection_name}</strong> (
              {getNetwork(pendingDelete?.network ?? '')?.label ?? pendingDelete?.network})
              será excluída e seus segredos cifrados serão apagados.
              <br />
              Para confirmar, digite exatamente o token abaixo (nome, provider e prefixo do ID):
              <br />
              <code
                data-testid="web3-delete-confirm-token"
                className="mt-2 inline-block break-all rounded bg-muted px-2 py-1 text-xs font-mono"
              >
                {requiredConfirm}
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            ref={confirmInputRef}
            data-testid="web3-delete-confirm-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredConfirm}
            aria-label="Confirmar token (nome#provider:idprefix)"
            aria-required="true"
            aria-invalid={confirmText.length > 0 && !canConfirm}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="web3-delete-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="web3-delete-confirm"
              disabled={!canConfirm}
              onClick={(e) => { e.preventDefault(); if (pendingDelete) performDelete(pendingDelete) }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
