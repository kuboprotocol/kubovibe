import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'



interface Subscription {
  id: string
  plan: string
  edits_used: number
  edits_limit: number
  is_active: boolean
  partnership_agreement_signed?: boolean
  last_daily_credit_at?: string | null
  signup_credits_granted?: boolean
}

export function useSubscription() {
  const { user, isAdmin } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  

  const fetchSubscription = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('user_id', user.id)
      .single()
    setSubscription(data as any)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchSubscription() }, [fetchSubscription])

  // UI hint only; actual entitlement is enforced server-side by RLS/RPC.
  const canEdit = isAdmin || (subscription?.is_active && (subscription.edits_used < subscription.edits_limit))
  const editsRemaining = isAdmin ? 9999 : (subscription ? subscription.edits_limit - subscription.edits_used : 0)

  const incrementEdit = useCallback(async () => {
    // Server-side enforcement: the subscriptions UPDATE is RLS-scoped to the owner,
    // and the canonical credit deduction happens in the
    // `execute_atomic_credit_deduction` RPC (which honours admin bypass via
    // internal.is_kubo_admin()). We do NOT short-circuit on client-side `isAdmin`
    // here — the row update is the source of truth and admin accounts are
    // exempted server-side.
    if (!subscription) return isAdmin // admin without subscription row: allow
    const newCount = subscription.edits_used + 1
    const { error } = await supabase
      .from('subscriptions' as any)
      .update({ edits_used: newCount, updated_at: new Date().toISOString() } as any)
      .eq('id', subscription.id)
    if (!error) {
      setSubscription(prev => prev ? { ...prev, edits_used: newCount } : null)
      return true
    }
    // If the server rejects (e.g. limit reached) but the user is admin, the
    // server-side RPC will still allow the action; surface a permissive result.
    return isAdmin
  }, [subscription, isAdmin])

  return { subscription, loading, canEdit, editsRemaining, incrementEdit, refetch: fetchSubscription }
}
