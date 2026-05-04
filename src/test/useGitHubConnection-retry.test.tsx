import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const h = vi.hoisted(() => {
  const invokeMock = vi.fn()
  const fromMock = vi.fn((_name: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: null }) }),
    }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  }))
  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
  return { invokeMock, fromMock, toastMock }
})

const { invokeMock, fromMock, toastMock } = h

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (name: string, opts?: unknown) => h.invokeMock(name, opts) },
    from: (name: string) => h.fromMock(name),
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('sonner', () => ({ toast: h.toastMock }))

vi.mock('@/hooks/useConnectorLogs', () => ({
  logConnectorEvent: vi.fn(),
}))

// Stub window.location.href setter to prevent jsdom navigation errors
const originalLocation = window.location
beforeEach(() => {
  invokeMock.mockReset()
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  toastMock.warning.mockReset()
  toastMock.info.mockReset()
  ;(window as unknown as { location: unknown }).location = {
    href: 'http://localhost/',
    pathname: '/',
    search: '',
  }
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  ;(window as unknown as { location: Location }).location = originalLocation
})

// Build a fake FunctionsHttpError-like error with a Response in context
function rateLimitedError(retryAfterSec = 2, viaHeader = false) {
  const body = viaHeader ? { error: 'rate_limited' } : { error: 'rate_limited', retry_after_seconds: retryAfterSec }
  const response = new Response(JSON.stringify(body), {
    status: 429,
    headers: viaHeader
      ? { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) }
      : { 'Content-Type': 'application/json' },
  })
  const err = new Error('rate limited') as Error & { context: { response: Response } }
  err.context = { response }
  return err
}

import { useGitHubConnection } from '@/hooks/useGitHubConnection'

describe('useGitHubConnection retry/backoff on 429', () => {
  it('retries with Retry-After (payload) and succeeds on attempt 2', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: rateLimitedError(2, false) })
      .mockResolvedValueOnce({ data: { url: 'https://github.com/login/oauth/authorize?x=1' }, error: null })

    const { result } = renderHook(() => useGitHubConnection())

    await act(async () => {
      result.current.connect()
      // allow first invoke promise to resolve
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    })

    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(toastMock.warning).toHaveBeenCalled()

    // wait should be max(2*1000, 1000*2^0)=2000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(invokeMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2)
    })
    expect(invokeMock).toHaveBeenCalledTimes(2)
    expect(window.location.href).toContain('github.com/login/oauth/authorize')
  })

  it('honors Retry-After header when payload has no retry_after_seconds', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: rateLimitedError(3, true) })
      .mockResolvedValueOnce({ data: { url: 'https://github.com/login/oauth/authorize' }, error: null })

    const { result } = renderHook(() => useGitHubConnection())
    await act(async () => {
      result.current.connect()
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    })

    await act(async () => { await vi.advanceTimersByTimeAsync(2999) })
    expect(invokeMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(2) })
    expect(invokeMock).toHaveBeenCalledTimes(2)
  })

  it('uses exponential backoff (min 2^attempt seconds) when no Retry-After provided', async () => {
    const errNoHint = (() => {
      const response = new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
      const err = new Error('rate limited') as Error & { context: { response: Response } }
      err.context = { response }
      return err
    })()

    invokeMock
      .mockResolvedValueOnce({ data: null, error: errNoHint })
      .mockResolvedValueOnce({ data: { url: 'https://github.com/x' }, error: null })

    const { result } = renderHook(() => useGitHubConnection())
    await act(async () => {
      result.current.connect()
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    })

    // attempt 1 failed -> wait 1000 * 2^0 = 1000ms
    await act(async () => { await vi.advanceTimersByTimeAsync(999) })
    expect(invokeMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(2) })
    expect(invokeMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after maxAttempts (3) and shows error toast', async () => {
    invokeMock.mockResolvedValue({ data: null, error: rateLimitedError(1, false) })

    const { result } = renderHook(() => useGitHubConnection())
    await act(async () => {
      result.current.connect()
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    })

    // attempt 1 -> wait max(1000, 1000) = 1000ms
    await act(async () => { await vi.advanceTimersByTimeAsync(1001) })
    // attempt 2 -> wait max(1000, 2000) = 2000ms
    await act(async () => { await vi.advanceTimersByTimeAsync(2001) })
    // attempt 3 should exhaust and call error toast
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(invokeMock).toHaveBeenCalledTimes(3)
    expect(toastMock.error).toHaveBeenCalled()
    const msg = toastMock.error.mock.calls[0][0] as string
    expect(msg).toMatch(/Limite de conexões atingido/)
  })

  it('caps backoff wait at 15s', async () => {
    // Big retry-after should be capped to 15000ms
    invokeMock
      .mockResolvedValueOnce({ data: null, error: rateLimitedError(120, false) })
      .mockResolvedValueOnce({ data: { url: 'https://github.com/x' }, error: null })

    const { result } = renderHook(() => useGitHubConnection())
    await act(async () => {
      result.current.connect()
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    })

    await act(async () => { await vi.advanceTimersByTimeAsync(14_999) })
    expect(invokeMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(2) })
    expect(invokeMock).toHaveBeenCalledTimes(2)
  })

  describe('falls back to exponential backoff when Retry-After is invalid', () => {
    function rateLimitedWithHeader(headerValue: string | null) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (headerValue !== null) headers['Retry-After'] = headerValue
      const response = new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers,
      })
      const err = new Error('rate limited') as Error & { context: { response: Response } }
      err.context = { response }
      return err
    }

    async function runScenario(headerValue: string | null) {
      invokeMock
        .mockResolvedValueOnce({ data: null, error: rateLimitedWithHeader(headerValue) })
        .mockResolvedValueOnce({ data: { url: 'https://github.com/x' }, error: null })

      const { result } = renderHook(() => useGitHubConnection())
      await act(async () => {
        result.current.connect()
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
      })

      // Expect exponential default: 1000 * 2^0 = 1000ms
      await act(async () => { await vi.advanceTimersByTimeAsync(999) })
      expect(invokeMock).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(2) })
      expect(invokeMock).toHaveBeenCalledTimes(2)
    }

    it('absent Retry-After header → exponential default (1s)', async () => {
      await runScenario(null)
    })

    it('empty Retry-After header → exponential default (1s)', async () => {
      await runScenario('')
    })

    it('non-numeric Retry-After header (e.g. "soon") → exponential default (1s)', async () => {
      await runScenario('soon')
    })

    it('zero Retry-After header → exponential default (1s)', async () => {
      await runScenario('0')
    })

    it('negative Retry-After header → exponential default (1s)', async () => {
      await runScenario('-5')
    })
  })

  describe('falls back to exponential backoff when payload retry_after_seconds is invalid', () => {
    function rateLimitedWithPayload(payload: Record<string, unknown>) {
      const response = new Response(JSON.stringify(payload), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
      const err = new Error('rate limited') as Error & { context: { response: Response } }
      err.context = { response }
      return err
    }

    async function runPayloadScenario(payload: Record<string, unknown>) {
      invokeMock
        .mockResolvedValueOnce({ data: null, error: rateLimitedWithPayload(payload) })
        .mockResolvedValueOnce({ data: { url: 'https://github.com/x' }, error: null })

      const { result } = renderHook(() => useGitHubConnection())
      await act(async () => {
        result.current.connect()
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
      })

      // Expect exponential default: 1000 * 2^0 = 1000ms
      await act(async () => { await vi.advanceTimersByTimeAsync(999) })
      expect(invokeMock).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(2) })
      expect(invokeMock).toHaveBeenCalledTimes(2)
    }

    it('payload without retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited' })
    })

    it('payload with empty-string retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited', retry_after_seconds: '' })
    })

    it('payload with non-numeric retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited', retry_after_seconds: 'soon' })
    })

    it('payload with null retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited', retry_after_seconds: null })
    })

    it('payload with zero retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited', retry_after_seconds: 0 })
    })

    it('payload with negative retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited', retry_after_seconds: -10 })
    })

    it('payload with NaN-producing object retry_after_seconds → exponential default (1s)', async () => {
      await runPayloadScenario({ error: 'rate_limited', retry_after_seconds: { foo: 1 } })
    })
  })
})
