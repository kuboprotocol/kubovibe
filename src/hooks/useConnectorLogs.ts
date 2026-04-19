import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface ConnectorLog {
  id: string
  connector_slug: string
  event_type: string
  message: string
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export function useConnectorLogs(connectorSlug: string) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<ConnectorLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('connector_activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('connector_slug', connectorSlug)
      .order('created_at', { ascending: false })
      .limit(20)
    setLogs((data ?? []) as ConnectorLog[])
    setLoading(false)
  }, [user, connectorSlug])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Realtime updates
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`connector-logs-${connectorSlug}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connector_activity_logs',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const row = payload.new as ConnectorLog
        if (row.connector_slug === connectorSlug) {
          setLogs(prev => [row, ...prev].slice(0, 20))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, connectorSlug])

  return { logs, loading, refetch: fetchLogs }
}

export async function logConnectorEvent(params: {
  connectorSlug: string
  eventType: string
  message: string
  status?: 'success' | 'error' | 'info' | 'warning'
  metadata?: Record<string, unknown>
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const row = {
    user_id: user.id,
    connector_slug: params.connectorSlug,
    event_type: params.eventType,
    message: params.message,
    status: params.status ?? 'success',
    metadata: (params.metadata ?? null) as never,
  }
  await supabase.from('connector_activity_logs').insert(row)
}
