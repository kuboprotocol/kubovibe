import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, AlertTriangle, Bug, Camera, ChevronDown, ChevronUp, Copy,
  Download, Info, Network, Search, Trash2, X, Check, Package, BarChart3, Clock,
  CheckSquare, Square, Share2, Link2, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import JSZip from 'jszip'
import type { PreviewLogEntry, PreviewLogKind } from '@/lib/iframePreview'
import { entriesToHAR, correlateErrors, correlationsToMarkdown, shareReport, type SharedReport } from '@/lib/auditBundle'

interface Props {
  logs: PreviewLogEntry[]
  onClear: () => void
  onClose?: () => void
  defaultOpen?: boolean
  onAutoScreenshot?: (reason: string) => void
}

type FilterKind = 'all' | 'errors' | 'network'
type TimeRange = 'all' | '1m' | '5m' | '15m' | '1h'

interface PersistedFilters {
  query: string
  filter: FilterKind
  range: TimeRange
}

const LS_KEY = 'kubo:audit:filters:v1'

function loadFilters(): PersistedFilters {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { query: '', filter: 'all', range: 'all', ...JSON.parse(raw) }
  } catch {}
  return { query: '', filter: 'all', range: 'all' }
}

const RANGE_MS: Record<TimeRange, number> = {
  all: Infinity, '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 60 * 60_000,
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

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 800)
}

interface EndpointStat {
  key: string; method: string; url: string
  count: number; failed: number; statuses: Record<string, number>
  totalDur: number; durSamples: number; lastTs: number
}

function summarizeNetwork(entries: PreviewLogEntry[]): EndpointStat[] {
  const map = new Map<string, EndpointStat>()
  for (const e of entries) {
    if (e.kind !== 'network') continue
    const url = e.url || '(unknown)'
    const method = e.method || 'GET'
    const key = `${method} ${url}`
    let s = map.get(key)
    if (!s) {
      s = { key, method, url, count: 0, failed: 0, statuses: {}, totalDur: 0, durSamples: 0, lastTs: 0 }
      map.set(key, s)
    }
    s.count++
    s.lastTs = Math.max(s.lastTs, e.ts)
    if (e.status) s.statuses[String(e.status)] = (s.statuses[String(e.status)] || 0) + 1
    if (!e.status || e.status >= 400) s.failed++
    if (typeof e.duration === 'number') { s.totalDur += e.duration; s.durSamples++ }
  }
  return [...map.values()].sort((a, b) => b.failed - a.failed || b.count - a.count)
}

function buildErrorReport(entries: PreviewLogEntry[]): string {
  const errs = entries.filter(e => ERROR_KINDS.includes(e.kind))
  const ts = new Date().toISOString()
  const stats = summarizeNetwork(entries)
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
    ``,
    `## Network endpoints (${stats.length})`,
    `| Method | URL | Hits | Failed | Avg ms | Statuses |`,
    `|---|---|---:|---:|---:|---|`,
    ...stats.map(s => `| ${s.method} | ${s.url} | ${s.count} | ${s.failed} | ${s.durSamples ? Math.round(s.totalDur / s.durSamples) : '–'} | ${Object.entries(s.statuses).map(([k, v]) => `${k}×${v}`).join(' ') || '–'} |`),
  ]
  return lines.join('\n')
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export default function PreviewAuditPanel({ logs, onClear, onClose, defaultOpen = false, onAutoScreenshot }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const persisted = loadFilters()
  const [filter, setFilter] = useState<FilterKind>(persisted.filter)
  const [query, setQuery] = useState(persisted.query)
  const [range, setRange] = useState<TimeRange>(persisted.range)
  const [view, setView] = useState<'logs' | 'summary' | 'timeline'>('logs')
  const [autoShot, setAutoShot] = useState<boolean>(() => {
    try { return localStorage.getItem('kubo:audit:autoShot') === '1' } catch { return false }
  })
  const [copied, setCopied] = useState(false)
  const [bundling, setBundling] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [corrWindowMs, setCorrWindowMs] = useState<number>(() => {
    try { return Number(localStorage.getItem('kubo:audit:corrWindowMs')) || 2000 } catch { return 2000 }
  })
  const [protectShare, setProtectShare] = useState<boolean>(() => {
    try { return localStorage.getItem('kubo:audit:protectShare') !== '0' } catch { return true }
  })
  const [shareTtlSec, setShareTtlSec] = useState<number>(() => {
    try { return Number(localStorage.getItem('kubo:audit:shareTtlSec')) || 7 * 24 * 60 * 60 } catch { return 7 * 24 * 60 * 60 }
  })
  const [shareHistory, setShareHistory] = useState<SharedReport[]>(() => {
    try { return JSON.parse(localStorage.getItem('kubo:audit:shareHistory') || '[]') } catch { return [] }
  })
  const [bundleOpts, setBundleOpts] = useState<{ logs: boolean; report: boolean; har: boolean; correlations: boolean; network: boolean; screenshots: boolean }>(() => {
    try {
      const raw = localStorage.getItem('kubo:audit:bundleOpts')
      if (raw) return { logs: true, report: true, har: true, correlations: true, network: true, screenshots: true, ...JSON.parse(raw) }
    } catch {}
    return { logs: true, report: true, har: true, correlations: true, network: true, screenshots: true }
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastShotErrorIdRef = useRef<string | null>(null)
  const shotsRef = useRef<{ name: string; dataUrl: string; ts: number; reason?: string }[]>([])

  useEffect(() => {
    try { localStorage.setItem('kubo:audit:bundleOpts', JSON.stringify(bundleOpts)) } catch {}
  }, [bundleOpts])
  useEffect(() => { try { localStorage.setItem('kubo:audit:corrWindowMs', String(corrWindowMs)) } catch {} }, [corrWindowMs])
  useEffect(() => { try { localStorage.setItem('kubo:audit:protectShare', protectShare ? '1' : '0') } catch {} }, [protectShare])
  useEffect(() => { try { localStorage.setItem('kubo:audit:shareTtlSec', String(shareTtlSec)) } catch {} }, [shareTtlSec])
  useEffect(() => { try { localStorage.setItem('kubo:audit:shareHistory', JSON.stringify(shareHistory.slice(0, 20))) } catch {} }, [shareHistory])

  // Persist filters
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ query, filter, range })) } catch {}
  }, [query, filter, range])

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? -Infinity : Date.now() - RANGE_MS[range]
    let list = logs.filter(l => l.ts >= cutoff)
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
  }, [logs, filter, query, range])

  const errorCount = logs.filter(l => ['error', 'exception', 'rejection'].includes(l.kind)).length
  const warnCount = logs.filter(l => ['warn', 'resource'].includes(l.kind)).length
  const netCount = logs.filter(l => l.kind === 'network').length
  const networkStats = useMemo(() => summarizeNetwork(filtered), [filtered])
  const failedRequests = useMemo(
    () => logs.filter(l => l.kind === 'network' && (!l.status || l.status >= 400)),
    [logs],
  )

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [filtered.length, open])

  useEffect(() => {
    try { localStorage.setItem('kubo:audit:autoShot', autoShot ? '1' : '0') } catch {}
  }, [autoShot])

  // Auto-screenshot on new error + capture into bundle
  useEffect(() => {
    if (!autoShot) return
    const lastErr = [...logs].reverse().find(l => ERROR_KINDS.includes(l.kind))
    if (lastErr && lastErr.id !== lastShotErrorIdRef.current) {
      lastShotErrorIdRef.current = lastErr.id
      const reason = `${lastErr.kind}: ${lastErr.message.slice(0, 60)}`
      onAutoScreenshot?.(reason)
      // Also stash an in-memory copy for the ZIP bundle
      const cap = (window as any).__kuboCapturePreview
      if (typeof cap === 'function') {
        cap().then((res: { dataUrl: string } | null) => {
          if (res?.dataUrl) {
            shotsRef.current.push({
              name: `auto-${new Date(lastErr.ts).toISOString().replace(/[:.]/g, '-')}.png`,
              dataUrl: res.dataUrl, ts: lastErr.ts, reason,
            })
          }
        }).catch(() => {})
      }
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
    try {
      await navigator.clipboard.writeText(buildErrorReport(logs))
      setCopied(true)
      toast.success('Relatório copiado')
      setTimeout(() => setCopied(false), 1500)
    } catch { toast.error('Falha ao copiar') }
  }
  const handleCopyFailed = async () => {
    if (failedRequests.length === 0) { toast('Nenhuma requisição falha'); return }
    const payload = failedRequests.map(e => ({
      ts: new Date(e.ts).toISOString(), method: e.method, url: e.url,
      status: e.status ?? null, duration: e.duration ?? null, message: e.message,
    }))
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success(`${payload.length} requisição(ões) falha(s) copiada(s)`)
    } catch { toast.error('Falha ao copiar') }
  }

  const buildBundle = async (): Promise<{ blob: Blob; ts: string }> => {
    const zip = new JSZip()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    // Pick source set: selected items if any, else all logs
    const source = selectMode && selected.size > 0 ? logs.filter(l => selected.has(l.id)) : logs
    const correlations = correlateErrors(source, corrWindowMs)

    if (bundleOpts.logs) {
      zip.file('logs.json', JSON.stringify({ exportedAt: new Date().toISOString(), count: source.length, entries: source }, null, 2))
      zip.file('logs.csv', entriesToCSV(source))
    }
    if (bundleOpts.report) {
      const base = buildErrorReport(source)
      const corr = bundleOpts.correlations ? `\n\n## Correlações erro × rede (±${corrWindowMs}ms)\n${correlationsToMarkdown(correlations)}` : ''
      zip.file('report.md', base + corr)
    }
    if (bundleOpts.network) {
      zip.file('network-summary.json', JSON.stringify(summarizeNetwork(source), null, 2))
    }
    if (bundleOpts.har) {
      zip.file('network.har', JSON.stringify(entriesToHAR(source), null, 2))
    }
    if (bundleOpts.correlations) {
      zip.file('correlations.json', JSON.stringify(correlations, null, 2))
    }
    zip.file('meta.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: location.href,
      counts: { total: source.length, errors: errorCount, warnings: warnCount, network: netCount },
      selection: { mode: selectMode, count: selected.size },
      filters: { query, filter, range },
      includes: bundleOpts,
    }, null, 2))

    if (bundleOpts.screenshots) {
      const shotsFolder = zip.folder('screenshots')
      for (const s of shotsRef.current) shotsFolder?.file(s.name, dataUrlToBlob(s.dataUrl))
      const cap = (window as any).__kuboCapturePreview
      if (typeof cap === 'function') {
        try {
          const res = await cap()
          if (res?.dataUrl) shotsFolder?.file(`current-${ts}.png`, dataUrlToBlob(res.dataUrl))
        } catch {}
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    return { blob, ts }
  }

  const handleBundleZip = async () => {
    setBundling(true)
    try {
      const { blob, ts } = await buildBundle()
      downloadBlob(blob, `preview-bundle-${ts}.zip`, 'application/zip')
      toast.success('Bundle ZIP gerado')
    } catch (e: any) {
      toast.error('Falha ao gerar ZIP: ' + (e?.message || 'erro'))
    } finally {
      setBundling(false)
    }
  }

  const handleShareReport = async () => {
    setSharing(true)
    try {
      const { blob } = await buildBundle()
      const shared = await shareReport(blob, { protect: protectShare, expiresInSec: shareTtlSec })
      try { await navigator.clipboard.writeText(shared.url) } catch {}
      setShareHistory(h => [shared, ...h].slice(0, 20))
      toast.success(
        protectShare ? 'Link protegido copiado' : 'Link público copiado',
        { description: shared.expiresAt ? `Expira em ${new Date(shared.expiresAt).toLocaleString()}` : shared.url },
      )
    } catch (e: any) {
      toast.error('Falha ao compartilhar: ' + (e?.message || 'erro'))
    } finally {
      setSharing(false)
    }
  }

  const copyShared = async (s: SharedReport) => {
    try { await navigator.clipboard.writeText(s.url); toast.success('Link copiado') }
    catch { toast.error('Falha ao copiar') }
  }
  const clearShareHistory = () => { setShareHistory([]); toast.success('Histórico limpo') }

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAllVisible = () => setSelected(new Set(filtered.map(l => l.id)))
  const clearSelection = () => setSelected(new Set())

  // Keyboard shortcuts (Ctrl/Cmd + Shift + …)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || !e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'l') { e.preventDefault(); setOpen(o => !o) }
      else if (key === 'e') { e.preventDefault(); setOpen(true); handleExportJSON() }
      else if (key === 'b') { e.preventDefault(); setOpen(true); handleBundleZip() }
      else if (key === 's') { e.preventDefault(); setOpen(true); handleShareReport() }
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
      <div className="flex items-center justify-between px-3 h-9 border-b border-border/50 gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors shrink-0"
          title="Ctrl+Shift+L"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          Auditoria do preview
          <span className="flex items-center gap-1.5 ml-1">
            {errorCount > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-mono font-semibold">{errorCount} erro{errorCount > 1 ? 's' : ''}</span>}
            {warnCount > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-mono font-semibold">{warnCount} aviso{warnCount > 1 ? 's' : ''}</span>}
            {netCount > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[10px] font-mono font-semibold">{netCount} rede</span>}
            {errorCount === 0 && warnCount === 0 && netCount === 0 && logs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-semibold">ok · {logs.length}</span>
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
                  className={cn('px-2 py-0.5 text-[10px] rounded capitalize',
                    filter === f ? 'bg-background text-foreground' : 'text-muted-foreground')}
                >{f === 'all' ? 'Todos' : f === 'errors' ? 'Erros' : 'Rede'}</button>
              ))}
            </div>

            {/* Time range */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1">
                  <Clock className="h-3 w-3" />
                  {range === 'all' ? 'todos' : range}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[10px]">Intervalo de tempo</DropdownMenuLabel>
                {(['all', '1m', '5m', '15m', '1h'] as const).map(r => (
                  <DropdownMenuItem key={r} onClick={() => setRange(r)}>
                    {r === 'all' ? 'Todos' : `Últimos ${r}`}
                    {range === r && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-0.5 bg-secondary/60 rounded-md p-0.5">
              {([
                ['logs', 'Logs'],
                ['summary', 'Rede'],
                ['timeline', 'Timeline'],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('px-2 py-0.5 text-[10px] rounded',
                    view === v ? 'bg-background text-foreground' : 'text-muted-foreground')}
                  title={`Ver ${label}`}
                >{v === 'summary' ? <BarChart3 className="h-3 w-3 inline" /> : v === 'timeline' ? <Clock className="h-3 w-3 inline" /> : label}</button>
              ))}
            </div>

            {/* Correlation window */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1" title="Janela de correlação erro × rede">
                  ±{corrWindowMs >= 1000 ? `${corrWindowMs / 1000}s` : `${corrWindowMs}ms`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[10px]">Janela de correlação</DropdownMenuLabel>
                {[500, 1000, 2000, 5000, 10000, 30000].map(ms => (
                  <DropdownMenuItem key={ms} onClick={() => setCorrWindowMs(ms)}>
                    ±{ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                    {corrWindowMs === ms && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {onAutoScreenshot && (
              <Button
                variant="ghost" size="icon"
                className={cn('h-6 w-6', autoShot && 'text-primary')}
                onClick={() => setAutoShot(s => !s)}
                title={autoShot ? 'Auto-screenshot ativo' : 'Ativar auto-screenshot em erros'}
              >
                <Camera className="h-3 w-3" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Copiar">
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyReport}>Relatório completo (⌘⇧C)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyFailed}>
                  Requisições falhas {failedRequests.length > 0 && `(${failedRequests.length})`}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost" size="icon"
              className={cn('h-6 w-6', selectMode && 'text-primary')}
              onClick={() => { setSelectMode(s => !s); if (selectMode) clearSelection() }}
              title={selectMode ? `Selecionados: ${selected.size}` : 'Selecionar itens para o ZIP'}
            >
              {selectMode ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
            </Button>
            {selectMode && (
              <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {selected.size}/{filtered.length}
                <button onClick={selectAllVisible} className="ml-1 underline">todos</button>
                {selected.size > 0 && <button onClick={clearSelection} className="ml-1 underline">limpar</button>}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Exportar">
                  <Download className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={handleExportJSON}>JSON (⌘⇧E)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>CSV</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px]">Conteúdo do bundle</DropdownMenuLabel>
                {([
                  ['logs', 'Logs (JSON + CSV)'],
                  ['report', 'Relatório (Markdown)'],
                  ['network', 'Resumo de endpoints'],
                  ['har', 'HAR de rede'],
                  ['correlations', 'Correlações erro × rede'],
                  ['screenshots', 'Screenshots'],
                ] as const).map(([k, label]) => (
                  <DropdownMenuCheckboxItem
                    key={k}
                    checked={bundleOpts[k]}
                    onCheckedChange={(v) => setBundleOpts(o => ({ ...o, [k]: !!v }))}
                    onSelect={(e) => e.preventDefault()}
                  >{label}</DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleBundleZip} disabled={bundling}>
                  {bundling ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Package className="h-3 w-3 mr-2" />}
                  Bundle ZIP (⌘⇧B)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareReport} disabled={sharing}>
                  {sharing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Share2 className="h-3 w-3 mr-2" />}
                  Compartilhar por link (⌘⇧S)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={handleShareReport} disabled={sharing}
              title="Compartilhar relatório por link (⌘⇧S)"
            >
              {sharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            </Button>

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
          {showSummary ? (
            networkStats.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                Nenhuma requisição de rede capturada.
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium">Method</th>
                    <th className="text-left px-3 py-1.5 font-medium">URL</th>
                    <th className="text-right px-2 py-1.5 font-medium">Hits</th>
                    <th className="text-right px-2 py-1.5 font-medium">Falhas</th>
                    <th className="text-right px-2 py-1.5 font-medium">Avg ms</th>
                    <th className="text-left px-3 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {networkStats.map(s => (
                    <tr key={s.key} className="border-b border-border/20 hover:bg-secondary/40">
                      <td className="px-3 py-1 text-sky-400">{s.method}</td>
                      <td className="px-3 py-1 text-foreground truncate max-w-[420px]" title={s.url}>{s.url}</td>
                      <td className="px-2 py-1 text-right">{s.count}</td>
                      <td className={cn('px-2 py-1 text-right', s.failed > 0 ? 'text-red-400 font-semibold' : 'text-muted-foreground')}>{s.failed}</td>
                      <td className="px-2 py-1 text-right text-muted-foreground">{s.durSamples ? Math.round(s.totalDur / s.durSamples) : '–'}</td>
                      <td className="px-3 py-1 text-muted-foreground">
                        {Object.entries(s.statuses).map(([k, v]) => (
                          <span key={k} className={cn('mr-1.5', Number(k) >= 400 ? 'text-red-400' : 'text-emerald-400')}>{k}×{v}</span>
                        )) || '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              {query || range !== 'all' || filter !== 'all' ? 'Nenhum log corresponde aos filtros.' : 'Nenhum evento capturado ainda.'}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map(l => {
                const meta = KIND_META[l.kind] || KIND_META.log
                const Icon = meta.icon
                return (
                  <li key={l.id} className={cn('px-3 py-1.5 hover:bg-secondary/40', selectMode && selected.has(l.id) && 'bg-primary/10')}>
                    <div className="flex items-start gap-2">
                      {selectMode && (
                        <Checkbox
                          checked={selected.has(l.id)}
                          onCheckedChange={() => toggleSelected(l.id)}
                          className="mt-0.5 shrink-0 h-3.5 w-3.5"
                        />
                      )}
                      <Icon className={cn('h-3 w-3 mt-0.5 shrink-0', meta.color)} />
                      <span className={cn('uppercase text-[9px] font-semibold tracking-wide w-14 shrink-0 mt-0.5', meta.color)}>{meta.label}</span>
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
                          <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-words max-h-24 overflow-auto">{l.stack}</pre>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 mt-0.5">{new Date(l.ts).toLocaleTimeString()}</span>
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
