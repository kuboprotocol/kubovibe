import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * Regression contract: the ConnectorDetailPage exposes a stable set of
 * `data-testid` selectors that tests depend on. When someone tweaks an
 * aria-label, copy, or icon, this test stays green; when someone deletes
 * or renames a testid, it fails loud — pointing at the exact selector
 * the test suite relies on.
 *
 * This pins the public test surface so flaky `getByRole({ name })` lookups
 * never sneak back into the suite.
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

describe('ConnectorDetailPage — data-testid contract', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes the reset-filters trigger and modal contract', async () => {
    renderPage()
    const trigger = await screen.findByTestId('reset-filters-trigger')
    expect(trigger).toBeInTheDocument()

    act(() => { fireEvent.click(trigger) })
    const dialog = await screen.findByTestId('reset-filters-dialog')
    expect(within(dialog).getByTestId('reset-filters-cancel')).toBeInTheDocument()
    expect(within(dialog).getByTestId('reset-filters-confirm')).toBeInTheDocument()
  })

  it('exposes the undo banner with renew/dismiss/counter/progress testids', async () => {
    renderPage()
    const trigger = await screen.findByTestId('reset-filters-trigger')
    act(() => { fireEvent.click(trigger) })
    const dialog = await screen.findByTestId('reset-filters-dialog')
    act(() => { fireEvent.click(within(dialog).getByTestId('reset-filters-confirm')) })

    const banner = await screen.findByTestId('undo-banner')
    expect(within(banner).getByTestId('undo-renew-button')).toBeInTheDocument()
    expect(within(banner).getByTestId('undo-dismiss-button')).toBeInTheDocument()
    expect(within(banner).getByTestId('undo-counter')).toBeInTheDocument()
    expect(within(banner).getByTestId('undo-progress-bar')).toBeInTheDocument()
  })

  it('opens the dismiss-confirm dialog with cancel/confirm testids', async () => {
    renderPage()
    act(() => { fireEvent.click(screen.getByTestId('reset-filters-trigger')) })
    const resetDialog = await screen.findByTestId('reset-filters-dialog')
    act(() => { fireEvent.click(within(resetDialog).getByTestId('reset-filters-confirm')) })

    const banner = await screen.findByTestId('undo-banner')
    act(() => { fireEvent.click(within(banner).getByTestId('undo-dismiss-button')) })

    const confirm = await screen.findByTestId('undo-dismiss-confirm')
    expect(within(confirm).getByTestId('undo-dismiss-cancel')).toBeInTheDocument()
    expect(within(confirm).getByTestId('undo-dismiss-confirm-button')).toBeInTheDocument()
  })
})
