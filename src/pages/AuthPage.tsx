import { useState, useEffect, forwardRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Mail, Lock, User, ArrowRight, KeyRound, ShieldAlert, Github } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import logoImg from '@/assets/logo-kubovibe-3d.png'

// Temporary flag to hide Google sign-in while the OAuth 404 (redirect URI)
// is being fixed. Set back to true once the provider callback is restored.
const SHOW_GOOGLE_LOGIN = false

const AuthPage = forwardRef<HTMLDivElement, any>((props, ref) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const redirectParam = searchParams.get('redirect') || ''
  // Allowlist of safe internal route prefixes (mirrors the edge function callback).
  // Prevents open redirects AND ensures "Try again" after an OAuth failure always
  // lands on an authorized in-app route.
  const ALLOWED_REDIRECT_PREFIXES = [
    '/dashboard', '/connectors', '/builder', '/canvas', '/profile',
    '/agents', '/docs', '/game', '/',
  ]
  const isAllowedRedirect = (p: string): boolean => {
    if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) return false
    return ALLOWED_REDIRECT_PREFIXES.some(
      (pre) => p === pre || p.startsWith(pre + '/') || p.startsWith(pre + '?'),
    )
  }
  const safeRedirect = isAllowedRedirect(redirectParam) ? redirectParam : '/dashboard'
  const { user, loading, signOut } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  // Auto-redirect logged-in users unless ?signout=1 was explicitly requested
  const wantsSignout = searchParams.get('signout') === '1'
  useEffect(() => {
    if (!loading && user && !wantsSignout) navigate(safeRedirect, { replace: true })
  }, [user, loading, navigate, safeRedirect, wantsSignout])

  const handleSignOut = async () => {
    setSigningOut(true)
    const tId = toast.loading('Signing you out…')
    try {
      await signOut()
      toast.success('Signed out successfully. You can sign in again below.', { id: tId })
      const url = new URL(window.location.href)
      url.searchParams.delete('signout')
      window.history.replaceState({}, '', url.toString())
    } catch (err: any) {
      toast.error(err?.message || 'Could not sign out', { id: tId })
    } finally {
      setSigningOut(false)
    }
  }

  const copyReferenceId = async (reqId: string) => {
    try {
      await navigator.clipboard.writeText(reqId)
      toast.success('Reference ID copied to clipboard')
    } catch {
      toast.error('Could not copy reference ID')
    }
  }

  const handleGithubLogin = async () => {
    setGithubLoading(true)
    const startingId = toast.loading('Starting GitHub sign-in…')
    try {
      const { data, error } = await supabase.functions.invoke('github-signin-initiate', {
        body: { returnUrl: safeRedirect },
      })
      if (error) throw error
      if (data?.error === 'github_not_configured') {
        toast.error('GitHub sign-in is not configured yet. Please use email or Google.', {
          id: startingId,
          action: { label: 'Try again', onClick: () => handleGithubLogin() },
        })
        setGithubLoading(false)
        return
      }
      if (!data?.url) throw new Error('No authorization URL returned')
      toast.success('Redirecting to GitHub…', { id: startingId })
      // Small delay so user sees the toast before navigation
      setTimeout(() => { window.location.href = data.url }, 250)
    } catch (err: any) {
      toast.error(err?.message || 'Could not start GitHub sign-in', {
        id: startingId,
        action: { label: 'Try again', onClick: () => handleGithubLogin() },
      })
      setGithubLoading(false)
    }
  }

  // Surface OAuth errors coming back from the GitHub callback
  useEffect(() => {
    const err = searchParams.get('auth_error')
    if (!err) return
    const reqId = searchParams.get('auth_req_id') || ''
    const messages: Record<string, string> = {
      github_not_configured: 'GitHub sign-in is temporarily unavailable. Please use email or Google.',
      server_misconfigured: 'Sign-in service is not configured. Please try again later.',
      github_email_unavailable: 'Your GitHub account has no verified email. Please add one and retry.',
      invalid_state: 'Sign-in session expired. Please try again.',
      missing_code_or_state: 'GitHub did not return a valid response. Please try again.',
      oauth_denied: 'GitHub access was denied.',
    }
    const baseMsg = messages[err] || `GitHub sign-in failed: ${err}`
    // Include the Reference ID in the main toast message so screen readers
    // announce it via sonner's aria-live region (description is not always read).
    const announced = reqId ? `${baseMsg} Reference ID: ${reqId}.` : baseMsg
    toast.error(announced, {
      description: reqId ? `Reference ID: ${reqId}` : undefined,
      duration: 10000,
      action: { label: 'Try again', onClick: () => handleGithubLogin() },
      cancel: reqId ? { label: 'Copy ID', onClick: () => copyReferenceId(reqId) } : undefined,
    })

    // Try to auto-copy the Reference ID to the clipboard for quick log correlation.
    // Browser clipboard APIs typically require a user gesture, so we fall back to
    // an explicit confirmation toast with a "Copy Reference ID" button on failure.
    if (reqId) {
      const auto = navigator.clipboard?.writeText?.(reqId)
      if (auto && typeof (auto as Promise<void>).then === 'function') {
        ;(auto as Promise<void>)
          .then(() => {
            toast.success('Reference ID copied to clipboard', {
              description: reqId,
              duration: 6000,
            })
          })
          .catch(() => {
            toast('Copy Reference ID?', {
              description: reqId,
              duration: 12000,
              action: { label: 'Copy Reference ID', onClick: () => copyReferenceId(reqId) },
            })
          })
      } else {
        toast('Copy Reference ID?', {
          description: reqId,
          duration: 12000,
          action: { label: 'Copy Reference ID', onClick: () => copyReferenceId(reqId) },
        })
      }
    }

    // Clean URL
    const url = new URL(window.location.href)
    url.searchParams.delete('auth_error')
    url.searchParams.delete('auth_req_id')
    window.history.replaceState({}, '', url.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}${safeRedirect}`,
    })
    if (error) toast.error('Error signing in with Google')
  }


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success('Recovery email sent! Check your inbox.')
      setForgotPassword(false)
    } catch (err: any) {
      toast.error(err.message || 'Error sending recovery email')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(safeRedirect, { replace: true })
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName, ...(refCode ? { referral_code: refCode } : {}) },
            emailRedirectTo: `${window.location.origin}${safeRedirect}`,
          },
        })
        if (error) throw error
        toast.success('Account created successfully!')

        // Send welcome email (fire-and-forget)
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'welcome',
            recipientEmail: email,
            idempotencyKey: `welcome-${data.user?.id || email}`,
            templateData: { name: displayName },
          },
        }).catch(() => {})

        navigate(safeRedirect, { replace: true })
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication error'
      if (msg.includes('Invalid login credentials')) {
        toast.error('Incorrect email or password. Check your details or create an account.')
      } else if (msg.includes('User already registered')) {
        toast.error('This email is already registered. Try logging in.')
      } else if (msg.includes('security purposes')) {
        toast.error('Please wait a few seconds before trying again.')
      } else {
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  const inputClasses = "h-12 pl-11 rounded-xl bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all duration-200"

  return (
    <div ref={ref} className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {forgotPassword ? (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="glass glass-border rounded-3xl p-8 shadow-gold">
              <div className="text-center mb-8">
                <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-glow">
                  <KeyRound className="h-7 w-7 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground">Recover password</h1>
                <p className="text-sm text-muted-foreground mt-2">We will send a link to reset your password</p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className={inputClasses}
                  />
                </div>
                <Button type="submit" data-testid="auth-recover-submit" variant="hero" className="w-full h-12 rounded-xl text-sm font-semibold gap-2" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Send recovery link
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-6">
                <button onClick={() => setForgotPassword(false)} className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  ← Back to login
                </button>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="glass glass-border rounded-3xl p-8 shadow-gold">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-5">
                  <img src={logoImg} alt="KUBO VIBE" className="h-12" />
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground">
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  {isLogin ? 'Access your projects on KUBO VIBE' : 'Start building amazing apps'}
                </p>
              </div>

              {user && (
                <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/40 p-3.5">
                  <div className="text-xs text-foreground/80 leading-relaxed">
                    Signed in as <span className="font-semibold text-foreground">{user.email}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    aria-busy={signingOut}
                    aria-label={signingOut ? 'Signing out' : 'Sign out'}
                    data-testid="auth-signout"
                    className="h-8 rounded-lg text-xs"
                  >
                    {signingOut ? (
                      <Loader2 className="h-3 w-3 animate-spin" role="status" aria-label="Signing out" data-testid="auth-signout-spinner" />
                    ) : (
                      'Sign out'
                    )}
                  </Button>
                </div>
              )}

              {redirectParam && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5"
                  role="status"
                  aria-live="polite"
                >
                  <ShieldAlert className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-foreground/90 leading-relaxed">
                    {safeRedirect.startsWith('/connectors') ? (
                      <>
                        The <span className="font-semibold text-primary">Connectors</span> area is protected.
                        Log in to continue and we'll redirect you back to{' '}
                        <code className="px-1 py-0.5 rounded bg-secondary/70 text-[11px] font-mono text-foreground">
                          {safeRedirect}
                        </code>.
                      </>
                    ) : (
                      <>
                        This page is protected. Log in to continue and we'll redirect you back to{' '}
                        <code className="px-1 py-0.5 rounded bg-secondary/70 text-[11px] font-mono text-foreground">
                          {safeRedirect}
                        </code>.
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Google sign-in temporarily hidden (OAuth 404). Toggle SHOW_GOOGLE_LOGIN to re-enable. */}
              {SHOW_GOOGLE_LOGIN && (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl mb-3 gap-3 text-sm font-medium border-border/50 hover:bg-secondary/80"
                  onClick={handleGoogleLogin}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full h-12 rounded-xl mb-4 gap-3 text-sm font-medium border-border/50 hover:bg-secondary/80"
                onClick={handleGithubLogin}
                disabled={githubLoading}
                data-testid="auth-github"
              >
                {githubLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Github className="h-5 w-5" />
                )}
                Sign in with GitHub
              </Button>


              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs text-muted-foreground">or use email</span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              {/* Tab switcher */}
              <div className="flex items-center bg-secondary/50 rounded-xl p-1 mb-6">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isLogin ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    !isLogin ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative overflow-hidden"
                    >
                      <div className="relative pb-1">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Your name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          required
                          className={inputClasses}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClasses}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={inputClasses}
                  />
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setForgotPassword(true)}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Forgot my password
                    </button>
                  </div>
                )}

                <Button type="submit" data-testid="auth-submit" variant="hero" className="w-full h-12 rounded-xl text-sm font-semibold gap-2" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isLogin ? 'Sign In na conta' : 'Create my account'}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                {isLogin ? 'New here?' : 'Already have an account?'}{' '}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  {isLogin ? 'Create your free account' : 'Sign in'}
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export default AuthPage
