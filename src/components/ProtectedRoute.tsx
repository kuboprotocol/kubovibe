import { Navigate, useLocation } from 'react-router-dom'
import { forwardRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, ShieldAlert } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Optional role(s) required to access this route. If provided, user must have at least one. */
  requireRoles?: string[]
}

const ProtectedRoute = forwardRef<HTMLDivElement, ProtectedRouteProps>(({ children, requireRoles }, ref) => {
  const { user, loading, rolesLoading, hasAnyRole } = useAuth()
  const location = useLocation()

  // While the session or the roles query is in flight, keep the spinner —
  // otherwise admins flash the "Access restricted" screen before roles arrive.
  if (loading || (requireRoles && requireRoles.length > 0 && rolesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    const search = redirectTo && redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''
    return <Navigate to={`/auth${search}`} replace />
  }

  if (requireRoles && requireRoles.length > 0 && !hasAnyRole(requireRoles)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="text-muted-foreground max-w-md">
          You don't have permission to access this area. Contact an administrator if you believe this is a mistake.
        </p>
      </div>
    )
  }

  return <div ref={ref}>{children}</div>
})

export default ProtectedRoute
