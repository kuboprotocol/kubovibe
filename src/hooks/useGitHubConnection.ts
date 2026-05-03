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
      .from('github_connections')
      .select('id, github_username, github_avatar_url, scope, connected_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setConnection(data)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchConnection() }, [fetchConnection])

  // Handle OAuth callback params on mount (token agora persiste no servidor)
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      toast.success('GitHub conectado com sucesso!')
      fetchConnection()
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('error')) {
      toast.error(`Erro ao conectar: ${params.get('error')}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const connect = async () => {
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('github-auth', {
        body: { returnUrl: window.location.href },
      })
      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      toast.error('Erro ao iniciar conexão GitHub')
      console.error(err)
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!user) return
    const { error } = await supabase
      .from('github_connections')
      .delete()
      .eq('user_id', user.id)
    if (error) {
      toast.error('Erro ao desconectar')
    } else {
      setConnection(null)
      toast.info('GitHub desconectado.')
      logConnectorEvent({
        connectorSlug: 'github',
        eventType: 'disconnected',
        message: 'GitHub desconectado',
        status: 'info',
      })
    }
  }

  return { connection, loading, connecting, connect, disconnect, isConnected: !!connection }
}
