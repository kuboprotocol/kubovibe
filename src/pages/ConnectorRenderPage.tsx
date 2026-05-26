import { useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, RefreshCw, Server, Plus, Trash2, Activity, RotateCcw, Rocket, ShieldCheck, AlertTriangle, Loader2, CheckCircle2, XCircle, FileText, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

type Connection = {
  id: string
  name: string
  workspace_id: string | null
  api_key_hint: string | null
  last_status: string
  last_checked_at: string | null
  last_latency_ms: number | null
  last_error: string | null
  created_at: string
}
type RenderService = { id: string; name: string; type: string; serviceDetails?: any; suspended?: string; updatedAt?: string }
type Deploy = { id: string; status: string; createdAt: string; finishedAt?: string; commit?: { id: string; message: string } }
type Policy = {
  id: string
  connection_id: string
  service_id: string
  service_name: string | null
  enabled: boolean
  health_url: string | null
  max_restarts_per_hour: number
  rollback_on_fail: boolean
  e2e_webhook_url: string | null
  e2e_run_on_deploy: boolean
}
type HealEvent = { id: string; service_id: string; action: string; trigger: string; status: string; detail: any; created_at: string }

async function call(fn: string, body: any) {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

function statusColor(s?: string) {
  if (!s) return 'bg-muted text-muted-foreground'
  if (['live', 'ok', 'success', 'available'].includes(s)) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (['build_in_progress', 'update_in_progress', 'created', 'pre_deploy_in_progress'].includes(s)) return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  if (['build_failed', 'update_failed', 'canceled', 'deactivated', 'error', 'failed'].includes(s)) return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
  return 'bg-muted text-muted-foreground'
}

export default function ConnectorRenderPage() {
  const { toast } = useToast()
  const [connections, setConnections] = useState<Connection[]>([])
  const [activeConnId, setActiveConnId] = useState<string | null>(null)
  const [services, setServices] = useState<RenderService[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [events, setEvents] = useState<HealEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newName, setNewName] = useState('Render')
  const [savingKey, setSavingKey] = useState(false)
  const [activeService, setActiveService] = useState<RenderService | null>(null)
  const [deploys, setDeploys] = useState<Deploy[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const policiesByService = useMemo(() => Object.fromEntries(policies.map(p => [p.service_id, p])), [policies])

  async function loadAll() {
    setLoading(true)
    try {
      const c = await call('render-connect', { action: 'list' })
      setConnections(c.connections || [])
      const firstId = c.connections?.[0]?.id ?? null
      if (!activeConnId && firstId) setActiveConnId(firstId)
      const p = await call('render-policies', { action: 'list' })
      setPolicies(p.policies || [])
      const ev = await call('render-policies', { action: 'events', limit: 50 })
      setEvents(ev.events || [])
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }) }
    setLoading(false)
  }

  async function loadServices(connId: string) {
    try {
      const r = await call('render-proxy', { action: 'list_services', connection_id: connId, limit: 50 })
      const items = Array.isArray(r.data) ? r.data.map((x: any) => x.service ?? x) : []
      setServices(items)
    } catch (e: any) { toast({ title: 'Erro ao listar serviços', description: e.message, variant: 'destructive' }) }
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (activeConnId) loadServices(activeConnId) }, [activeConnId])

  async function saveKey() {
    if (!newKey.trim()) return
    setSavingKey(true)
    try {
      await call('render-connect', { action: 'save', api_key: newKey.trim(), name: newName.trim() })
      toast({ title: 'Conexão Render salva', description: 'API key validada e cifrada.' })
      setNewKey(''); setNewName('Render'); setShowAdd(false)
      await loadAll()
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }) }
    setSavingKey(false)
  }

  async function deleteConn(id: string) {
    if (!confirm('Remover esta conexão Render?')) return
    try { await call('render-connect', { action: 'delete', id }); await loadAll(); if (activeConnId === id) setActiveConnId(null) }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }) }
  }

  async function openService(svc: RenderService) {
    setActiveService(svc)
    setDeploys([]); setLogs([])
    try {
      const d = await call('render-proxy', { action: 'list_deploys', connection_id: activeConnId, service_id: svc.id, limit: 15 })
      setDeploys(Array.isArray(d.data) ? d.data.map((x: any) => x.deploy ?? x) : [])
    } catch (e: any) { toast({ title: 'Erro deploys', description: e.message, variant: 'destructive' }) }
  }

  async function refreshLogs() {
    if (!activeService) return
    setLogsLoading(true)
    try {
      const r = await call('render-proxy', { action: 'list_logs', connection_id: activeConnId, service_id: activeService.id, limit: 100 })
      const items = r.data?.logs ?? r.data ?? []
      setLogs(Array.isArray(items) ? items : (items.logs || []))
    } catch (e: any) { toast({ title: 'Erro logs', description: e.message, variant: 'destructive' }) }
    setLogsLoading(false)
  }

  async function doAction(action: string, extra: any = {}) {
    if (!activeService) return
    setBusyAction(action)
    try {
      const r = await call('render-proxy', { action, connection_id: activeConnId, service_id: activeService.id, ...extra })
      toast({ title: 'OK', description: `${action} executado (${r.latency_ms ?? '-'}ms)` })
      const d = await call('render-proxy', { action: 'list_deploys', connection_id: activeConnId, service_id: activeService.id, limit: 15 })
      setDeploys(Array.isArray(d.data) ? d.data.map((x: any) => x.deploy ?? x) : [])
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }) }
    setBusyAction(null)
  }

  async function savePolicy(p: Policy) {
    try {
      await call('render-policies', { action: 'upsert', ...p })
      toast({ title: 'Política salva' })
      setEditPolicy(null)
      const ev = await call('render-policies', { action: 'list' })
      setPolicies(ev.policies || [])
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }) }
  }

  async function runHealNow() {
    try {
      const r = await call('render-auto-heal', {})
      toast({ title: 'Auto-heal executado', description: `${r.count} serviços avaliados` })
      const ev = await call('render-policies', { action: 'events', limit: 50 })
      setEvents(ev.events || [])
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }) }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <title>Render Connector — KUBO Vibe</title>
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/connectors"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Connectors</Button></Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-primary" /> Render</h1>
              <p className="text-sm text-muted-foreground">Multi-tenant • Auto-healing • Logs • Rollback • E2E hooks</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
            <Button variant="outline" size="sm" onClick={runHealNow}><Heart className="w-4 h-4 mr-1" />Rodar auto-heal</Button>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" />Nova conexão</Button>
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>}

        {!loading && connections.length === 0 && (
          <Card><CardContent className="py-12 text-center">
            <Server className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-semibold mb-1">Nenhuma conexão Render</h2>
            <p className="text-sm text-muted-foreground mb-4">Cole sua API key da Render para começar.</p>
            <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" />Conectar Render</Button>
          </CardContent></Card>
        )}

        {!loading && connections.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {connections.map(c => (
                <button key={c.id} onClick={() => setActiveConnId(c.id)}
                  className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${activeConnId === c.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <Server className="w-3.5 h-3.5" />
                  <span>{c.name}</span>
                  <Badge variant="outline" className={statusColor(c.last_status)}>{c.last_status}</Badge>
                  <span className="text-xs text-muted-foreground">{c.api_key_hint}</span>
                  <Trash2 className="w-3.5 h-3.5 ml-2 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteConn(c.id) }} />
                </button>
              ))}
            </div>

            <Tabs defaultValue="services">
              <TabsList>
                <TabsTrigger value="services"><Server className="w-4 h-4 mr-1" />Serviços</TabsTrigger>
                <TabsTrigger value="heal"><ShieldCheck className="w-4 h-4 mr-1" />Auto-heal</TabsTrigger>
                <TabsTrigger value="events"><Activity className="w-4 h-4 mr-1" />Eventos</TabsTrigger>
              </TabsList>

              <TabsContent value="services" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {services.map(s => {
                    const pol = policiesByService[s.id]
                    return (
                      <motion.div key={s.id} whileHover={{ y: -2 }}>
                        <Card className="cursor-pointer h-full" onClick={() => openService(s)}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between gap-2">
                              <span className="truncate">{s.name}</span>
                              {pol?.enabled && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shrink-0"><ShieldCheck className="w-3 h-3 mr-1" />Heal</Badge>}
                            </CardTitle>
                            <CardDescription className="text-xs">{s.type} • {s.suspended === 'suspended' ? 'suspended' : 'active'}</CardDescription>
                          </CardHeader>
                          <CardContent className="text-xs text-muted-foreground">
                            <div className="truncate">{s.serviceDetails?.url || s.serviceDetails?.publishPath || s.id}</div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                  {services.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum serviço encontrado.</p>}
                </div>
              </TabsContent>

              <TabsContent value="heal" className="mt-4 space-y-2">
                {policies.length === 0 && <p className="text-sm text-muted-foreground">Abra um serviço e configure a política de auto-healing.</p>}
                {policies.map(p => (
                  <Card key={p.id}>
                    <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {p.service_name || p.service_id}
                          {p.enabled ? <Badge className="bg-emerald-500/15 text-emerald-400">ON</Badge> : <Badge variant="outline">OFF</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          health: {p.health_url || '—'} • restarts/h ≤ {p.max_restarts_per_hour} • rollback: {p.rollback_on_fail ? 'sim' : 'não'} • E2E: {p.e2e_run_on_deploy ? 'sim' : 'não'}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditPolicy(p)}>Editar</Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="events" className="mt-4">
                <ScrollArea className="h-[500px] border rounded-lg">
                  <div className="divide-y">
                    {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sem eventos ainda.</p>}
                    {events.map(e => (
                      <div key={e.id} className="p-3 text-xs flex items-start gap-3">
                        {e.status === 'success'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          : <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{e.action.toUpperCase()} <span className="text-muted-foreground font-normal">({e.trigger})</span> — {e.service_id}</div>
                          <div className="text-muted-foreground truncate">{JSON.stringify(e.detail)}</div>
                          <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Add connection dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar Render</DialogTitle>
            <DialogDescription>Crie uma API Key em <a className="text-primary underline" href="https://dashboard.render.com/u/settings#api-keys" target="_blank" rel="noreferrer">dashboard.render.com</a>. A chave é cifrada com AES-256-GCM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div><Label>Render API Key</Label><Input type="password" placeholder="rnd_..." value={newKey} onChange={e => setNewKey(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={saveKey} disabled={savingKey || !newKey}>{savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service drawer */}
      <Dialog open={!!activeService} onOpenChange={(o) => !o && setActiveService(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Server className="w-5 h-5" />{activeService?.name}</DialogTitle>
            <DialogDescription>{activeService?.id} • {activeService?.type}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mb-3">
            <Button size="sm" disabled={busyAction !== null} onClick={() => doAction('restart_service')}>
              {busyAction === 'restart_service' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}Restart
            </Button>
            <Button size="sm" variant="outline" disabled={busyAction !== null} onClick={() => doAction('trigger_deploy')}>
              {busyAction === 'trigger_deploy' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Rocket className="w-4 h-4 mr-1" />}Deploy
            </Button>
            <Button size="sm" variant="outline" disabled={busyAction !== null} onClick={() => doAction('trigger_deploy', { clear_cache: true })}>
              {busyAction === 'trigger_deploy' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Rocket className="w-4 h-4 mr-1" />}Deploy + clear cache
            </Button>
            <Button size="sm" variant="outline" onClick={refreshLogs} disabled={logsLoading}>
              {logsLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}Logs
            </Button>
            <Button size="sm" variant="secondary" onClick={() => {
              const existing = activeService ? policiesByService[activeService.id] : null
              setEditPolicy(existing ?? {
                id: '', connection_id: activeConnId!, service_id: activeService!.id, service_name: activeService!.name,
                enabled: true, health_url: '', max_restarts_per_hour: 5, rollback_on_fail: true, e2e_webhook_url: '', e2e_run_on_deploy: false,
              })
            }}><ShieldCheck className="w-4 h-4 mr-1" />Auto-heal</Button>
          </div>

          <Tabs defaultValue="deploys">
            <TabsList>
              <TabsTrigger value="deploys">Deploys</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="deploys">
              <ScrollArea className="h-[320px] border rounded">
                <div className="divide-y">
                  {deploys.length === 0 && <p className="text-sm text-muted-foreground p-4">Sem deploys.</p>}
                  {deploys.map(d => (
                    <div key={d.id} className="p-3 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={statusColor(d.status)}>{d.status}</Badge>
                          <span className="font-mono">{d.id.slice(0, 10)}</span>
                        </div>
                        <div className="text-muted-foreground truncate">{d.commit?.message || '—'}</div>
                        <div className="text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={busyAction !== null || d.status !== 'live'} onClick={() => doAction('rollback', { deploy_id: d.id })}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />Rollback
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="logs">
              <ScrollArea className="h-[320px] border rounded">
                <pre className="text-[11px] p-3 whitespace-pre-wrap font-mono">
                  {logs.length === 0 ? 'Clique em Logs para carregar…' : logs.map((l: any, i) => `[${l.timestamp || ''}] ${l.message || JSON.stringify(l)}`).join('\n')}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Policy editor */}
      <Dialog open={!!editPolicy} onOpenChange={(o) => !o && setEditPolicy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Política de auto-healing</DialogTitle>
            <DialogDescription>{editPolicy?.service_name || editPolicy?.service_id}</DialogDescription>
          </DialogHeader>
          {editPolicy && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>Habilitado</Label><Switch checked={editPolicy.enabled} onCheckedChange={v => setEditPolicy({ ...editPolicy, enabled: v })} /></div>
              <div><Label>Health URL</Label><Input value={editPolicy.health_url ?? ''} onChange={e => setEditPolicy({ ...editPolicy, health_url: e.target.value })} placeholder="https://meu-app.onrender.com/health" /></div>
              <div><Label>Max restarts / hora</Label><Input type="number" value={editPolicy.max_restarts_per_hour} onChange={e => setEditPolicy({ ...editPolicy, max_restarts_per_hour: Number(e.target.value) })} /></div>
              <div className="flex items-center justify-between"><Label>Rollback se deploy falhar</Label><Switch checked={editPolicy.rollback_on_fail} onCheckedChange={v => setEditPolicy({ ...editPolicy, rollback_on_fail: v })} /></div>
              <div><Label>Webhook E2E (POST)</Label><Input value={editPolicy.e2e_webhook_url ?? ''} onChange={e => setEditPolicy({ ...editPolicy, e2e_webhook_url: e.target.value })} placeholder="https://api.github.com/repos/.../dispatches" /></div>
              <div className="flex items-center justify-between"><Label>Disparar E2E após deploy live</Label><Switch checked={editPolicy.e2e_run_on_deploy} onCheckedChange={v => setEditPolicy({ ...editPolicy, e2e_run_on_deploy: v })} /></div>
              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-300 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />O motor avalia tudo a cada 2min via cron. Restart respeita o limite acima.</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditPolicy(null)}>Cancelar</Button>
            <Button onClick={() => editPolicy && savePolicy(editPolicy)}>Salvar política</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
