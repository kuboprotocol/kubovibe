import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Lock, Download, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'

export default function SharedAuditPage() {
  const { id } = useParams<{ id: string }>()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ label: string | null; size: number; createdAt: string; expiresAt: string | null } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase.functions.invoke('audit-share-access', { body: { id, password } })
      if (error) throw error
      const d = data as { url: string; label: string | null; size: number; createdAt: string; expiresAt: string | null; error?: string }
      if (d.error) throw new Error(d.error)
      setDownloadUrl(d.url)
      setMeta({ label: d.label, size: d.size, createdAt: d.createdAt, expiresAt: d.expiresAt })
    } catch (e: any) {
      const msg = e?.message || 'error'
      const map: Record<string, string> = {
        invalid_password: 'Password incorreta.',
        not_found: 'Report not found.',
        revoked: 'This link has been revoked by the author.',
        expired: 'This link has expired.',
      }
      setError(map[msg] || msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Protected audit report</h1>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Enter the provided password to download the ZIP package.</p>

        {!downloadUrl ? (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="pw" className="text-xs">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </div>
            )}
            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Download className="h-3 w-3 mr-2" />}
              Verify and download
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="text-xs space-y-1">
              {meta?.label && <div><span className="text-muted-foreground">Label:</span> {meta.label}</div>}
              <div><span className="text-muted-foreground">Created:</span> {meta && new Date(meta.createdAt).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Size:</span> {meta && (meta.size / 1024).toFixed(1)} KB</div>
              {meta?.expiresAt && <div><span className="text-muted-foreground">Expires:</span> {new Date(meta.expiresAt).toLocaleString()}</div>}
            </div>
            <Button asChild className="w-full"><a href={downloadUrl} download>Download ZIP</a></Button>
            <p className="text-[10px] text-muted-foreground">The direct download link expires in 60 seconds. Reload the page to generate a new one.</p>
          </div>
        )}
      </div>
    </div>
  )
}
