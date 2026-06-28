import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, RotateCw, Undo2, Activity, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

type Deployment = {
  id: string
  source: string
  provider: string | null
  status: 'queued' | 'building' | 'deploying' | 'ready' | 'error' | 'canceled'
  commit_sha: string | null
  commit_message: string | null
  branch: string | null
  trigger_reason: string | null
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  estimated_duration_ms: number | null
  url: string | null
  log: string
  healthy: boolean | null
  is_current: boolean
  rolled_back_to: string | null
}

const STATUS_META: Record<Deployment['status'], { label: string; color: string; icon: any }> = {
  queued:    { label: 'Queued',    color: 'bg-slate-500/15 text-slate-300 border-slate-500/30', icon: Clock },
  building:  { label: 'Building',  color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Loader2 },
  deploying: { label: 'Deploying', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',   icon: Loader2 },
  ready:     { label: 'Ready',     color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  error:     { label: 'Error',     color: 'bg-red-500/15 text-red-300 border-red-500/30',     icon: XCircle },
  canceled:  { label: 'Canceled',  color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',   icon: XCircle },
}

function fmtDuration(ms: number | null) {
  if (!ms || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function AdminDeployPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [reason, setReason] = useState('')
  const [tick, setTick] = useState(0)

  // 1s tick to refresh ETA progress
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Admin check
  useEffect(() => {
    if (!user) return
    supabase.rpc('has_role', { _role: 'admin' }).then(({ data }) => setIsAdmin(!!data))
  }, [user])

  // Initial load + realtime
  useEffect(() => {
    if (!isAdmin) return
    let mounted = true
    const load = async () => {
      const { data, error } = await supabase
        .from('deployments')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(30)
      if (!mounted) return
      if (error) toast.error('Failed to load deployments')
      else setDeployments((data ?? []) as Deployment[])
      setLoading(false)
    }
    load()
    const ch = supabase
      .channel('deployments-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deployments' }, (payload) => {
        setDeployments(prev => {
          const next = [...prev]
          if (payload.eventType === 'INSERT') next.unshift(payload.new as Deployment)
          else if (payload.eventType === 'UPDATE') {
            const i = next.findIndex(d => d.id === (payload.new as Deployment).id)
            if (i >= 0) next[i] = payload.new as Deployment
            else next.unshift(payload.new as Deployment)
          } else if (payload.eventType === 'DELETE') {
            return next.filter(d => d.id !== (payload.old as Deployment).id)
          }
          return next.slice(0, 30)
        })
      })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [isAdmin])

  const current = deployments.find(d => d.is_current) ?? null
  const inFlight = deployments.find(d => ['queued', 'building', 'deploying'].includes(d.status)) ?? null

  // Progress / ETA
  const progress = useMemo(() => {
    if (!inFlight?.started_at) return null
    const elapsed = Date.now() - new Date(inFlight.started_at).getTime()
    const eta = inFlight.estimated_duration_ms ?? 90_000
    const pct = Math.min(99, Math.round((elapsed / eta) * 100))
    const remaining = Math.max(0, eta - elapsed)
    return { pct, elapsed, eta, remaining }
    // include tick so it recomputes every second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFlight?.started_at, inFlight?.estimated_duration_ms, tick])

  const handleRedeploy = async () => {
    setTriggering(true)
    try {
      const { data, error } = await supabase.functions.invoke('deploy-trigger', {
        body: { reason: reason || 'Manual redeploy from admin panel' },
      })
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error)
      toast.success(`Redeploy triggered. ETA ~${fmtDuration((data as any).eta_ms ?? null)}`)
      setReason('')
    } catch (e: any) {
      toast.error(`Trigger failed: ${e.message}`)
    } finally {
      setTriggering(false)
    }
  }

  const handleRollback = async () => {
    if (!confirm('Roll back to the last healthy deployment?')) return
    setRollingBack(true)
    try {
      const { data, error } = await supabase.functions.invoke('deploy-rollback', { body: {} })
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error)
      toast.success(`Rollback triggered → ${(data as any).target_sha?.slice(0, 7) ?? 'previous'}`)
    } catch (e: any) {
      toast.error(`Rollback failed: ${e.message}`)
    } finally {
      setRollingBack(false)
    }
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!user) return <Navigate to="/auth?redirect=/admin/deploy" replace />
  if (isAdmin === false) return <Navigate to="/dashboard" replace />
  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-4 w-4" /></Button>
          <Activity className="h-4 w-4 text-primary" />
          <h1 className="font-display font-semibold">Deployments</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Status + manual + rollback */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 glass glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>Current status</span>
                {inFlight && <Badge className={STATUS_META[inFlight.status].color}>{STATUS_META[inFlight.status].label}</Badge>}
                {!inFlight && current && <Badge className={STATUS_META[current.status].color}>Live</Badge>}
                {!inFlight && current?.healthy === false && <Badge className="bg-red-500/15 text-red-300 border-red-500/30">Unhealthy</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inFlight ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{inFlight.trigger_reason ?? inFlight.source}</span>
                    <span>{fmtDuration(progress?.elapsed ?? 0)} / ~{fmtDuration(progress?.eta ?? null)} · {progress?.pct ?? 0}%</span>
                  </div>
                  <Progress value={progress?.pct ?? 0} />
                  <p className="text-xs text-muted-foreground">
                    ETA: about <span className="text-foreground font-medium">{fmtDuration(progress?.remaining ?? null)}</span> remaining
                    {inFlight.commit_sha && <> · commit <code className="text-primary">{inFlight.commit_sha.slice(0, 7)}</code></>}
                  </p>
                </>
              ) : current ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Live · deployed {formatDistanceToNow(new Date(current.started_at), { addSuffix: true })}</span>
                  </div>
                  {current.commit_sha && <p className="text-xs text-muted-foreground">commit <code className="text-primary">{current.commit_sha.slice(0, 7)}</code> · {current.commit_message ?? ''}</p>}
                  {current.url && <p className="text-xs text-muted-foreground truncate">{current.url}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No deployments recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass glass-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Reason (optional)"
                value={reason} onChange={e => setReason(e.target.value)}
                className="text-xs min-h-[60px]"
              />
              <Button onClick={handleRedeploy} disabled={triggering || !!inFlight} className="w-full" variant="hero">
                {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCw className="h-4 w-4 mr-2" />}
                Redeploy now
              </Button>
              <Button onClick={handleRollback} disabled={rollingBack || !!inFlight} className="w-full" variant="outline">
                {rollingBack ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                Rollback to last healthy
              </Button>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Auto-rollback runs after 3 consecutive healthcheck failures.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card className="glass glass-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : deployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deployments yet.</p>
            ) : deployments.map(d => {
              const M = STATUS_META[d.status]
              const isLive = ['queued', 'building', 'deploying'].includes(d.status)
              const Icon = M.icon
              return (
                <details key={d.id} className="rounded-lg border border-border/50 bg-background/40">
                  <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-background/60 rounded-lg">
                    <Icon className={`h-3.5 w-3.5 ${isLive ? 'animate-spin' : ''} ${d.status === 'ready' ? 'text-emerald-400' : d.status === 'error' ? 'text-red-400' : 'text-muted-foreground'}`} />
                    <Badge className={`${M.color} text-[10px]`}>{M.label}</Badge>
                    <span className="text-xs flex-1 truncate">
                      <span className="text-foreground font-medium">{d.source}</span>
                      {d.commit_sha && <span className="text-muted-foreground"> · {d.commit_sha.slice(0, 7)}</span>}
                      {d.trigger_reason && <span className="text-muted-foreground"> · {d.trigger_reason}</span>}
                    </span>
                    {d.is_current && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">live</Badge>}
                    {d.rolled_back_to && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">rollback</Badge>}
                    <span className="text-[10px] text-muted-foreground">{fmtDuration(d.duration_ms)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(d.started_at), { addSuffix: true })}</span>
                  </summary>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap bg-black/40 p-3 m-2 rounded border border-border/30 max-h-64 overflow-auto">{d.log || '(no log)'}</pre>
                </details>
              )
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
