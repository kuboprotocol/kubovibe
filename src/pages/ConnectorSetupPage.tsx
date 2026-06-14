import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Loader2, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle, Plug, XCircle, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { getConnectorBySlug } from '@/lib/connectorsConfig'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

type GithubProfile = { login: string; avatar_url: string | null; profile_url: string }

export default function ConnectorSetupPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const connector = getConnectorBySlug(slug)

  const [accepted, setAccepted] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<{ masked_hint: string | null; updated_at: string } | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; account?: string | null; detail?: string | null } | null>(null)

  const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('api_credentials_safe')
        .select('masked_hint, updated_at')
        .eq('connector_slug', slug)
        .maybeSingle()
      if (!cancelled) {
        setExisting(data ?? null)
        setLoadingExisting(false)
      }

      if (slug === 'github') {
        const { data: gh } = await supabase
          .from('github_connections_safe')
          .select('github_username, github_avatar_url')
          .maybeSingle()
        if (!cancelled && gh?.github_username) {
          setGithubProfile({
            login: gh.github_username,
            avatar_url: gh.github_avatar_url,
            profile_url: `https://github.com/${gh.github_username}`,
          })
        }
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  if (!connector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <p className="text-lg">Connector not found</p>
          <Button onClick={() => navigate('/connectors')}>Back to connectors</Button>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    if (!accepted) {
      toast.error('You must accept the terms before continuing.')
      return
    }
    if (apiKey.trim().length < 8) {
      toast.error('The API Key appears invalid (minimum 8 characters).')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('connector-credentials-save', {
        body: { connector_slug: slug, api_key: apiKey.trim() },
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error))
      const gh = (data as any)?.github as GithubProfile | null
      if (slug === 'github' && gh?.login) {
        setGithubProfile(gh)
        setApiKey('')
        // refresh existing badge
        const { data: cred } = await supabase
          .from('api_credentials_safe')
          .select('masked_hint, updated_at')
          .eq('connector_slug', slug)
          .maybeSingle()
        setExisting(cred ?? null)
        toast.success(`GitHub linked: @${gh.login}`)
      } else {
        toast.success(`${connector.name} connected successfully!`)
        navigate(`/connectors/${slug}`)
      }
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message ?? 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('connector-credentials-test', {
        body: { connector_slug: slug },
      })
      if (error) throw error
      const r = data as any
      setTestResult({ ok: !!r?.ok, status: r?.status ?? 0, account: r?.account, detail: r?.detail })
      if (r?.ok) toast.success(`Conexão validada${r.account ? ` · ${r.account}` : ''}`)
      else toast.error(`Test failed: ${r?.detail ?? `HTTP ${r?.status}`}`)
    } catch (e: any) {
      const msg = e?.message ?? 'unknown error'
      setTestResult({ ok: false, status: 0, detail: msg })
      toast.error(`Error testing: ${msg}`)
    } finally {
      setTesting(false)
    }
  }

  const Icon = connector.icon

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/connectors')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${connector.color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: connector.color }} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display">Connect {connector.name}</h1>
              <p className="text-xs text-muted-foreground">Internal setup · KUBO Vibe Dev</p>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-3xl mx-auto px-4 py-8 space-y-6"
      >
        {/* Responsibility notice */}
        <Card className="p-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Third-party service</p>
              <p className="text-muted-foreground">
                <strong>{connector.name}</strong> is an external service, independent of KUBO. Charges,
                usage limits, API policies, and account security are solely the responsibility
                of the provider. KUBO only integrates and automates calls using your key.
              </p>
            </div>
          </div>
        </Card>

        {slug === 'github' && (
          <Card className="p-4 border-primary/40 bg-primary/5 flex gap-3 items-start">
            <KeyRound className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-foreground">GitHub Login via PAT</p>
              <p className="text-muted-foreground text-xs">
                Sem OAuth externo. A KUBO valida seu Personal Access Token na API do GitHub e
                vincula sua conta automaticamente — só então você é levado ao painel do conector.
              </p>
            </div>
          </Card>
        )}

        {slug === 'github' && githubProfile && (
          <Card className="p-5 border-emerald-500/40 bg-emerald-500/5">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-emerald-500/40">
                <AvatarImage src={githubProfile.avatar_url ?? undefined} alt={githubProfile.login} />
                <AvatarFallback>
                  <Github className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">@{githubProfile.login}</p>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Linked via PAT
                  </Badge>
                </div>
                <a
                  href={githubProfile.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5"
                >
                  {githubProfile.profile_url} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button size="sm" onClick={() => navigate('/connectors/github')}>
                Open panel
              </Button>
            </div>
          </Card>
        )}

        {/* Status atual + Teste de conexão */}
        {!loadingExisting && existing && (
          <Card className="p-4 border-emerald-500/30 bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Key configured</p>
                <p className="text-muted-foreground text-xs">
                  {existing.masked_hint ?? '••••'} · updated {new Date(existing.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                Test connection
              </Button>
            </div>

            {testResult && (
              <div
                className={cn(
                  'rounded-lg border p-3 text-sm flex items-start gap-2',
                  testResult.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-200'
                )}
              >
                {testResult.ok
                  ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 space-y-0.5">
                  <p className="font-medium">
                    {testResult.ok ? 'Connection OK' : 'Connection failed'}
                    {testResult.status ? ` · HTTP ${testResult.status}` : ''}
                  </p>
                  {testResult.account && <p className="text-xs opacity-90">Account: {testResult.account}</p>}
                  {testResult.detail && <p className="text-xs opacity-80 break-words">{testResult.detail}</p>}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Steps */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            How to get your {connector.apiKeyLabel}
          </h2>
          {connector.setupSteps.map((step, i) => (
            <Card key={i} className="p-4 flex gap-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </Card>
          ))}
          {connector.apiKeyDocsUrl && (
            <a
              href={connector.apiKeyDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Open official page for {connector.name}
              <ExternalLink className="h-3 w-3" />
              <span className="text-muted-foreground">(site externo)</span>
            </a>
          )}
        </div>

        {/* Form */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Connect à KUBO</h2>
            </div>
            {connector.slug === 'github' && (
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/40">
                PAT Token Required
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">{connector.apiKeyLabel}</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              placeholder={connector.apiKeyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">{connector.apiKeyHelp}</p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Your key is encrypted with <strong>AES-256-GCM</strong> antes de ser persistida e nunca é
              devolvida em claro ao navegador. Apenas as edge functions da KUBO podem descifrar para
              executar ações em seu nome.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(Boolean(v))}
              disabled={saving}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              I have read and accept that <strong>{connector.name}</strong> is a third-party service and that KUBO
              only integrates/automates calls using my key.
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate('/connectors')}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !accepted || apiKey.length < 8}
              className={cn('flex-1')}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existing ? 'Update key' : 'Save and activate'}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
