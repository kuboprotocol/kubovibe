import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, Plug, Save, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { getProvider, getNetworksForProvider, type ProviderId } from '@/lib/web3Providers'
import { getNetwork } from '@/lib/web3Networks'
import Web3StatusPill from './Web3StatusPill'

interface TestResult { ok: boolean; status: number; blockNumber?: number; detail?: string; latencyMs: number }

export interface Web3EditingConnection {
  id: string
  network: string
  connection_name: string
  explorer_url: string
  api_key_hint?: string | null
}

interface Props {
  providerId: ProviderId
  onSaved?: () => void
  editing?: Web3EditingConnection | null
  onCancelEdit?: () => void
}

export default function Web3ConnectionForm({ providerId, onSaved, editing, onCancelEdit }: Props) {
  const provider = getProvider(providerId)!
  const networks = useMemo(() => getNetworksForProvider(providerId), [providerId])
  const isEditing = !!editing

  const [connectionName, setConnectionName] = useState(editing?.connection_name ?? `Minha conexão ${provider.label}`)
  const [networkId, setNetworkId] = useState<string>(editing?.network ?? networks[0]?.id ?? '')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [rpcUrl, setRpcUrl] = useState('')
  const [rpcTouched, setRpcTouched] = useState(false)
  const [explorerUrl, setExplorerUrl] = useState(editing?.explorer_url ?? '')
  const [explorerTouched, setExplorerTouched] = useState(!!editing)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Reset when "editing" prop changes
  useEffect(() => {
    setConnectionName(editing?.connection_name ?? `Minha conexão ${provider.label}`)
    setNetworkId(editing?.network ?? networks[0]?.id ?? '')
    setApiKey('')
    setRpcUrl('')
    setRpcTouched(false)
    setExplorerUrl(editing?.explorer_url ?? '')
    setExplorerTouched(!!editing)
    setTestResult(null)
  }, [editing?.id, provider.label, networks, editing])

  // Auto-preencher RPC e explorer ao trocar de network / api key
  useEffect(() => {
    const net = getNetwork(networkId)
    if (!net) return
    if (!rpcTouched) {
      const built = provider.buildRpcUrl(networkId, apiKey || 'YOUR_KEY')
      if (built) setRpcUrl(built)
      else if (providerId === 'custom-rpc') setRpcUrl('')
    }
    if (!explorerTouched) setExplorerUrl(net.defaultExplorer)
  }, [networkId, apiKey, providerId, provider, rpcTouched, explorerTouched])

  const status: 'connected' | 'error' | 'unknown' = testResult ? (testResult.ok ? 'connected' : 'error') : 'unknown'

  const familyOf = (id: string) => getNetwork(id)?.family ?? 'evm'

  function validate(): string | null {
    if (!connectionName.trim()) return 'Informe um nome para a conexão.'
    if (!networkId) return 'Selecione uma network.'
    if (provider.requiresApiKey && apiKey.trim().length < 8) return 'API Key inválida (mínimo 8 caracteres).'
    try {
      const u = new URL(rpcUrl)
      if (!/^https?:$/.test(u.protocol)) return 'RPC URL deve usar http(s).'
    } catch { return 'RPC URL inválida.' }
    try {
      const u = new URL(explorerUrl)
      if (!/^https?:$/.test(u.protocol)) return 'Explorer URL deve usar http(s).'
    } catch { return 'Explorer URL inválida.' }
    return null
  }

  async function handleTest() {
    const err = validate(); if (err) { toast.error(err); return }
    setTesting(true); setTestResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('web3-connection-test', {
        body: { rpc_url: rpcUrl.trim(), network: networkId, family: familyOf(networkId) },
      })
      if (error) throw error
      const r = data as TestResult
      setTestResult(r)
      if (r.ok) toast.success(`Conectado · block ${r.blockNumber ?? '?'} · ${r.latencyMs}ms`)
      else toast.error(`Falha: ${r.detail ?? `HTTP ${r.status}`}`)
    } catch (e: any) {
      const r = { ok: false, status: 0, detail: e?.message ?? 'erro desconhecido', latencyMs: 0 }
      setTestResult(r); toast.error(`Erro: ${r.detail}`)
    } finally { setTesting(false) }
  }

  async function handleSave() {
    const err = validate(); if (err) { toast.error(err); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        provider: providerId,
        network: networkId,
        connection_name: connectionName.trim(),
        rpc_url: rpcUrl.trim(),
        explorer_url: explorerUrl.trim(),
        api_key: apiKey.trim() || null,
      }
      if (editing?.id) body.id = editing.id
      const { data, error } = await supabase.functions.invoke('web3-connection-save', { body })
      if (error) throw error
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error))
      toast.success(isEditing ? 'Conexão atualizada' : 'Conexão salva')
      onSaved?.()
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message ?? 'erro'}`)
    } finally { setSaving(false) }
  }

  return (
    <Card className="p-6 space-y-5" data-testid="web3-connection-form">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">
            {isEditing ? 'Editar conexão' : 'Configurar conexão'}
          </h2>
          <p className="text-xs text-muted-foreground">{provider.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Web3StatusPill status={status} checking={testing} />
          {isEditing && onCancelEdit && (
            <Button variant="ghost" size="icon" onClick={onCancelEdit} aria-label="Cancelar edição">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="text-xs rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-amber-200">
          Por segurança, RPC URL e API Key não são exibidas. Reinforme os valores para atualizar a conexão.
          {editing?.api_key_hint && <> Hint atual: <code className="opacity-80">{editing.api_key_hint}</code></>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="connectionName">Nome da conexão</Label>
        <Input id="connectionName" data-testid="field-connection-name" value={connectionName} onChange={(e) => setConnectionName(e.target.value)} placeholder="Ex.: Produção Mainnet" maxLength={80} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="network">Network</Label>
        <Select value={networkId} onValueChange={(v) => { setNetworkId(v); setRpcTouched(false); setExplorerTouched(false); setTestResult(null) }}>
          <SelectTrigger id="network" data-testid="field-network"><SelectValue placeholder="Selecione uma network" /></SelectTrigger>
          <SelectContent>
            {(['evm', 'solana', 'utxo'] as const).map((fam) => {
              const items = networks.filter((n) => n.family === fam)
              if (items.length === 0) return null
              return (
                <SelectGroup key={fam}>
                  <SelectLabel>{fam === 'evm' ? 'EVM' : fam === 'solana' ? 'Solana' : 'UTXO'}</SelectLabel>
                  {items.map((n) => <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>)}
                </SelectGroup>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">{provider.apiKeyLabel}</Label>
        <div className="relative">
          <Input
            id="apiKey"
            data-testid="field-api-key"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setRpcTouched(false) }}
            placeholder={provider.apiKeyPlaceholder}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Ocultar API key' : 'Mostrar API key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{provider.apiKeyHelp}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rpc">RPC URL</Label>
        <Input
          id="rpc"
          data-testid="field-rpc-url"
          type="url"
          value={rpcUrl}
          onChange={(e) => { setRpcUrl(e.target.value.replace(/\s+/g, '')); setRpcTouched(true) }}
          placeholder="https://eth-mainnet.g.alchemy.com/v2/SUA_API_KEY"
        />
        <p className="text-xs text-muted-foreground">
          Auto-gerada com base na network. Você pode editar para apontar para outro endpoint.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="explorer">Explorer URL</Label>
        <div className="flex gap-2">
          <Input
            id="explorer"
            data-testid="field-explorer-url"
            type="url"
            value={explorerUrl}
            onChange={(e) => { setExplorerUrl(e.target.value); setExplorerTouched(true) }}
            placeholder="https://etherscan.io"
          />
          {explorerUrl && (
            <Button type="button" variant="outline" size="icon" asChild aria-label="Abrir explorer em nova aba">
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          )}
        </div>
      </div>

      {testResult && (
        <div
          data-testid="web3-test-result"
          data-test-ok={testResult.ok ? 'true' : 'false'}
          role="status"
          aria-live="polite"
          className={`rounded-lg border p-3 text-sm ${testResult.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}
        >
          <p className="font-medium">
            {testResult.ok ? 'Conexão OK' : 'Falha na conexão'} · {testResult.latencyMs}ms{testResult.status ? ` · HTTP ${testResult.status}` : ''}
          </p>
          {testResult.blockNumber !== undefined && <p className="text-xs opacity-80">Block: {testResult.blockNumber}</p>}
          {testResult.detail && <p className="text-xs opacity-80 break-words">{testResult.detail}</p>}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={handleTest} disabled={testing || saving} className="flex-1" data-testid="btn-test-connection">
          {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
          Testar conexão
        </Button>
        <Button onClick={handleSave} disabled={saving || testing} className="flex-1" data-testid="btn-save-connection">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isEditing ? 'Atualizar' : 'Salvar'}
        </Button>
      </div>

      <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
        Documentação oficial do {provider.label} <ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  )
}
