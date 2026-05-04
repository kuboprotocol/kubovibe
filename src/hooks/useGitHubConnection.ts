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
    const maxAttempts = 3
    let attempt = 0
    let lastErr: unknown = null

    try {
      while (attempt < maxAttempts) {
        attempt++
        const { data, error } = await supabase.functions.invoke('github-auth', {
          body: { returnUrl: window.location.href },
        })

        // Detecta 429: edge function retorna { error: 'rate_limited', retry_after_seconds }
        // O FunctionsHttpError vem em `error.context.response`
        const ctxResp = (error as { context?: { response?: Response } } | null)
          ?.context?.response
        const status = ctxResp?.status
        let retryAfter = 0
        let payload: { error?: string; retry_after_seconds?: number } | null = null
        if (ctxResp) {
          try { payload = await ctxResp.clone().json() } catch { /* noop */ }
          const headerRA = ctxResp.headers.get('Retry-After')
          const rawHint = payload?.retry_after_seconds ?? headerRA
          const parsed =
            rawHint === null || rawHint === undefined || rawHint === ''
              ? 0
              : Number(rawHint)
          retryAfter = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
        }

        if (status === 429 || payload?.error === 'rate_limited') {
          if (attempt < maxAttempts) {
            const waitMs = Math.min(
              Math.max(retryAfter * 1000, 1000 * 2 ** (attempt - 1)),
              15_000,
            )
            console.warn(`[github-auth] 429 — retry ${attempt}/${maxAttempts} em ${waitMs}ms`, payload)
            toast.warning(`Muitas tentativas. Tentando novamente em ${Math.ceil(waitMs / 1000)}s…`)
            await new Promise((r) => setTimeout(r, waitMs))
            continue
          }
          toast.error(
            `Limite de conexões atingido. Tente novamente em ${retryAfter || 60}s.`,
          )
          setConnecting(false)
          return
        }

        if (error) { lastErr = error; throw error }
        if (data?.url) {
          window.location.href = data.url
          return
        }
        throw new Error('Resposta sem URL de autorização')
      }
    } catch (err) {
      console.error('[github-auth] falha após retries', { attempt, err: lastErr ?? err })
      toast.error('Erro ao iniciar conexão GitHub')
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
