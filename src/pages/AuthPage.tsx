import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'

export default function AuthPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/dashboard')
  }, [user, loading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        toast.success('Conta criada com sucesso!')
        navigate('/dashboard')
      }
    } catch (err: any) {
      const msg = err.message || 'Erro na autenticação'
      if (msg.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos. Verifique seus dados ou crie uma conta.')
      } else if (msg.includes('User already registered')) {
        toast.error('Este email já está cadastrado. Tente fazer login.')
      } else if (msg.includes('security purposes')) {
        toast.error('Aguarde alguns segundos antes de tentar novamente.')
      } else {
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {isLogin ? 'Entrar' : 'Criar conta'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Acesse seus projetos' : 'Comece a criar seus apps'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <Input
              placeholder="Seu nome"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isLogin ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
