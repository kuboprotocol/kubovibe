import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, ShieldCheck } from 'lucide-react'

interface AuthorizationDetails {
  client?: { name?: string; client_id?: string }
  redirect_url?: string
  redirect_to?: string
}

type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>
}

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth

export default function OAuthConsent() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id') ?? ''
  const [details, setDetails] = useState<AuthorizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!authorizationId) {
        setError('Missing authorization_id')
        return
      }
      const { data: sess } = await supabase.auth.getSession()
      if (!sess.session) {
        const next = window.location.pathname + window.location.search
        window.location.href = '/auth?redirect=' + encodeURIComponent(next)
        return
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId)
      if (!active) return
      if (detailsError) {
        setError(detailsError.message)
        return
      }
      const immediate = data?.redirect_url ?? data?.redirect_to
      if (immediate && !data?.client) {
        window.location.href = immediate
        return
      }
      setDetails(data)
    })()
    return () => {
      active = false
    }
  }, [authorizationId])

  async function decide(approve: boolean) {
    setBusy(true)
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId)
    if (decisionError) {
      setBusy(false)
      setError(decisionError.message)
      return
    }
    const target = data?.redirect_url ?? data?.redirect_to
    if (!target) {
      setBusy(false)
      setError('No redirect returned by the authorization server.')
      return
    }
    window.location.href = target
  }

  const clientName = details?.client?.name ?? 'this app'

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass glass-border rounded-3xl p-8 w-full max-w-md text-center">
        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="h-7 w-7 text-primary-foreground" />
        </div>

        {error ? (
          <>
            <h1 className="text-xl font-semibold mb-2">Authorization failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : !details ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading authorization request…
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-2">Connect {clientName}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {clientName} is requesting access to KUBO VIBE DEV on your behalf. It will be able to
              read and create your projects, view agent jobs and credit usage as you.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Deny
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
