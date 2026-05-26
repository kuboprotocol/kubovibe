import { useEffect, useMemo, useState } from 'react'
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
import { ArrowLeft, Mail, Plus, RefreshCw, Send, Trash2, Inbox, Search, ChevronLeft, ChevronRight, X, Reply, Forward, MessageSquare, MailOpen } from 'lucide-react'

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
  threadId?: string
  from: string
  subject: string
  snippet: string
  date: string
  labelIds?: string[]
}

interface ThreadMessage {
  id: string
  threadId: string
  snippet: string
  from: string
  to: string
  cc: string
  subject: string
  date: string
  messageIdHeader: string
  references: string
  labelIds: string[]
  bodyText: string
  bodyHtml: string
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
  const [pageTokens, setPageTokens] = useState<string[]>([])
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [resultEstimate, setResultEstimate] = useState<number>(0)

  // Thread view
  const [threadOpen, setThreadOpen] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [replyMode, setReplyMode] = useState<'reply' | 'forward' | null>(null)
  const [replyDraft, setReplyDraft] = useState({ to: '', subject: '', body: '' })
  const [replying, setReplying] = useState(false)

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
        accountId, maxResults: PAGE_SIZE,
        q: filters.q || undefined, from: filters.from || undefined, subject: filters.subject || undefined,
        pageToken: opts.pageToken || undefined,
      },
    })
    if (error) {
      toast.error(error.message); setNextToken(null); setResultEstimate(0)
    } else {
      const d = data as { messages?: GmailMessage[]; nextPageToken?: string | null; resultSizeEstimate?: number }
      setMessages(d?.messages ?? [])
      setNextToken(d?.nextPageToken ?? null)
      setResultEstimate(d?.resultSizeEstimate ?? 0)
      if (opts.resetPagination) { setPageTokens([]); setCurrentToken(null) }
    }
    setLoadingMsgs(false)
  }

  // Chave de persistência por usuário+conta — isola filtros entre contas/contextos
  const filtersStorageKey = (accId: string) => `gmail:filters:${user?.id ?? 'anon'}:${accId}`

  const loadStoredFilters = (accId: string): { q: string; from: string; subject: string } => {
    try {
      const raw = localStorage.getItem(filtersStorageKey(accId))
      if (!raw) return { q: '', from: '', subject: '' }
      const parsed = JSON.parse(raw)
      return {
        q: typeof parsed.q === 'string' ? parsed.q : '',
        from: typeof parsed.from === 'string' ? parsed.from : '',
        subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      }
    } catch { return { q: '', from: '', subject: '' } }
  }

  const persistFilters = (accId: string, f: { q: string; from: string; subject: string }) => {
    try {
      if (!f.q && !f.from && !f.subject) localStorage.removeItem(filtersStorageKey(accId))
      else localStorage.setItem(filtersStorageKey(accId), JSON.stringify(f))
    } catch { /* storage indisponível — silencioso */ }
  }

  useEffect(() => {
    if (!activeId) return
    const stored = loadStoredFilters(activeId)
    setSearchQ(stored.q); setFilterFrom(stored.from); setFilterSubject(stored.subject)
    setAppliedFilters(stored)
    setPageTokens([]); setCurrentToken(null)
    fetchMessages(activeId, { pageToken: null, filters: stored, resetPagination: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id])

  const applyFilters = () => {
    if (!activeId) return
    const next = { q: searchQ.trim(), from: filterFrom.trim(), subject: filterSubject.trim() }
    setAppliedFilters(next)
    persistFilters(activeId, next)
    setPageTokens([]); setCurrentToken(null)
    fetchMessages(activeId, { pageToken: null, filters: next, resetPagination: true })
  }

  const clearFilters = () => {
    setSearchQ(''); setFilterFrom(''); setFilterSubject('')
    const empty = { q: '', from: '', subject: '' }
    setAppliedFilters(empty)
    if (activeId) {
      persistFilters(activeId, empty)
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

  // Abre a conversa (thread)
  const openThread = async (msg: GmailMessage) => {
    if (!activeId) return
    const tid = msg.threadId || msg.id
    setThreadId(tid); setThreadOpen(true); setThreadLoading(true); setThreadMessages([])
    setReplyMode(null); setReplyDraft({ to: '', subject: '', body: '' })
    const { data, error } = await supabase.functions.invoke('gmail-get-thread', {
      body: { accountId: activeId, threadId: tid },
    })
    if (error) toast.error(error.message)
    else {
      const d = data as { messages?: ThreadMessage[]; threadId?: string }
      setThreadMessages(d?.messages ?? [])
    }
    setThreadLoading(false)
  }

  const lastMsg = useMemo(() => threadMessages[threadMessages.length - 1], [threadMessages])

  const startReply = () => {
    if (!lastMsg) return
    const fromMatch = lastMsg.from.match(/<([^>]+)>/)
    const to = fromMatch ? fromMatch[1] : lastMsg.from
    const subj = lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`
    const quote = `\n\nEm ${lastMsg.date}, ${lastMsg.from} escreveu:\n> ${(lastMsg.bodyText || lastMsg.snippet).split('\n').join('\n> ')}`
    setReplyDraft({ to, subject: subj, body: quote })
    setReplyMode('reply')
  }

  const startForward = () => {
    if (!lastMsg) return
    const subj = lastMsg.subject.startsWith('Fwd:') ? lastMsg.subject : `Fwd: ${lastMsg.subject}`
    const fwd = `\n\n---------- Mensagem encaminhada ----------\nDe: ${lastMsg.from}\nData: ${lastMsg.date}\nAssunto: ${lastMsg.subject}\nPara: ${lastMsg.to}\n\n${lastMsg.bodyText || lastMsg.snippet}`
    setReplyDraft({ to: '', subject: subj, body: fwd })
    setReplyMode('forward')
  }

  const submitReply = async () => {
    if (!activeId || !threadId || !lastMsg) return
    setReplying(true)
    const payload: Record<string, unknown> = {
      accountId: activeId, to: replyDraft.to, subject: replyDraft.subject, body: replyDraft.body,
    }
    if (replyMode === 'reply') {
      payload.threadId = threadId
      if (lastMsg.messageIdHeader) payload.inReplyTo = lastMsg.messageIdHeader
      const refs = [lastMsg.references, lastMsg.messageIdHeader].filter(Boolean).join(' ').trim()
      if (refs) payload.references = refs
    }
    const { error } = await supabase.functions.invoke('gmail-send-message', { body: payload })
    setReplying(false)
    if (error) { toast.error(error.message); return }
    toast.success(replyMode === 'forward' ? 'Email encaminhado' : 'Resposta enviada')
    setReplyMode(null); setReplyDraft({ to: '', subject: '', body: '' })
    // Recarrega thread e inbox
    await Promise.all([
      (async () => { const { data } = await supabase.functions.invoke('gmail-get-thread', { body: { accountId: activeId, threadId } }); setThreadMessages((data as { messages?: ThreadMessage[] })?.messages ?? []) })(),
      fetchMessages(activeId, { pageToken: currentToken, filters: appliedFilters }),
    ])
  }

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
    fetchMessages(activeId, { pageToken: currentToken, filters: appliedFilters })
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
          <Button onClick={handleConnect} className="gap-2" data-testid="gmail-connect-btn">
            <Plus className="h-4 w-4" /> Conectar conta
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-[280px_1fr] gap-6">
        <aside className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contas conectadas</h2>
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
              data-testid="gmail-account-row"
              className={`w-full text-left p-3 rounded-lg border transition ${activeId === a.id ? 'border-[#C9941A] bg-[#C9941A]/10' : 'border-border hover:border-[#C9941A]/40'}`}
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

        <section>
          {!active ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma conta ou conecte uma nova.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="h-4 w-4" /> {active.email}
                  <Badge variant="outline" className="ml-2">OAuth Google</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchMessages(active.id, { pageToken: currentToken, filters: appliedFilters })} disabled={loadingMsgs} className="gap-1">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingMsgs ? 'animate-spin' : ''}`} /> Atualizar
                  </Button>
                  <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1" data-testid="gmail-compose-btn"><Send className="h-3.5 w-3.5" /> Novo</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Enviar email via {active.email}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label htmlFor="to">Para</Label><Input id="to" type="email" value={composeData.to} onChange={e => setComposeData(d => ({ ...d, to: e.target.value }))} placeholder="destinatario@exemplo.com" /></div>
                        <div><Label htmlFor="subject">Assunto</Label><Input id="subject" value={composeData.subject} onChange={e => setComposeData(d => ({ ...d, subject: e.target.value }))} /></div>
                        <div><Label htmlFor="body">Mensagem</Label><Textarea id="body" rows={8} value={composeData.body} onChange={e => setComposeData(d => ({ ...d, body: e.target.value }))} /></div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSend} disabled={sending || !composeData.to || !composeData.subject || !composeData.body}>{sending ? 'Enviando…' : 'Enviar'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => handleDisconnect(active.id)} className="gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-2">
                  <form onSubmit={(e) => { e.preventDefault(); applyFilters() }} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Busca (sintaxe Gmail)" className="pl-8 h-9 text-sm" aria-label="Busca livre" />
                    </div>
                    <Input value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="Remetente" className="h-9 text-sm" aria-label="Filtrar por remetente" />
                    <Input value={filterSubject} onChange={e => setFilterSubject(e.target.value)} placeholder="Assunto" className="h-9 text-sm" aria-label="Filtrar por assunto" />
                    <div className="flex gap-1">
                      <Button type="submit" size="sm" className="h-9">Aplicar</Button>
                      {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={clearFilters} aria-label="Limpar filtros"><X className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </form>
                  {hasActiveFilters && (
                    <p className="text-xs text-muted-foreground">
                      Filtros ativos: {[
                        appliedFilters.from && `de "${appliedFilters.from}"`,
                        appliedFilters.subject && `assunto "${appliedFilters.subject}"`,
                        appliedFilters.q && `"${appliedFilters.q}"`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {loadingMsgs ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Carregando emails…</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">{hasActiveFilters ? 'Nenhum email corresponde aos filtros.' : 'Caixa de entrada vazia.'}</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {messages.map(m => (
                      <li key={m.id}>
                        <button
                          type="button"
                          data-testid="gmail-message-row"
                          onClick={() => openThread(m)}
                          className="w-full text-left px-4 py-3 hover:bg-accent/30 transition"
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <p className="text-sm font-medium truncate flex-1">{m.from || '(sem remetente)'}</p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{m.date ? new Date(m.date).toLocaleString() : ''}</span>
                          </div>
                          <p className="text-sm truncate">{m.subject || '(sem assunto)'}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{m.snippet}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {(messages.length > 0 || pageTokens.length > 0) && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                    <p className="text-xs text-muted-foreground">Página {pageNumber} · {messages.length} de ~{resultEstimate} {hasActiveFilters ? '(filtrado)' : ''}</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={goPrevPage} disabled={loadingMsgs || pageTokens.length === 0} className="gap-1 h-8"><ChevronLeft className="h-3.5 w-3.5" /> Anterior</Button>
                      <Button variant="outline" size="sm" onClick={goNextPage} disabled={loadingMsgs || !nextToken} className="gap-1 h-8">Próximo <ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </main>

      {/* Thread dialog */}
      <Dialog open={threadOpen} onOpenChange={(o) => { setThreadOpen(o); if (!o) { setReplyMode(null); setThreadMessages([]); setThreadId(null) } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="gmail-thread-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> {threadMessages[0]?.subject || 'Conversa'}
              <Badge variant="outline" className="ml-auto">{threadMessages.length} {threadMessages.length === 1 ? 'mensagem' : 'mensagens'}</Badge>
            </DialogTitle>
          </DialogHeader>
          {threadLoading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Carregando conversa…</div>
          ) : (
            <div className="space-y-3">
              {threadMessages.map((m, idx) => (
                <Card key={m.id} data-testid="gmail-thread-message" className={idx === threadMessages.length - 1 ? 'border-[#C9941A]/40' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{m.from}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{m.date ? new Date(m.date).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">Para: {m.to}</p>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap font-sans">{m.bodyText || m.snippet}</pre>
                  </CardContent>
                </Card>
              ))}

              {replyMode === null ? (
                <div className="flex gap-2 pt-2">
                  <Button onClick={startReply} className="gap-1" data-testid="gmail-thread-reply"><Reply className="h-3.5 w-3.5" /> Responder</Button>
                  <Button variant="outline" onClick={startForward} className="gap-1" data-testid="gmail-thread-forward"><Forward className="h-3.5 w-3.5" /> Encaminhar</Button>
                </div>
              ) : (
                <Card data-testid="gmail-reply-form">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{replyMode === 'reply' ? 'Responder' : 'Encaminhar'}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div><Label htmlFor="rto">Para</Label><Input id="rto" type="email" value={replyDraft.to} onChange={e => setReplyDraft(d => ({ ...d, to: e.target.value }))} /></div>
                    <div><Label htmlFor="rsubj">Assunto</Label><Input id="rsubj" value={replyDraft.subject} onChange={e => setReplyDraft(d => ({ ...d, subject: e.target.value }))} /></div>
                    <div><Label htmlFor="rbody">Mensagem</Label><Textarea id="rbody" rows={8} value={replyDraft.body} onChange={e => setReplyDraft(d => ({ ...d, body: e.target.value }))} /></div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button variant="outline" onClick={() => { setReplyMode(null); setReplyDraft({ to: '', subject: '', body: '' }) }}>Cancelar</Button>
                      <Button onClick={submitReply} disabled={replying || !replyDraft.to || !replyDraft.subject || !replyDraft.body} data-testid="gmail-reply-submit">
                        {replying ? 'Enviando…' : (replyMode === 'forward' ? 'Encaminhar' : 'Enviar resposta')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
