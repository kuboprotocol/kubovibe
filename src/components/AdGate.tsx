import { useEffect, useRef, forwardRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAdGate } from '@/hooks/useAdGate'
import { useDailyCredits } from '@/hooks/useDailyCredits'

const EXCLUDED_ROUTES = ['/auth', '/login', '/shortlinks', '/pricing', '/checkout', '/partner-agreement']

const AdGate = forwardRef<any, any>((props, ref) => {
  const location = useLocation()
  const { shouldShow, checked, triggerAd } = useAdGate()
  const firedRef = useRef(false)
  useDailyCredits()

  useEffect(() => {
    if (!checked || firedRef.current) return
    if (EXCLUDED_ROUTES.some((r) => location.pathname.startsWith(r))) return
    if (!shouldShow) return
    firedRef.current = true
    const t = setTimeout(() => {
      triggerAd()
    }, 1500)
    return () => clearTimeout(t)
  }, [checked, shouldShow, location.pathname, triggerAd])

  return null
})

export default AdGate
