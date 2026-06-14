import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Mail, Lock, User, ArrowRight, KeyRound, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import logoImg from '@/assets/logo-kubovibe.png'

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const redirectParam = searchParams.get('redirect') || ''
  // Only allow internal paths (must start with single "/") to prevent open redirects
  const safeRedirect =
    redirectParam.startsWith('/') && !redirectParam.startsWith('//') ? redirectParam : '/dashboard'
  const { user, loading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  useEffect(() => {
    if (!loading && user) navigate(safeRedirect, { replace: true })
  }, [user, loading, navigate, safeRedirect])

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
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

              <Button
                variant="outline"
                className="w-full h-12 rounded-xl mb-4 gap-3 text-sm font-medium border-border/50 hover:bg-secondary/80"
                onClick={handleGoogleLogin}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign In com Google
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
}
