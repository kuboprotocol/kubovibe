import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Boundary tests for the paste-state TTL persistence logic used by
 * ConnectorDetailPage. Mirrors the `readPersistedPasteRaw` rules:
 *  - missing  → null
 *  - legacy string ('verified'|'unverified') → fresh TTL
 *  - {state, ts} → expiresAt = ts + TTL (backward compat)
 *  - {state, expiresAt} → exact
 *  - now >= expiresAt → expired:true
 *  - malformed → null
 */

const PASTE_TTL_MS = 10 * 60 * 1000
const KEY = 'connector-paste-state:test'

type Raw = { state: 'verified' | 'unverified'; expiresAt: number; expired: boolean } | null

function readPersistedPasteRaw(): Raw {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    if (raw === 'verified' || raw === 'unverified') {
      return { state: raw, expiresAt: Date.now() + PASTE_TTL_MS, expired: false }
    }
    const parsed = JSON.parse(raw) as { state?: string; ts?: number; expiresAt?: number }
    if (!parsed?.state) return null
    const expiresAt = typeof parsed.expiresAt === 'number'
      ? parsed.expiresAt
      : (typeof parsed.ts === 'number' ? parsed.ts + PASTE_TTL_MS : 0)
    const state = parsed.state === 'verified' ? 'verified' : 'unverified'
    return { state, expiresAt, expired: Date.now() >= expiresAt }
  } catch { return null }
}

describe('paste TTL boundaries', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('returns null when nothing persisted', () => {
    expect(readPersistedPasteRaw()).toBeNull()
  })

  it('hydrates legacy string format with fresh TTL', () => {
    window.sessionStorage.setItem(KEY, 'verified')
    const r = readPersistedPasteRaw()
    expect(r?.state).toBe('verified')
    expect(r?.expired).toBe(false)
    expect(r?.expiresAt).toBe(Date.now() + PASTE_TTL_MS)
  })

  it('hydrates legacy {state, ts} format computing expiresAt', () => {
    const ts = Date.now() - 60_000
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: 'unverified', ts }))
    const r = readPersistedPasteRaw()
    expect(r?.expiresAt).toBe(ts + PASTE_TTL_MS)
    expect(r?.expired).toBe(false)
  })

  it('flags as expired exactly at the boundary (now === expiresAt)', () => {
    const expiresAt = Date.now()
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: 'verified', expiresAt }))
    expect(readPersistedPasteRaw()?.expired).toBe(true)
  })

  it('still active 1ms before expiration', () => {
    const expiresAt = Date.now() + 1
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: 'verified', expiresAt }))
    expect(readPersistedPasteRaw()?.expired).toBe(false)
  })

  it('flips to expired after advancing past expiresAt', () => {
    const expiresAt = Date.now() + 5_000
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: 'verified', expiresAt }))
    expect(readPersistedPasteRaw()?.expired).toBe(false)
    vi.advanceTimersByTime(5_001)
    expect(readPersistedPasteRaw()?.expired).toBe(true)
  })

  it('returns null on malformed JSON', () => {
    window.sessionStorage.setItem(KEY, '{not json')
    expect(readPersistedPasteRaw()).toBeNull()
  })

  it('returns null when state field missing', () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ expiresAt: Date.now() + 1000 }))
    expect(readPersistedPasteRaw()).toBeNull()
  })

  it('coerces unknown state values to "unverified"', () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: 'bogus', expiresAt: Date.now() + 1000 }))
    expect(readPersistedPasteRaw()?.state).toBe('unverified')
  })
})
