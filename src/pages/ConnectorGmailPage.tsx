import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Mail, Plus, RefreshCw, Send, Trash2, Inbox, Search, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface GmailAccount {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  last_synced_at: string | null
  created_at: string
}

interface GmailMessage {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
}

export default function ConnectorGmailPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [accounts, setAccounts] = useState<GmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' })

  // Busca + paginação
  const PAGE_SIZE = 15
  const [searchQ, setSearchQ] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<{ q: string; from: string; subject: string }>({ q: '', from: '', subject: '' })
  const [pageTokens, setPageTokens] = useState<string[]>([]) // histórico p/ "anterior"
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [resultEstimate, setResultEstimate] = useState<number>(0)

  // Handle callback feedback
  useEffect(() => {
    const err = params.get('error')
    const gmail = params.get('gmail')
    const email = params.get('email')
    if (err) toast.error(`Falha ao conectar Gmail: ${err}`)
    if (gmail === 'connected' && email) toast.success(`${email} conectado com sucesso`)
    if (err || gmail) {
      const next = new URLSearchParams(params); next.delete('error'); next.delete('gmail'); next.delete('email')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const fetchAccounts = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('gmail_accounts')
      .select('id, email, display_name, avatar_url, last_synced_at, created_at')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else {
      setAccounts(data ?? [])
      if (!activeId && data && data.length > 0) setActiveId(data[0].id)
    }
    setLoading(false)
  }

  useEffect(() => { fetchAccounts() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user])

  const handleConnect = async () => {
    const { data, error } = await supabase.functions.invoke('gmail-oauth-start', {
      body: { returnUrl: '/connectors/gmail', origin: window.location.origin },
    })
    if (error || !data?.url) { toast.error('Não foi possível iniciar OAuth'); return }
    window.location.href = data.url as string
  }

  const fetchMessages = async (
    accountId: string,
    opts: { pageToken?: string | null; filters?: { q: string; from: string; subject: string }; resetPagination?: boolean } = {},
  ) => {
    const filters = opts.filters ?? appliedFilters
    setLoadingMsgs(true); setMessages([])
    const { data, error } = await supabase.functions.invoke('gmail-list-messages', {
      body: {
        accountId,
        maxResults: PAGE_SIZE,
        q: filters.q || undefined,
        from: filters.from || undefined,
        subject: filters.subject || undefined,
        pageToken: opts.pageToken || undefined,
      },
    })
    if (error) {
      toast.error(error.message)
      setNextToken(null); setResultEstimate(0)
    } else {
      const d = data as { messages?: GmailMessage[]; nextPageToken?: string | null; resultSizeEstimate?: number }
      setMessages(d?.messages ?? [])
      setNextToken(d?.nextPageToken ?? null)
      setResultEstimate(d?.resultSizeEstimate ?? 0)
      if (opts.resetPagination) { setPageTokens([]); setCurrentToken(null) }
    }
    setLoadingMsgs(false)
  }

  useEffect(() => {
    if (!activeId) return
    setPageTokens([]); setCurrentToken(null)
    fetchMessages(activeId, { pageToken: null, resetPagination: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const applyFilters = () => {
    if (!activeId) return
    const next = { q: searchQ.trim(), from: filterFrom.trim(), subject: filterSubject.trim() }
    setAppliedFilters(next)
    setPageTokens([]); setCurrentToken(null)
    fetchMessages(activeId, { pageToken: null, filters: next, resetPagination: true })
  }

  const clearFilters = () => {
    setSearchQ(''); setFilterFrom(''); setFilterSubject('')
    const empty = { q: '', from: '', subject: '' }
    setAppliedFilters(empty)
    if (activeId) {
      setPageTokens([]); setCurrentToken(null)
      fetchMessages(activeId, { pageToken: null, filters: empty, resetPagination: true })
    }
  }

  const goNextPage = () => {
    if (!activeId || !nextToken) return
    setPageTokens(prev => [...prev, currentToken ?? ''])
    setCurrentToken(nextToken)
    fetchMessages(activeId, { pageToken: nextToken })
  }

  const goPrevPage = () => {
    if (!activeId || pageTokens.length === 0) return
    const prev = [...pageTokens]
    const target = prev.pop() ?? ''
    setPageTokens(prev)
    const token = target || null
    setCurrentToken(token)
    fetchMessages(activeId, { pageToken: token })
  }

  const hasActiveFilters = appliedFilters.q || appliedFilters.from || appliedFilters.subject
  const pageNumber = pageTokens.length + 1

  const handleDisconnect = async (id: string) => {
    if (!confirm('Desconectar esta conta Gmail?')) return
    const { error } = await supabase.functions.invoke('gmail-disconnect', { body: { accountId: id } })
    if (error) toast.error(error.message)
    else { toast.success('Conta desconectada'); if (activeId === id) { setActiveId(null); setMessages([]) } fetchAccounts() }
  }

  const handleSend = async () => {
    if (!activeId) return
    setSending(true)
    const { error } = await supabase.functions.invoke('gmail-send-message', {
      body: { accountId: activeId, ...composeData },
    })
    setSending(false)
    if (error) { toast.error(error.message); return }
    toast.success('Email enviado')
    setComposeOpen(false)
    setComposeData({ to: '', subject: '', body: '' })
    fetchMessages(activeId)
  }

  const active = accounts.find(a => a.id === activeId)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/connectors')} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-['Orbitron'] flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#C9941A]" /> Gmail
            </h1>
            <p className="text-sm text-muted-foreground">Conecte suas contas Gmail para leitura e envio via IA.</p>
          </div>
          <Button onClick={handleConnect} className="gap-2">
            <Plus className="h-4 w-4" /> Conectar conta
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-[280px_1fr] gap-6">
        {/* Accounts column */}
        <aside className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Contas conectadas
          </h2>
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && accounts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma conta conectada. Clique em "Conectar conta".
              </CardContent>
            </Card>
          )}
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveId(a.id)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                activeId === a.id ? 'border-[#C9941A] bg-[#C9941A]/10' : 'border-border hover:border-[#C9941A]/40'
              }`}
            >
              <div className="flex items-center gap-2">
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                    {a.email[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.display_name ?? a.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
              </div>
            </button>
          ))}
        </aside>

        {/* Inbox column */}
        <section>
          {!active ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Selecione uma conta ou conecte uma nova.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="h-4 w-4" /> {active.email}
                  <Badge variant="outline" className="ml-2">OAuth Google</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchMessages(active.id)} disabled={loadingMsgs} className="gap-1">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingMsgs ? 'animate-spin' : ''}`} /> Atualizar
                  </Button>
                  <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1"><Send className="h-3.5 w-3.5" /> Novo</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Enviar email via {active.email}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="to">Para</Label>
                          <Input id="to" type="email" value={composeData.to}
                            onChange={e => setComposeData(d => ({ ...d, to: e.target.value }))}
                            placeholder="destinatario@exemplo.com" />
                        </div>
                        <div>
                          <Label htmlFor="subject">Assunto</Label>
                          <Input id="subject" value={composeData.subject}
                            onChange={e => setComposeData(d => ({ ...d, subject: e.target.value }))} />
                        </div>
                        <div>
                          <Label htmlFor="body">Mensagem</Label>
                          <Textarea id="body" rows={8} value={composeData.body}
                            onChange={e => setComposeData(d => ({ ...d, body: e.target.value }))} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSend} disabled={sending || !composeData.to || !composeData.subject || !composeData.body}>
                          {sending ? 'Enviando…' : 'Enviar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => handleDisconnect(active.id)} className="gap-1 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingMsgs ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Carregando emails…</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Caixa de entrada vazia.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {messages.map(m => (
                      <li key={m.id} className="px-4 py-3 hover:bg-accent/30 transition">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-sm font-medium truncate flex-1">{m.from || '(sem remetente)'}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {m.date ? new Date(m.date).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-sm truncate">{m.subject || '(sem assunto)'}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{m.snippet}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  )
}
