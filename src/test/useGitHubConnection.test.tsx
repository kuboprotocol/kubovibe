import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

/**
 * useGitHubConnection: o GitHub conecta via token pessoal (PAT) dentro do
 * KUBO — `connect()` leva à subpágina de setup, sem OAuth externo nem
 * chamada de edge function. `disconnect()` apaga a conexão e a credencial.
 */

const h = vi.hoisted(() => {
  const invokeMock = vi.fn()
  const deleteEq = vi.fn(async () => ({ error: null as unknown }))
  const fromMock = vi.fn((_name: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { id: 'c1', github_username: 'kubo', github_avatar_url: null, scope: 'repo', connected_at: '2026-09-25' },
        }),
      }),
    }),
    delete: () => ({ eq: (..._args: unknown[]) => ({ eq: deleteEq, then: (r: (v: unknown) => void) => r({ error: null }) }) }),
  }))
  const toastMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
  // Mesma referência em todo render, como o AuthProvider real — um objeto
  // novo a cada render faria o useCallback([user]) do hook refazer o fetch
  // sem parar.
  const user = { id: 'u1' }
  return { invokeMock, fromMock, toastMock, deleteEq, user }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (name: string, opts?: unknown) => h.invokeMock(name, opts) },
    from: (name: string) => h.fromMock(name),
  },
}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock('sonner', () => ({ toast: h.toastMock }))
vi.mock('@/hooks/useConnectorLogs', () => ({ logConnectorEvent: vi.fn() }))

import { useGitHubConnection } from '@/hooks/useGitHubConnection'

const originalLocation = window.location

beforeEach(() => {
  h.invokeMock.mockClear(); h.fromMock.mockClear(); Object.values(h.toastMock).forEach((m) => m.mockClear())
  ;(window as unknown as { location: unknown }).location = {
    href: 'http://localhost/connectors/github',
    pathname: '/connectors/github',
    search: '',
  }
})

afterEach(() => {
  ;(window as unknown as { location: Location }).location = originalLocation
})

describe('useGitHubConnection', () => {
  it('loads the existing connection for the signed-in user', async () => {
    const { result } = renderHook(() => useGitHubConnection())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(h.fromMock).toHaveBeenCalledWith('github_connections_safe')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.connection?.github_username).toBe('kubo')
  })

  it('connect() navigates to the internal PAT setup page without calling an edge function', async () => {
    const { result } = renderHook(() => useGitHubConnection())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.connect()
    })

    expect(window.location.href).toBe('/connectors/github/setup')
    expect(result.current.connecting).toBe(true)
    expect(h.invokeMock).not.toHaveBeenCalled()
  })

  it('disconnect() removes the connection and the stored credential', async () => {
    const { result } = renderHook(() => useGitHubConnection())
    await waitFor(() => expect(result.current.isConnected).toBe(true))

    await act(async () => {
      await result.current.disconnect()
    })

    expect(h.fromMock).toHaveBeenCalledWith('github_connections')
    expect(h.fromMock).toHaveBeenCalledWith('api_credentials')
    expect(result.current.isConnected).toBe(false)
    expect(h.toastMock.info).toHaveBeenCalledWith('GitHub disconnected.')
  })
})
