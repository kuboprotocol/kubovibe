import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'

// ---- Mock the Supabase client (factory is hoisted; keep it self-contained) ----
vi.mock('@/integrations/supabase/client', () => {
  type AuthChangeCb = (event: string, session: Session | null) => void
  const state: { session: Session | null; listeners: AuthChangeCb[] } = {
    session: null,
    listeners: [],
  }

  const fakeUser = {
    id: 'user-test-1',
    email: 'tester@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as unknown as User

  const fakeSession: Session = {
    access_token: 'fake-access',
    refresh_token: 'fake-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: fakeUser,
  }

  const signInWithPassword = vi.fn(async () => {
    state.session = fakeSession
    state.listeners.forEach((cb) => cb('SIGNED_IN', fakeSession))
    return { data: { session: fakeSession, user: fakeUser }, error: null }
  })

  return {
    supabase: {
      __testState: state,
      __resetTestState: () => {
        state.session = null
        state.listeners = []
      },
      auth: {
        getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
        onAuthStateChange: (cb: AuthChangeCb) => {
          state.listeners.push(cb)
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  state.listeners = state.listeners.filter((l) => l !== cb)
                },
              },
            },
          }
        },
        signInWithPassword,
        signUp: vi.fn(async () => ({ data: { session: null, user: fakeUser }, error: null })),
        signOut: vi.fn(async () => {
          state.session = null
          state.listeners.forEach((cb) => cb('SIGNED_OUT', null))
          return { error: null }
        }),
        resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
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
  }
})

vi.mock('@/integrations/lovable/index', () => ({
  lovable: { auth: { signInWithOAuth: vi.fn(async () => ({ error: null })) } },
}))

// Stub destination — keeps the test focused on redirect logic
const ConnectorDetailStub = () => (
  <div data-testid="connector-detail">Detalhe do conector GitHub</div>
)

// Now import the real pieces under test (after mocks are registered)
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthPage from '@/pages/AuthPage'
import { supabase } from '@/integrations/supabase/client'

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
    // Reset shared mock state between tests
    ;(supabase as unknown as { __resetTestState: () => void }).__resetTestState()
  })

  it('redirects unauthenticated user from /connectors/github to /auth with redirect param', async () => {
    renderApp('/connectors/github')

    // AuthPage form renders
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    })

    // Banner mentions the protected destination path
    await waitFor(() => {
      expect(
        screen.getByText((_, node) =>
          Boolean(node?.textContent?.includes('/connectors/github')),
        ),
      ).toBeInTheDocument()
    })
  })

  it('returns to /connectors/github after successful login', async () => {
    const user = userEvent.setup()
    renderApp('/connectors/github')

    const emailInput = await screen.findByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Senha')

    await user.type(emailInput, 'tester@example.com')
    await user.type(passwordInput, 'password123')

    await user.click(screen.getByRole('button', { name: /entrar na conta/i }))

    // Login was called with the typed credentials
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
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
    renderApp('/auth?redirect=//evil.com/phish')

    const emailInput = await screen.findByPlaceholderText('Email')
    await user.type(emailInput, 'tester@example.com')
    await user.type(screen.getByPlaceholderText('Senha'), 'password123')
    await user.click(screen.getByRole('button', { name: /entrar na conta/i }))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
  })
})
