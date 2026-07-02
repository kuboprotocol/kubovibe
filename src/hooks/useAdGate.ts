import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { shouldShowAd } from '@/lib/planConfig'
import { openTerraSmartlink } from '@/lib/terraAds'

export function useAdGate() {
  const { user, isAdmin } = useAuth()
  const [shouldShow, setShouldShow] = useState(false)
  const [checked, setChecked] = useState(false)

  const checkAndShow = useCallback(async () => {
    if (!user || isAdmin) {
      setChecked(true)
      return
    }
    try {
      const { data: sub } = await supabase
        .from('subscriptions' as any)
        .select('plan, partnership_agreement_signed')
        .eq('user_id', user.id)
        .maybeSingle()
      const plan = (sub as any)?.plan ?? 'free'
      const partnershipSigned = (sub as any)?.partnership_agreement_signed ?? false
      const { data: impression } = await supabase
        .from('ad_impressions' as any)
        .select('last_shown_at')
        .eq('user_id', user.id)
        .eq('ad_type', 'interstitial')
        .maybeSingle()
      const lastShownAt = (impression as any)?.last_shown_at
        ? new Date((impression as any).last_shown_at)
        : null
      setShouldShow(shouldShowAd({ plan, partnershipSigned, lastShownAt }))
    } catch (err) {
      console.error('[AdGate] error:', err)
    } finally {
      setChecked(true)
    }
  }, [user, isAdmin])

  useEffect(() => {
    checkAndShow()
  }, [checkAndShow])

  const recordImpression = useCallback(async () => {
    if (!user) return
    await supabase.from('ad_impressions' as any).upsert(
      {
        user_id: user.id,
        ad_type: 'interstitial',
        last_shown_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'user_id,ad_type' },
    )
    setShouldShow(false)
  }, [user])

  const triggerAd = useCallback(async () => {
    if (!shouldShow) return
    await recordImpression()
    openTerraSmartlink()
  }, [shouldShow, recordImpression])

  return { shouldShow, checked, triggerAd }
}
