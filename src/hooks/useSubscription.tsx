import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

const ADMIN_EMAIL = 'kuboprotocol@gmail.com'

interface Subscription {
  id: string
  plan: string
  edits_used: number
  edits_limit: number
  is_active: boolean
}

export function useSubscription() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL

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

  const canEdit = isAdmin || (subscription?.is_active && (subscription.edits_used < subscription.edits_limit))
  const editsRemaining = isAdmin ? 9999 : (subscription ? subscription.edits_limit - subscription.edits_used : 0)

  const incrementEdit = useCallback(async () => {
    if (isAdmin) return true // Admin never consumes credits
    if (!subscription) return false
    const newCount = subscription.edits_used + 1
    const { error } = await supabase
      .from('subscriptions' as any)
      .update({ edits_used: newCount, updated_at: new Date().toISOString() } as any)
      .eq('id', subscription.id)
    if (!error) {
      setSubscription(prev => prev ? { ...prev, edits_used: newCount } : null)
      return true
    }
    return false
  }, [subscription, isAdmin])

  return { subscription, loading, canEdit, editsRemaining, incrementEdit, refetch: fetchSubscription }
}
