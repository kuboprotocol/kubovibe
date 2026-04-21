import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { connectors } from '@/lib/connectorsConfig'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle2, XCircle, AlertCircle, Info, ChevronRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface GlobalLog {
  id: string
  connector_slug: string
  event_type: string
  message: string
  status: string
  created_at: string
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'success': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
    case 'error': return <XCircle className="h-3.5 w-3.5 text-destructive" />
    case 'warning': return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
    default: return <Info className="h-3.5 w-3.5 text-blue-500" />
  }
}

export function GlobalActivityPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState<GlobalLog[]>([])
  const [loading, setLoading] = useState(true)

  const connectorMap = useMemo(() => {
    const map = new Map<string, typeof connectors[0]>()
    connectors.forEach(c => map.set(c.slug, c))
    return map
  }, [])

  const fetchLogs = async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('connector_activity_logs')
      .select('id, connector_slug, event_type, message, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setLogs((data ?? []) as GlobalLog[])
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [user])

  // Realtime
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('global-connector-logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connector_activity_logs',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setLogs(prev => [payload.new as GlobalLog, ...prev].slice(0, 10))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  if (!user) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="h-4 w-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold">Atividade Global</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {logs.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={fetchLogs}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhuma atividade ainda. Conecte um serviço para começar.
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {logs.map(log => {
                const connector = connectorMap.get(log.connector_slug)
                const Icon = connector?.icon
                return (
                  <motion.li
                    key={log.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <button
                      onClick={() => navigate(`/connectors/${log.connector_slug}`)}
                      className="w-full text-left px-5 py-2.5 hover:bg-accent/40 transition-colors flex items-center gap-3 group"
                    >
                      <div
                        className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0"
                        style={{ backgroundColor: connector ? `${connector.color}15` : 'hsl(var(--muted))' }}
                      >
                        {Icon ? (
                          <Icon className="h-4 w-4" style={{ color: connector!.color }} />
                        ) : (
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {statusIcon(log.status)}
                          <span className="text-xs font-medium truncate">
                            {connector?.name ?? log.connector_slug}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">
                            · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.div>
  )
}
