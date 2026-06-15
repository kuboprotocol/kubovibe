// E2E-style tests for the GitHub login UI on AuthPage.
// Mocks the OAuth callback responses (supabase.functions.invoke) and exercises
// the redirect, error toast (with reqId), and sign-out flows.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthPage from './AuthPage'

// --- Mocks ---
const invokeMock = vi.fn()
const signOutMock = vi.fn().mockResolvedValue(undefined)
let mockUser: any = null

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invokeMock(...args) },
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

vi.mock('@/integrations/lovable/index', () => ({
  lovable: { auth: { signInWithOAuth: vi.fn().mockResolvedValue({ error: null }) } },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signOut: signOutMock,
  }),
}))

const toastError = vi.fn()
const toastSuccess = vi.fn()
const toastLoading = vi.fn((_msg?: any, _opts?: any) => 'tid-1')
vi.mock('sonner', () => ({
  toast: {
    error: (msg: any, opts?: any) => toastError(msg, opts),
    success: (msg: any, opts?: any) => toastSuccess(msg, opts),
    loading: (msg: any, opts?: any) => toastLoading(msg, opts),
  },
}))

vi.mock('@/assets/logo-kubovibe-3d.png', () => ({ default: 'logo.png' }))

// jsdom location replacement helper
const origLocation = window.location
function setLocation(href: string) {
  // @ts-ignore
  delete window.location
  // @ts-ignore
  window.location = new URL(href) as any
  // @ts-ignore
  window.location.assign = vi.fn()
}

function renderAt(path: string) {
  setLocation(`https://kubovibe.dev${path}`)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockUser = null
})
afterEach(() => {
  vi.useRealTimers()
  // @ts-ignore
  window.location = origLocation
})

describe('AuthPage — GitHub OAuth UI', () => {
  it('clicking "Sign in with GitHub" invokes initiate and redirects to the returned URL', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { url: 'https://github.com/login/oauth/authorize?client_id=cid&state=xyz' },
      error: null,
    })
    renderAt('/auth')

    const btn = await screen.findByTestId('auth-github')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('github-signin-initiate', {
      body: { returnUrl: '/dashboard' },
    }))
    expect(toastLoading).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Redirecting to GitHub…', expect.any(Object))

    // After the 250ms delay the page navigates to GitHub
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(window.location.href).toContain('github.com/login/oauth/authorize')
  })

  it('passes the safe ?redirect param through as returnUrl', async () => {
    invokeMock.mockResolvedValueOnce({ data: { url: 'https://github.com/x' }, error: null })
    renderAt('/auth?redirect=/connectors/github')

    const btn = await screen.findByTestId('auth-github')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('github-signin-initiate', {
      body: { returnUrl: '/connectors/github' },
    }))
  })

  it('shows a friendly toast when initiate returns github_not_configured', async () => {
    invokeMock.mockResolvedValueOnce({ data: { error: 'github_not_configured' }, error: null })
    renderAt('/auth')

    const btn = await screen.findByTestId('auth-github')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastError.mock.calls[0][0]).toMatch(/not configured/i)
  })

  it('shows callback error toast with the reqId reference from the URL', async () => {
    renderAt('/auth?auth_error=invalid_state&auth_req_id=abc-123')

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    const [msg, opts] = toastError.mock.calls[0]
    expect(msg).toMatch(/session expired/i)
    expect(opts.description).toBe('Reference ID: abc-123')

    // URL is cleaned
    expect(window.location.search).not.toContain('auth_error')
    expect(window.location.search).not.toContain('auth_req_id')
  })

  it('falls back to a generic message and omits reference when reqId absent', async () => {
    renderAt('/auth?auth_error=token_exchange_failed')
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    const [, opts] = toastError.mock.calls[0]
    expect(opts.description).toBeUndefined()
  })
})

describe('AuthPage — Sign Out', () => {
  it('shows loading toast then success toast on sign-out', async () => {
    mockUser = { email: 'user@example.com', id: 'u1' }
    renderAt('/auth?signout=1')

    const btn = await screen.findByTestId('auth-signout')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
    expect(toastLoading).toHaveBeenCalledWith('Signing you out…')
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/signed out/i),
      expect.objectContaining({ id: 'tid-1' }),
    )
  })

  it('shows error toast (replacing loading) when sign-out throws', async () => {
    mockUser = { email: 'user@example.com', id: 'u1' }
    signOutMock.mockRejectedValueOnce(new Error('network down'))
    renderAt('/auth?signout=1')

    const btn = await screen.findByTestId('auth-signout')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'network down',
      expect.objectContaining({ id: 'tid-1' }),
    ))
  })
})
