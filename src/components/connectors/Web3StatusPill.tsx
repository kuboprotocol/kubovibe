import { Loader2, CheckCircle2, XCircle, CircleDashed } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'connected' | 'offline' | 'error' | 'unknown'

export default function Web3StatusPill({ status, checking = false, className }: { status: Status | string | null; checking?: boolean; className?: string }) {
  const s: Status = (status === 'connected' || status === 'error' || status === 'offline') ? status : 'unknown'
  const map: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    connected: { label: 'Connected',  cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', Icon: CheckCircle2 },
    error:     { label: 'Error',      cls: 'border-red-500/40 bg-red-500/10 text-red-300',             Icon: XCircle },
    offline:   { label: 'Offline',    cls: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',          Icon: CircleDashed },
    unknown:   { label: 'Unknown',    cls: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400',          Icon: CircleDashed },
  }
  const { label, cls, Icon } = map[s]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', cls, className)}>
      {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {checking ? 'Testing…' : label}
    </span>
  )
}
