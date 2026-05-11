import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Bug, ChevronDown, ChevronUp, Info, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PreviewLogEntry, PreviewLogKind } from '@/lib/iframePreview'

interface Props {
  logs: PreviewLogEntry[]
  onClear: () => void
  onClose?: () => void
  defaultOpen?: boolean
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
  ready: { label: 'ready', icon: Info, color: 'text-emerald-400' },
}

export default function PreviewAuditPanel({ logs, onClear, onClose, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [filter, setFilter] = useState<'all' | 'errors'>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'errors'
    ? logs.filter(l => ['error', 'exception', 'rejection', 'resource', 'warn'].includes(l.kind))
    : logs

  const errorCount = logs.filter(l => ['error', 'exception', 'rejection'].includes(l.kind)).length
  const warnCount = logs.filter(l => ['warn', 'resource'].includes(l.kind)).length

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filtered.length, open])

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border shadow-xl transition-all',
        open ? 'h-72' : 'h-9',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-border/50">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors"
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
            {errorCount === 0 && warnCount === 0 && logs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-semibold">
                ok · {logs.length}
              </span>
            )}
          </span>
        </button>
        {open && (
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 bg-secondary/60 rounded-md p-0.5 mr-1">
              <button
                onClick={() => setFilter('all')}
                className={cn('px-2 py-0.5 text-[10px] rounded', filter === 'all' ? 'bg-background text-foreground' : 'text-muted-foreground')}
              >Todos</button>
              <button
                onClick={() => setFilter('errors')}
                className={cn('px-2 py-0.5 text-[10px] rounded', filter === 'errors' ? 'bg-background text-foreground' : 'text-muted-foreground')}
              >Erros</button>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} title="Limpar">
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
              Nenhum evento capturado ainda.
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
