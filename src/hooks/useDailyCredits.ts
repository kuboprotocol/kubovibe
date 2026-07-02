import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function useDailyCredits() {
  const { user } = useAuth()
  const calledRef = useRef(false)

  useEffect(() => {
    if (!user || calledRef.current) return
    calledRef.current = true

    const credit = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const { data, error } = await supabase.functions.invoke('daily-credits', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (error || !data?.credited) return
        if (data.type === 'signup') {
          toast.success(`🎉 Welcome to KUBO Vibe! You got ${data.credits_granted} credits to get started!`, {
            duration: 6000,
            description: 'Complete daily shortlinks to earn more credits.',
          })
        } else if (data.type === 'daily') {
          toast.success(`+${data.credits_granted} credits from ${data.plan} plan 🚀`, { duration: 3000 })
        }
      } catch (err) {
        console.error('[DailyCredits] error:', err)
      }
    }
    credit()
  }, [user])
}
