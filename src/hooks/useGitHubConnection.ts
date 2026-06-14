import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { logConnectorEvent } from '@/hooks/useConnectorLogs'

interface GitHubConnection {
  id: string
  github_username: string | null
  github_avatar_url: string | null
  scope: string | null
  connected_at: string
}

export function useGitHubConnection() {
  const { user } = useAuth()
  const [connection, setConnection] = useState<GitHubConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const fetchConnection = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('github_connections_safe')
      .select('id, github_username, github_avatar_url, scope, connected_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setConnection(data)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchConnection() }, [fetchConnection])

  // Handle OAuth callback params on mount (token now persists on the server)
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      toast.success('GitHub connected successfully!')
      fetchConnection()
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('error')) {
      toast.error(`Connection error: ${params.get('error')}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const connect = async () => {
    // GitHub now connects via PAT inside KUBO (no external OAuth).
    // Redirects the user to the internal setup subpage.
    setConnecting(true)
    window.location.href = '/connectors/github/setup'
  }

  const disconnect = async () => {
    if (!user) return
    const [{ error }, _] = await Promise.all([
      supabase.from('github_connections').delete().eq('user_id', user.id),
      supabase.from('api_credentials').delete().eq('user_id', user.id).eq('connector_slug', 'github'),
    ])
    if (error) {
      toast.error('Disconnection error')
    } else {
      setConnection(null)
      toast.info('GitHub disconnected.')
      logConnectorEvent({
        connectorSlug: 'github',
        eventType: 'disconnected',
        message: 'GitHub disconnected',
        status: 'info',
      })
    }
  }

  return { connection, loading, connecting, connect, disconnect, isConnected: !!connection }
}
