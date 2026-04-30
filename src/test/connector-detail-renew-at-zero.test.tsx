import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * Real-page boundary test for the undo banner's "Renovar" at 0s.
 *
 * Production rule: while the reset-confirm modal is open the banner is
 * hidden AND the countdown is paused (deadline → pausedMs). This means
 * the banner can only physically expire AFTER the modal closes.
 *
 * This test mounts the real ConnectorDetailPage and verifies the
 * worst-case flow:
 *   1. Confirm reset → banner appears (15s, 100%).
 *   2. Advance to the very last second of the original window.
 *   3. Open the reset-confirm modal → banner hides, countdown freezes
 *      at ~0s in `pausedMs` (queued-resume value).
 *   4. While the modal is open, simulated time passes far beyond the
 *      original deadline — the banner stays alive (paused, not expired).
 *   5. Close the modal → banner reappears with the queued ~0s, then we
 *      immediately click "Renovar".
 *   6. Banner must stay visible for the entire renewed 15s window and
 *      only then transition to expired/dismissed at zero.
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
  const resetBtn = await screen.findByRole('button', { name: /resetar filtros/i })
  act(() => { fireEvent.click(resetBtn) })
  const confirmBtn = await screen.findByRole('alertdialog').then(d =>
    within(d).getByRole('button', { name: /^resetar$/i })
  )
  act(() => { fireEvent.click(confirmBtn) })
  return await screen.findByTestId('undo-banner')
}

async function openResetModal() {
  const resetBtn = await screen.findByRole('button', { name: /resetar filtros/i })
  act(() => { fireEvent.click(resetBtn) })
  return await screen.findByRole('alertdialog')
}

function closeResetModal(dialog: HTMLElement) {
  const cancelBtn = within(dialog).getByRole('button', { name: /cancelar/i })
  act(() => { fireEvent.click(cancelBtn) })
}

const widthPct = (banner: HTMLElement) =>
  parseFloat((within(banner).getByTestId('undo-progress-bar') as HTMLElement).style.width)
const counterText = (banner: HTMLElement) =>
  within(banner).getByTestId('undo-counter').textContent || ''

describe('ConnectorDetailPage — Renovar at 0s while modal open', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps banner alive across modal-open at 0s, then Renovar, then full 15s window before expiring', async () => {
    renderPage()
    let banner = await openUndoBanner()
    expect(widthPct(banner)).toBe(100)
    expect(counterText(banner)).toMatch(/15s/)

    // (2) Advance to the very last second of the original window.
    act(() => { vi.advanceTimersByTime(14_000) })
    expect(within(banner).getByTestId('undo-counter')).toHaveTextContent(/1s/)

    // (3) Open reset-confirm modal → banner is removed from the DOM (paused).
    const dialog = await openResetModal()
    expect(screen.queryByTestId('undo-banner')).toBeNull()

    // (4) Time flies far past the original deadline. Paused → no expiration.
    act(() => { vi.advanceTimersByTime(60_000) })
    // Banner still hidden by the modal but NOT expired/dismissed under the hood.
    expect(screen.queryByTestId('undo-banner')).toBeNull()

    // (5) Close modal → banner reappears with the queued near-zero value,
    // then click Renovar to grant a fresh 15s window.
    closeResetModal(dialog)
    banner = await screen.findByTestId('undo-banner')
    const renewBtn = within(banner).getByTestId('undo-renew-button')
    act(() => { fireEvent.click(renewBtn) })
    act(() => { vi.advanceTimersByTime(0) })

    expect(counterText(banner)).toMatch(/15s/)
    expect(widthPct(banner)).toBe(100)

    // (6) Walk the full renewed window in 1s steps. Banner must stay
    // visible the entire time and only disappear at/after zero.
    for (let elapsed = 1; elapsed <= 14; elapsed++) {
      act(() => { vi.advanceTimersByTime(1_000) })
      const stillThere = screen.queryByTestId('undo-banner')
      expect(stillThere).not.toBeNull()
      const left = 15 - elapsed
      expect(within(stillThere!).getByTestId('undo-counter'))
        .toHaveTextContent(new RegExp(`${left}s`))
      expect(widthPct(stillThere!)).toBeCloseTo((left / 15) * 100, 5)
    }

    // Cross zero → banner auto-dismisses (expired path).
    act(() => { vi.advanceTimersByTime(1_500) })
    expect(screen.queryByTestId('undo-banner')).toBeNull()
  })
})
