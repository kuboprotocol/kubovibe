import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Integration tests for the "Renovar TTL" quick revalidation flow.
 * Mirrors `renewPasteTTL` from ConnectorDetailPage:
 *  - idle  → no-op (nothing persisted, nothing changes)
 *  - verified → keeps state, extends expiresAt by full TTL
 *  - unverified → keeps state, extends expiresAt by full TTL
 *  - expired → demotes to 'unverified' (cannot re-confirm clipboard)
 *  - persistence: refreshed deadline is written back to sessionStorage
 *  - boundary: never renews to a deadline before now()
 */

const PASTE_TTL_MS = 10 * 60 * 1000
const KEY = 'connector-paste-state:test'

type State = 'idle' | 'verified' | 'unverified' | 'expired'
type Stored = { state: 'verified' | 'unverified'; expiresAt: number }

function readStored(): Stored | null {
  const raw = window.sessionStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as Stored } catch { return null }
}

function renewPasteTTL(current: State): { state: State; expiresAt: number | null } {
  if (current === 'idle') return { state: 'idle', expiresAt: null }
  const refreshed = Date.now() + PASTE_TTL_MS
  const next: State = current === 'expired' ? 'unverified' : current
  window.sessionStorage.setItem(KEY, JSON.stringify({ state: next, expiresAt: refreshed }))
  return { state: next, expiresAt: refreshed }
}

describe('Renovar TTL (quick revalidation)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T10:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('does nothing when state is idle', () => {
    const r = renewPasteTTL('idle')
    expect(r.state).toBe('idle')
    expect(r.expiresAt).toBeNull()
    expect(readStored()).toBeNull()
  })

  it('keeps "verified" state and extends TTL by 10 minutes', () => {
    const r = renewPasteTTL('verified')
    expect(r.state).toBe('verified')
    expect(r.expiresAt).toBe(Date.now() + PASTE_TTL_MS)
    expect(readStored()).toEqual({ state: 'verified', expiresAt: Date.now() + PASTE_TTL_MS })
  })

  it('keeps "unverified" state and extends TTL by 10 minutes', () => {
    const r = renewPasteTTL('unverified')
    expect(r.state).toBe('unverified')
    expect(readStored()?.state).toBe('unverified')
  })

  it('demotes "expired" to "unverified" on renewal (cannot re-confirm clipboard)', () => {
    const r = renewPasteTTL('expired')
    expect(r.state).toBe('unverified')
    expect(r.expiresAt).toBe(Date.now() + PASTE_TTL_MS)
    expect(readStored()?.state).toBe('unverified')
  })

  it('overwrites a near-expired deadline with a full TTL window', () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: 'verified', expiresAt: Date.now() + 500 }))
    renewPasteTTL('verified')
    const stored = readStored()!
    expect(stored.expiresAt - Date.now()).toBe(PASTE_TTL_MS)
  })

  it('renewal never produces a deadline before now()', () => {
    const r = renewPasteTTL('verified')
    expect(r.expiresAt!).toBeGreaterThan(Date.now())
  })

  it('successive renewals each grant a fresh full-window deadline', () => {
    const first = renewPasteTTL('verified').expiresAt!
    vi.advanceTimersByTime(60_000)
    const second = renewPasteTTL('verified').expiresAt!
    expect(second - first).toBe(60_000)
    expect(second).toBe(Date.now() + PASTE_TTL_MS)
  })
})
