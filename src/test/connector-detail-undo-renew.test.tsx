import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * Full-page integration test for the undo banner's "Renovar" button.
 *
 * Mounts the real ConnectorDetailPage (no harness), drives the URL into a
 * filtered state, opens the reset-confirm dialog, confirms, then asserts
 * that clicking "Renovar" in the rendered banner instantly resets the
 * countdown text and the progress bar width.
 *
 * Heavy data hooks (auth, GitHub, logs) are stubbed so the page renders
 * deterministically with `Resetar filtros` visible.
 */

// ---- Mocks (must come before importing the page) ----

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'tester@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/useGitHubConnection', () => ({
  useGitHubConnection: () => ({
    connection: {
      id: 'gh-1',
      github_username: 'tester',
      github_avatar_url: null,
      scope: 'repo',
      connected_at: new Date().toISOString(),
    },
    loading: false,
    connecting: false,
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useConnectorLogs', () => ({
  useConnectorLogs: () => ({
    logs: [],
    loading: false,
    refetch: vi.fn(),
    clearLogs: vi.fn(async () => ({ error: null })),
  }),
  logConnectorEvent: vi.fn(async () => undefined),
}))

vi.mock('@/components/connectors/GitHubReposList', () => ({
  default: () => <div data-testid="repos-list-stub" />,
}))

vi.mock('@/components/connectors/LogSimulator', () => ({
  LogSimulator: () => <div data-testid="log-simulator-stub" />,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

// ---- Real page under test ----
import ConnectorDetailPage from '@/pages/ConnectorDetailPage'

function renderPage(initialPath = '/connectors/github?run=abcdef1234567890') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/connectors/:slug" element={<ConnectorDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openUndoBanner() {
  // Click "Resetar filtros" → opens confirm dialog → click "Resetar"
  const resetBtn = await screen.findByTestId('reset-filters-trigger')
  act(() => { fireEvent.click(resetBtn) })

  const dialog = await screen.findByTestId('reset-filters-dialog')
  const confirmBtn = within(dialog).getByTestId('reset-filters-confirm')
  act(() => { fireEvent.click(confirmBtn) })

  return await screen.findByTestId('undo-banner')
}

const getBar = (banner: HTMLElement) =>
  within(banner).getByTestId('undo-progress-bar') as HTMLElement
const getCounter = (banner: HTMLElement) =>
  within(banner).getByTestId('undo-counter')
const getRenew = (banner: HTMLElement) =>
  within(banner).getByTestId('undo-renew-button')

const widthPct = (banner: HTMLElement) => parseFloat(getBar(banner).style.width)
const dataPct = (banner: HTMLElement) =>
  parseFloat(getBar(banner).getAttribute('data-progress-pct') || 'NaN')

describe('ConnectorDetailPage — Renovar in real undo banner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the banner with renew button after confirming reset', async () => {
    renderPage()
    const banner = await openUndoBanner()
    expect(banner).toBeInTheDocument()
    const btn = getRenew(banner)
    expect(btn).toBeEnabled()
    expect(btn).toHaveTextContent(/renovar/i)
    expect(getCounter(banner)).toHaveTextContent(/15s/)
    expect(widthPct(banner)).toBe(100)
    expect(dataPct(banner)).toBe(100)
  })

  it('clicking "Renovar" in the real banner resets counter and bar instantly', async () => {
    renderPage()
    const banner = await openUndoBanner()

    // Let ~10s pass — banner should show ~5s and ~33% width.
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(getCounter(banner)).toHaveTextContent('5s')
    expect(widthPct(banner)).toBeCloseTo((5 / 15) * 100, 5)

    // Click the real Renovar button.
    act(() => { fireEvent.click(getRenew(banner)) })
    // Force a tick so the deadline-driven interval recomputes.
    act(() => { vi.advanceTimersByTime(0) })

    expect(getCounter(banner)).toHaveTextContent('15s')
    expect(widthPct(banner)).toBe(100)
    expect(dataPct(banner)).toBe(100)
    expect(getCounter(banner)).toHaveAttribute('aria-label', 'Expira em 15 segundos')
  })

  it('after Renovar, the real banner ticks down again from the new deadline', async () => {
    renderPage()
    const banner = await openUndoBanner()

    act(() => { vi.advanceTimersByTime(12_000) }) // 3s left
    expect(getCounter(banner)).toHaveTextContent('3s')

    act(() => { fireEvent.click(getRenew(banner)) })
    act(() => { vi.advanceTimersByTime(0) })
    expect(getCounter(banner)).toHaveTextContent('15s')

    act(() => { vi.advanceTimersByTime(5_000) }) // 10s left → ~66.66%
    expect(getCounter(banner)).toHaveTextContent('10s')
    expect(widthPct(banner)).toBeCloseTo((10 / 15) * 100, 5)
  })

  it('successive clicks on the real Renovar always restore full state', async () => {
    renderPage()
    const banner = await openUndoBanner()

    for (let i = 0; i < 3; i++) {
      act(() => { vi.advanceTimersByTime(7_000) })
      act(() => { fireEvent.click(getRenew(banner)) })
      act(() => { vi.advanceTimersByTime(0) })
      expect(getCounter(banner)).toHaveTextContent('15s')
      expect(widthPct(banner)).toBe(100)
    }
  })
})
