import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Copy, Check, Trash2, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface AgentKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

/**
 * Tokens de longa duração do KUBO Local Agent. O usuário gera aqui, cola no
 * "KUBO: Pair this workspace" do VS Code/Cursor, e o agent passa a cobrar
 * as ações de IA direto no saldo do Vibe Bank — sem expirar em 1h como o
 * token de sessão.
 */
export default function LocalAgentTokens() {
  const { user } = useAuth()
  const [keys, setKeys] = useState<AgentKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('local-agent-keys', { method: 'GET' })
    setLoading(false)
    if (error || !data?.ok) return
    setKeys(data.keys as AgentKey[])
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const create = async () => {
    setCreating(true)
    const { data, error } = await supabase.functions.invoke('local-agent-keys', {
      method: 'POST',
      body: { name: 'Local Agent' },
    })
    setCreating(false)
    if (error || !data?.ok) {
      toast.error(data?.error ?? 'Não foi possível gerar o token')
      return
    }
    setFresh(data.key as string)
    setCopied(false)
    load()
  }

  const revoke = async (id: string) => {
    const { data, error } = await supabase.functions.invoke(`local-agent-keys?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (error || !data?.ok) {
      toast.error('Não foi possível revogar o token')
      return
    }
    toast.success('Token revogado')
    load()
  }

  const copy = async () => {
    if (!fresh) return
    try {
      await navigator.clipboard.writeText(fresh)
      setCopied(true)
    } catch {
      toast.error('Copie manualmente — o navegador bloqueou a área de transferência')
    }
  }

  const active = keys.filter((k) => !k.revoked_at)

  return (
    <section className="mt-10 rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Conecte o agent ao seu saldo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere um token e cole no comando <strong className="text-foreground">KUBO: Pair this workspace</strong>{' '}
            no VS Code/Cursor. As ações de IA feitas na sua máquina passam a ser cobradas no mesmo saldo de
            créditos do KUBO Vibe. Terminal e git continuam grátis.
          </p>

          {!user ? (
            <Button asChild variant="outline" className="mt-4 rounded-xl">
              <Link to="/auth">Entrar para gerar um token</Link>
            </Button>
          ) : (
            <>
              {fresh && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground">
                    Copie agora — por segurança, este token não será mostrado de novo.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground">
                      {fresh}
                    </code>
                    <Button size="icon" variant="outline" className="shrink-0 rounded-lg" onClick={copy} aria-label="Copiar token">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={create} disabled={creating} className="mt-4 rounded-xl">
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Gerar token do Local Agent
              </Button>

              {loading && keys.length === 0 ? null : active.length > 0 && (
                <ul className="mt-5 divide-y divide-border/50 rounded-xl border border-border/50">
                  {active.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <code className="text-foreground">{k.key_prefix}…</code>
                      <Badge variant="outline" className="hidden sm:inline-flex text-[10px] text-muted-foreground">
                        criado {fmt(k.created_at)}
                      </Badge>
                      <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
                        último uso: {fmt(k.last_used_at)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
                        onClick={() => revoke(k.id)}
                        aria-label="Revogar token"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
