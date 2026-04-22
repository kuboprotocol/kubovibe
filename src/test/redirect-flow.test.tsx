import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'

// ---- Mock the Supabase client BEFORE importing anything that uses it ----
type AuthChangeCb = (event: string, session: Session | null) => void

const authState: {
  session: Session | null
  listeners: AuthChangeCb[]
} = {
  session: null,
  listeners: [],
}

const fakeUser: User = {
  id: 'user-test-1',
  email: 'tester@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User

const fakeSession: Session = {
  access_token: 'fake-access',
  refresh_token: 'fake-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
}

const signInWithPassword = vi.fn(async () => {
  authState.session = fakeSession
  authState.listeners.forEach((cb) => cb('SIGNED_IN', fakeSession))
  return { data: { session: fakeSession, user: fakeUser }, error: null }
})

const signUp = vi.fn(async () => ({ data: { session: null, user: fakeUser }, error: null }))
const signOut = vi.fn(async () => {
  authState.session = null
  authState.listeners.forEach((cb) => cb('SIGNED_OUT', null))
  return { error: null }
})
const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
      onAuthStateChange: (cb: AuthChangeCb) => {
        authState.listeners.push(cb)
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authState.listeners = authState.listeners.filter((l) => l !== cb)
              },
            },
          },
        }
      },
      signInWithPassword,
      signUp,
      signOut,
      resetPasswordForEmail,
    },
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    })),
  },
}))

vi.mock('@/integrations/lovable/index', () => ({
  lovable: {
    auth: {
      signInWithOAuth: vi.fn(async () => ({ error: null })),
    },
  },
}))

// Stub the destination page so we don't pull in heavy ConnectorDetailPage deps
const ConnectorDetailStub = () => (
  <div data-testid="connector-detail">Detalhe do conector GitHub</div>
)

// ---- Now import the real pieces under test ----
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthPage from '@/pages/AuthPage'

function renderApp(initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/connectors/:slug"
            element={
              <ProtectedRoute>
                <ConnectorDetailStub />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Redirect flow: /connectors/github → /auth → /connectors/github', () => {
  beforeEach(() => {
    authState.session = null
    authState.listeners = []
    vi.clearAllMocks()
  })

  it('redirects unauthenticated user from /connectors/github to /auth with redirect param', async () => {
    renderApp('/connectors/github')

    // Should show the AuthPage with the protection banner mentioning the redirect target
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    })

    // Banner mentions /connectors path (Conectores-specific message)
    expect(
      screen.getByText((_, node) => node?.textContent?.includes('/connectors/github') ?? false),
    ).toBeInTheDocument()
  })

  it('returns to /connectors/github after successful login', async () => {
    const user = userEvent.setup()
    renderApp('/connectors/github')

    // Wait for AuthPage
    const emailInput = await screen.findByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Senha')

    await user.type(emailInput, 'tester@example.com')
    await user.type(passwordInput, 'password123')

    const submit = screen.getByRole('button', { name: /entrar na conta/i })
    await user.click(submit)

    // Login was called with the typed credentials
    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'tester@example.com',
        password: 'password123',
      })
    })

    // After login the protected destination renders
    await waitFor(() => {
      expect(screen.getByTestId('connector-detail')).toBeInTheDocument()
    })
  })

  it('rejects open-redirect attempts (//evil.com) and falls back to /dashboard', async () => {
    const user = userEvent.setup()
    // Path doesn't matter — we pass a malicious redirect via /auth directly
    renderApp('/auth?redirect=//evil.com/phish')

    const emailInput = await screen.findByPlaceholderText('Email')
    await user.type(emailInput, 'tester@example.com')
    await user.type(screen.getByPlaceholderText('Senha'), 'password123')
    await user.click(screen.getByRole('button', { name: /entrar na conta/i }))

    // Should land on the safe fallback, NOT navigate externally
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })
})
