import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCw, Send, Hash, Lock, Users, MessageSquare, Search, Download } from 'lucide-react'
import { motion } from 'framer-motion'

type Channel = { id: string; name: string; is_private: boolean; is_member?: boolean; num_members?: number; topic?: string; purpose?: string }
type SlackMsg = { ts: string; thread_ts?: string; user?: string; author: string; avatar?: string; text: string; reply_count: number; reactions: { name: string; count: number }[] }
type Member = { id: string; name: string; email?: string; avatar?: string; is_bot?: boolean; is_admin?: boolean; tz?: string }
type Team = { id: string; name: string; domain: string; icon?: string }

export default function ConnectorSlackPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'channels' | 'users' | 'compose'>('channels')
  const [channels, setChannels] = useState<Channel[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [team, setTeam] = useState<Team | null>(null)
  const [selected, setSelected] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<SlackMsg[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [sending, setSending] = useState(false)
  const [q, setQ] = useState('')
  const [composeChannel, setComposeChannel] = useState('')
  const [composeText, setComposeText] = useState('')
  const [composeUsername, setComposeUsername] = useState('')
  const [composeEmoji, setComposeEmoji] = useState('')

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true)
    try {
      const { data, error } = await supabase.functions.invoke('slack-list-channels')
      if (error) throw error
      setChannels(data?.channels ?? [])
    } catch (e: any) {
      toast.error('Failed to load channels', { description: e.message })
    } finally { setLoadingChannels(false) }
  }, [])

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase.functions.invoke('slack-list-users')
      if (error) throw error
      setMembers(data?.members ?? [])
      setTeam(data?.team ?? null)
    } catch (e: any) {
      toast.error('Failed to load users', { description: e.message })
    } finally { setLoadingUsers(false) }
  }, [])

  const loadMessages = useCallback(async (ch: Channel) => {
    setSelected(ch)
    setLoadingMessages(true)
    try {
      const sess = await supabase.auth.getSession()
      const token = sess.data.session?.access_token
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-list-messages?channel=${encodeURIComponent(ch.id)}&limit=50`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'erro')
      setMessages(json.messages ?? [])
    } catch (e: any) {
      toast.error('Failed to load messages', { description: e.message })
      setMessages([])
    } finally { setLoadingMessages(false) }
  }, [])

  const send = async () => {
    if (!composeChannel || !composeText.trim()) {
      toast.error('Select a channel and type a message')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.functions.invoke('slack-send-message', {
        body: {
          channel: composeChannel,
          text: composeText,
          username: composeUsername || undefined,
          icon_emoji: composeEmoji || undefined,
        },
      })
      if (error) throw error
      toast.success('Message sent')
      setComposeText('')
    } catch (e: any) {
      toast.error('Failed to send', { description: e.message })
    } finally { setSending(false) }
  }

  useEffect(() => { loadChannels(); loadUsers() }, [loadChannels, loadUsers])

  const filteredChannels = useMemo(() => {
    const term = q.toLowerCase()
    return channels.filter(c => !term || c.name.toLowerCase().includes(term))
  }, [channels, q])

  const exportMessages = () => {
    if (!selected || messages.length === 0) return
    const rows = ['ts,author,text,replies', ...messages.map(m =>
      [m.ts, JSON.stringify(m.author), JSON.stringify(m.text), m.reply_count].join(',')
    )]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `slack-${selected.name}-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/connectors')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#4A154B' }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-orbitron">Slack Connector</h1>
              <p className="text-xs text-muted-foreground">
                {team ? `${team.name} · ${team.domain}.slack.com` : 'Workspace connected via Lovable Gateway'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#C9941A]/40 text-[#C9941A]">Bot OAuth</Badge>
            <Button size="sm" variant="outline" onClick={() => { loadChannels(); loadUsers(); if (selected) loadMessages(selected) }}>
              <RefreshCw className="w-4 h-4 mr-1" /> Sync
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2">
          {(['channels', 'users', 'compose'] as const).map(t => (
            <Button key={t} size="sm" variant={tab === t ? 'default' : 'ghost'} onClick={() => setTab(t)} className="capitalize">
              {t === 'channels' && <Hash className="w-3 h-3 mr-1" />}
              {t === 'users' && <Users className="w-3 h-3 mr-1" />}
              {t === 'compose' && <Send className="w-3 h-3 mr-1" />}
              {t === 'channels' ? 'Channels' : t === 'users' ? 'Users' : 'Send'}
            </Button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'channels' && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            <div className="border border-border rounded-xl bg-card/30 overflow-hidden">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search channel..." className="pl-9" />
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {loadingChannels && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
                {!loadingChannels && filteredChannels.length === 0 && <p className="p-4 text-sm text-muted-foreground">No channels.</p>}
                {filteredChannels.map(c => (
                  <button
                    key={c.id}
                    onClick={() => loadMessages(c)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent/40 transition ${selected?.id === c.id ? 'bg-accent/60' : ''}`}
                  >
                    {c.is_private ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Hash className="w-3 h-3 text-muted-foreground" />}
                    <span className="text-sm flex-1 truncate">{c.name}</span>
                    {c.num_members !== undefined && <span className="text-[10px] text-muted-foreground">{c.num_members}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-xl bg-card/30 overflow-hidden flex flex-col min-h-[70vh]">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {selected ? (selected.is_private ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />) : null}
                    {selected?.name ?? 'Select a channel'}
                  </h3>
                  {selected?.topic && <p className="text-xs text-muted-foreground">{selected.topic}</p>}
                </div>
                <div className="flex gap-2">
                  {selected && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setComposeChannel(selected.id); setTab('compose') }}>
                        <Send className="w-3 h-3 mr-1" /> Reply
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportMessages} disabled={!messages.length}>
                        <Download className="w-3 h-3 mr-1" /> CSV
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}
                {!loadingMessages && selected && messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">No messages in this channel.</p>
                )}
                {messages.map(m => (
                  <motion.div key={m.ts} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    {m.avatar
                      ? <img src={m.avatar} alt="" className="w-8 h-8 rounded" />
                      : <div className="w-8 h-8 rounded bg-[#C9941A]/20 flex items-center justify-center text-xs font-bold">{m.author.slice(0, 1).toUpperCase()}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{m.author}</span>
                        <span>{new Date(Number(m.ts.split('.')[0]) * 1000).toLocaleString('pt-BR')}</span>
                        {m.reply_count > 0 && <Badge variant="secondary" className="text-[10px]">{m.reply_count} replies</Badge>}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                      {m.reactions.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {m.reactions.map(r => (
                            <span key={r.name} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/60">:{r.name}: {r.count}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="border border-border rounded-xl bg-card/30 overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Workspace users ({members.length})</h3>
              {team && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {team.icon && <img src={team.icon} alt="" className="w-5 h-5 rounded" />}
                  {team.name}
                </div>
              )}
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
              {loadingUsers && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
              {members.map(m => (
                <div key={m.id} className="px-4 py-2 flex items-center gap-3">
                  {m.avatar
                    ? <img src={m.avatar} alt="" className="w-8 h-8 rounded" />
                    : <div className="w-8 h-8 rounded bg-accent" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name} {m.is_bot && <span className="text-[10px] text-muted-foreground">(bot)</span>}</div>
                    {m.email && <div className="text-xs text-muted-foreground truncate">{m.email}</div>}
                  </div>
                  {m.is_admin && <Badge variant="outline" className="text-[10px] border-[#C9941A]/40 text-[#C9941A]">admin</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'compose' && (
          <div className="max-w-2xl border border-border rounded-xl bg-card/30 p-6 space-y-4">
            <h3 className="font-semibold text-lg">Send message</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Channel</label>
              <select
                value={composeChannel}
                onChange={e => setComposeChannel(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="">-- select --</option>
                {channels.map(c => (
                  <option key={c.id} value={c.id}>{c.is_private ? '🔒' : '#'} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Username (optional)</label>
                <Input value={composeUsername} onChange={e => setComposeUsername(e.target.value)} placeholder="KUBO Bot" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Emoji (optional)</label>
                <Input value={composeEmoji} onChange={e => setComposeEmoji(e.target.value)} placeholder=":robot_face:" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Message (Slack markdown)</label>
              <Textarea rows={6} value={composeText} onChange={e => setComposeText(e.target.value)} placeholder="Hello team! :wave:" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setComposeText(''); setComposeChannel('') }}>Clear</Button>
              <Button onClick={send} disabled={sending}>
                <Send className="w-4 h-4 mr-1" /> {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
