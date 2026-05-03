import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * Verifies the undo banner survives a page reload by hydrating the snapshot
 * and remaining TTL from localStorage.
 *
 * Flow:
 *   1. Mount page, trigger reset → undo banner with 15s window appears.
 *   2. Advance fake timers by 6s (banner shows ~9s remaining).
 *   3. Unmount the tree (simulating navigation/reload — localStorage persists).
 *   4. Remount the page on the same route.
 *   5. Banner must reappear immediately with ~9s remaining (not a fresh 15s).
 *   6. After remaining TTL elapses, banner auto-dismisses.
 *   7. A separate case validates an expired persisted entry is discarded.
 */

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
  const dialog = await screen.findByRole('alertdialog')
  const confirmBtn = within(dialog).getByRole('button', { name: /^resetar$/i })
  act(() => { fireEvent.click(confirmBtn) })
  return await screen.findByTestId('undo-banner')
}

const STORAGE_KEY = 'connector-undo:github'

describe('ConnectorDetailPage — undo banner persists across reload', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('restores the banner with the remaining TTL after a reload', async () => {
    const { unmount } = renderPage()

    const banner = await openUndoBanner()
    expect(within(banner).getByTestId('undo-counter')).toHaveTextContent(/15s/)

    // Persisted to localStorage with snapshot + future deadline.
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(stored.snapshot.removed).toContain('?run=')
    expect(stored.deadline).toBeGreaterThan(Date.now())

    // Spend 6s on the original mount.
    act(() => { vi.advanceTimersByTime(6_000) })
    expect(within(banner).getByTestId('undo-counter')).toHaveTextContent(/9s/)

    // Simulate full page reload: tear down the React tree.
    unmount()
    expect(screen.queryByTestId('undo-banner')).toBeNull()

    // Re-mount on the same connector route. The reset cleared `?run=` from
    // the URL before the "reload", so the new mount must not re-cancel the
    // restored snapshot via the "user reapplied filter" effect.
    renderPage('/connectors/github')
    const restored = await screen.findByTestId('undo-banner')

    // Must NOT reset to a fresh 15s window — should resume around 9s left.
    const counterText = within(restored).getByTestId('undo-counter').textContent || ''
    const seconds = Number(counterText.replace(/\D/g, ''))
    expect(seconds).toBeGreaterThanOrEqual(8)
    expect(seconds).toBeLessThanOrEqual(9)

    // Counter keeps ticking down on the new mount.
    act(() => { vi.advanceTimersByTime(3_000) })
    const after3s = Number(within(restored).getByTestId('undo-counter').textContent!.replace(/\D/g, ''))
    expect(after3s).toBeGreaterThanOrEqual(5)
    expect(after3s).toBeLessThanOrEqual(6)

    // Burn the rest of the TTL — banner should auto-dismiss at zero.
    act(() => { vi.advanceTimersByTime(7_000) })
    expect(screen.queryByTestId('undo-banner')).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards an expired persisted entry on mount', async () => {
    // Pre-seed an already-expired snapshot.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        snapshot: { run: 'abcdef1234567890', runsDb: false, removed: ['?run='] },
        deadline: Date.now() - 1_000,
      }),
    )

    renderPage()

    // Banner must NOT appear, and the stale entry must be cleared.
    expect(screen.queryByTestId('undo-banner')).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears the persisted entry when the user dismisses the banner (with confirm)', async () => {
    renderPage()
    await openUndoBanner()
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    const banner = await screen.findByTestId('undo-banner')
    const dismissBtn = within(banner).getByTestId('undo-dismiss-button')
    act(() => { fireEvent.click(dismissBtn) })

    // Banner stays visible; a confirmation dialog must appear first.
    expect(screen.queryByTestId('undo-banner')).not.toBeNull()
    const confirm = await screen.findByTestId('undo-dismiss-confirm')
    const confirmBtn = within(confirm).getByTestId('undo-dismiss-confirm-button')
    act(() => { fireEvent.click(confirmBtn) })

    expect(screen.queryByTestId('undo-banner')).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('cross-tab sync: receiving a storage event from another tab restores the banner', async () => {
    renderPage('/connectors/github')
    expect(screen.queryByTestId('undo-banner')).toBeNull()

    // Simulate another tab writing a fresh snapshot to localStorage.
    const futureDeadline = Date.now() + 12_000
    const payload = JSON.stringify({
      snapshot: { run: 'feedface00000000', runsDb: false, removed: ['?run='] },
      deadline: futureDeadline,
    })
    window.localStorage.setItem(STORAGE_KEY, payload)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: payload,
          oldValue: null,
          storageArea: window.localStorage,
        }),
      )
    })

    const restored = await screen.findByTestId('undo-banner')
    const seconds = Number(within(restored).getByTestId('undo-counter').textContent!.replace(/\D/g, ''))
    expect(seconds).toBeGreaterThanOrEqual(11)
    expect(seconds).toBeLessThanOrEqual(12)
  })

  it('cross-tab sync: receiving a clear event from another tab dismisses the banner locally', async () => {
    renderPage()
    await openUndoBanner()
    expect(screen.queryByTestId('undo-banner')).not.toBeNull()

    // Another tab clears the entry → simulate the storage event.
    window.localStorage.removeItem(STORAGE_KEY)
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: null,
          oldValue: 'whatever',
          storageArea: window.localStorage,
        }),
      )
    })

    expect(screen.queryByTestId('undo-banner')).toBeNull()
  })
})
