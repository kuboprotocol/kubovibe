import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  /** True while the roles query is in flight; role-gated routes should wait on this. */
  rolesLoading: boolean
  isAdmin: boolean
  roles: string[]
  hasAnyRole: (roles: string[]) => boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  rolesLoading: false,
  isAdmin: false,
  roles: [],
  hasAnyRole: () => false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([])
      return
    }
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    setRoles((data ?? []).map((r: any) => r.role))
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      loadRoles(session?.user?.id)
      setLoading(false)
    })



    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)


      setUser(session?.user ?? null)
      loadRoles(session?.user?.id)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const isAdmin = roles.includes('admin')
  const hasAnyRole = (required: string[]) => required.some((r) => roles.includes(r))

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, roles, hasAnyRole, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
