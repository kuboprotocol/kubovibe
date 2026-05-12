import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, AlertTriangle, Bug, Camera, ChevronDown, ChevronUp, Copy,
  Download, Info, Network, Search, Trash2, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PreviewLogEntry, PreviewLogKind } from '@/lib/iframePreview'

interface Props {
  logs: PreviewLogEntry[]
  onClear: () => void
  onClose?: () => void
  defaultOpen?: boolean
  /** Called when an auto-screenshot should be captured (on new error). */
  onAutoScreenshot?: (reason: string) => void
}

const KIND_META: Record<PreviewLogKind, { label: string; icon: typeof Info; color: string }> = {
  log: { label: 'log', icon: Info, color: 'text-muted-foreground' },
  info: { label: 'info', icon: Info, color: 'text-sky-400' },
  debug: { label: 'debug', icon: Bug, color: 'text-violet-400' },
  warn: { label: 'warn', icon: AlertTriangle, color: 'text-amber-400' },
  error: { label: 'error', icon: AlertCircle, color: 'text-red-400' },
  exception: { label: 'exception', icon: AlertCircle, color: 'text-red-500' },
  rejection: { label: 'rejection', icon: AlertCircle, color: 'text-red-500' },
  resource: { label: 'resource', icon: AlertTriangle, color: 'text-orange-400' },
  network: { label: 'network', icon: Network, color: 'text-orange-400' },
  ready: { label: 'ready', icon: Info, color: 'text-emerald-400' },
}

const ERROR_KINDS: PreviewLogKind[] = ['error', 'exception', 'rejection', 'resource', 'network']

function csvEscape(v: unknown): string {
  if (v === undefined || v === null) return ''
  const s = String(v).replace(/"/g, '""')
  return /[",\n;]/.test(s) ? `"${s}"` : s
}

function entriesToCSV(entries: PreviewLogEntry[]): string {
  const cols = ['ts', 'iso', 'kind', 'message', 'source', 'line', 'col', 'method', 'status', 'url', 'duration', 'stack']
  const rows = entries.map(e => [
    e.ts, new Date(e.ts).toISOString(), e.kind, e.message,
    e.source ?? '', e.line ?? '', e.col ?? '',
    e.method ?? '', e.status ?? '', e.url ?? '', e.duration ?? '', e.stack ?? '',
  ])
  return [cols.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n')
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function buildErrorReport(entries: PreviewLogEntry[]): string {
  const errs = entries.filter(e => ERROR_KINDS.includes(e.kind))
  const ts = new Date().toISOString()
  const lines: string[] = [
    `# Preview audit report`,
    `Generated: ${ts}`,
    `Total events: ${entries.length} · Errors: ${errs.length}`,
    `User-Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
    ``,
    `## Errors`,
    ...errs.map((e, i) => {
      const head = `### [${i + 1}] ${e.kind.toUpperCase()} — ${new Date(e.ts).toISOString()}`
      const meta = [
        e.source && `source: ${e.source}${e.line ? `:${e.line}${e.col ? `:${e.col}` : ''}` : ''}`,
        e.method && `${e.method} ${e.url ?? ''}${e.status ? ` → ${e.status}` : ''}`,
        e.duration != null && `duration: ${e.duration}ms`,
      ].filter(Boolean).join(' · ')
      return [head, meta && `_${meta}_`, '', '```', e.message, e.stack ? '\n' + e.stack : '', '```', ''].filter(Boolean).join('\n')
    }),
  ]
  return lines.join('\n')
}

export default function PreviewAuditPanel({ logs, onClear, onClose, defaultOpen = false, onAutoScreenshot }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [filter, setFilter] = useState<'all' | 'errors' | 'network'>('all')
  const [query, setQuery] = useState('')
  const [autoShot, setAutoShot] = useState<boolean>(() => {
    try { return localStorage.getItem('kubo:audit:autoShot') === '1' } catch { return false }
  })
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastShotErrorIdRef = useRef<string | null>(null)

  const filtered = useMemo(() => {
    let list = logs
    if (filter === 'errors') list = list.filter(l => ERROR_KINDS.includes(l.kind))
    else if (filter === 'network') list = list.filter(l => l.kind === 'network')
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(l =>
        l.message.toLowerCase().includes(q) ||
        (l.url ?? '').toLowerCase().includes(q) ||
        (l.source ?? '').toLowerCase().includes(q) ||
        (l.stack ?? '').toLowerCase().includes(q) ||
        l.kind.includes(q),
      )
    }
    return list
  }, [logs, filter, query])

  const errorCount = logs.filter(l => ['error', 'exception', 'rejection'].includes(l.kind)).length
  const warnCount = logs.filter(l => ['warn', 'resource'].includes(l.kind)).length
  const netCount = logs.filter(l => l.kind === 'network').length

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [filtered.length, open])

  useEffect(() => {
    try { localStorage.setItem('kubo:audit:autoShot', autoShot ? '1' : '0') } catch {}
  }, [autoShot])

  // Auto-screenshot on new error
  useEffect(() => {
    if (!autoShot || !onAutoScreenshot) return
    const lastErr = [...logs].reverse().find(l => ERROR_KINDS.includes(l.kind))
    if (lastErr && lastErr.id !== lastShotErrorIdRef.current) {
      lastShotErrorIdRef.current = lastErr.id
      onAutoScreenshot(`${lastErr.kind}: ${lastErr.message.slice(0, 60)}`)
    }
  }, [logs, autoShot, onAutoScreenshot])

  const handleExportJSON = () => {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), count: filtered.length, entries: filtered }, null, 2)
    downloadBlob(data, `preview-logs-${Date.now()}.json`, 'application/json')
    toast.success('Logs exportados (JSON)')
  }
  const handleExportCSV = () => {
    downloadBlob(entriesToCSV(filtered), `preview-logs-${Date.now()}.csv`, 'text/csv')
    toast.success('Logs exportados (CSV)')
  }
  const handleCopyReport = async () => {
    const report = buildErrorReport(logs)
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      toast.success('Relatório copiado')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  // Keyboard shortcuts (Ctrl/Cmd + Shift + …)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || !e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'l') { e.preventDefault(); setOpen(o => !o) }
      else if (key === 'e') { e.preventDefault(); setOpen(true); handleExportJSON() }
      else if (key === 'c') { e.preventDefault(); setOpen(true); handleCopyReport() }
      else if (key === 'k') { e.preventDefault(); onClear() }
      else if (key === 'f') { e.preventDefault(); setOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, logs])

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border shadow-xl transition-all',
        open ? 'h-80' : 'h-9',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-border/50 gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors shrink-0"
          title="Ctrl+Shift+L"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          Auditoria do preview
          <span className="flex items-center gap-1.5 ml-1">
            {errorCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-mono font-semibold">
                {errorCount} erro{errorCount > 1 ? 's' : ''}
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-mono font-semibold">
                {warnCount} aviso{warnCount > 1 ? 's' : ''}
              </span>
            )}
            {netCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[10px] font-mono font-semibold">
                {netCount} rede
              </span>
            )}
            {errorCount === 0 && warnCount === 0 && netCount === 0 && logs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-semibold">
                ok · {logs.length}
              </span>
            )}
          </span>
        </button>

        {open && (
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <div className="relative max-w-[200px] flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar… (⌘⇧F)"
                className="h-6 pl-6 pr-2 text-[11px] font-mono bg-secondary/60"
              />
            </div>

            <div className="flex items-center gap-0.5 bg-secondary/60 rounded-md p-0.5">
              {(['all', 'errors', 'network'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded capitalize',
                    filter === f ? 'bg-background text-foreground' : 'text-muted-foreground',
                  )}
                >{f === 'all' ? 'Todos' : f === 'errors' ? 'Erros' : 'Rede'}</button>
              ))}
            </div>

            {onAutoScreenshot && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-6 w-6', autoShot && 'text-primary')}
                onClick={() => setAutoShot(s => !s)}
                title={autoShot ? 'Auto-screenshot ativo' : 'Ativar auto-screenshot em erros'}
              >
                <Camera className="h-3 w-3" />
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyReport} title="Copiar relatório (⌘⇧C)">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Exportar (⌘⇧E)">
                  <Download className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportJSON}>JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} title="Limpar (⌘⇧K)">
              <Trash2 className="h-3 w-3" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Fechar">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {open && (
        <div ref={scrollRef} className="overflow-auto h-[calc(100%-2.25rem)] font-mono text-[11px]">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              {query ? 'Nenhum log corresponde à busca.' : 'Nenhum evento capturado ainda.'}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map(l => {
                const meta = KIND_META[l.kind] || KIND_META.log
                const Icon = meta.icon
                return (
                  <li key={l.id} className="px-3 py-1.5 hover:bg-secondary/40">
                    <div className="flex items-start gap-2">
                      <Icon className={cn('h-3 w-3 mt-0.5 shrink-0', meta.color)} />
                      <span className={cn('uppercase text-[9px] font-semibold tracking-wide w-14 shrink-0 mt-0.5', meta.color)}>
                        {meta.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground whitespace-pre-wrap break-words">{l.message}</div>
                        {(l.method || l.status || l.duration != null) && (
                          <div className="text-[10px] text-orange-300/80 mt-0.5 font-mono">
                            {l.method ?? ''} {l.status ? `· ${l.status}` : ''} {l.duration != null ? `· ${l.duration}ms` : ''}
                          </div>
                        )}
                        {(l.source || l.line) && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {l.source}{l.line ? `:${l.line}${l.col ? ':' + l.col : ''}` : ''}
                          </div>
                        )}
                        {l.stack && (
                          <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-auto">
                            {l.stack}
                          </pre>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 mt-0.5">
                        {new Date(l.ts).toLocaleTimeString()}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
