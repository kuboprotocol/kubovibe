import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Edge-case tests for the undo banner expiration boundary.
 *
 * Validates that "Renovar" clicked at the very last moment while the
 * confirmation modal is OPEN (paused) correctly:
 *   - queues a fresh full window in `pausedMs` (does not set a deadline yet)
 *   - prevents premature expiration while paused
 *   - on resume, makes the banner expire exactly at zero seconds of the
 *     renewed window — never earlier, never later than one tick (250 ms).
 *
 * Mirrors production logic in ConnectorDetailPage.
 */

const UNDO_DURATION_MS = 15_000
const TOTAL_SECONDS = Math.round(UNDO_DURATION_MS / 1000)
const TICK_MS = 250

type State = {
  snapshot: { removed: string[] } | null
  deadline: number | null
  pausedMs: number | null
  secondsLeft: number
  resetConfirmOpen: boolean
  expired: boolean
}

function createBanner(): State {
  return {
    snapshot: { removed: ['run'] },
    deadline: Date.now() + UNDO_DURATION_MS,
    pausedMs: null,
    secondsLeft: TOTAL_SECONDS,
    resetConfirmOpen: false,
    expired: false,
  }
}

function tick(s: State) {
  if (!s.snapshot || s.deadline === null) return
  const remaining = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000))
  s.secondsLeft = remaining
  if (remaining <= 0) s.expired = true
}

function setResetConfirmOpen(s: State, open: boolean) {
  if (!s.snapshot) return
  if (open && !s.resetConfirmOpen) {
    if (s.deadline !== null) {
      s.pausedMs = Math.max(0, s.deadline - Date.now())
      s.deadline = null
    }
  } else if (!open && s.resetConfirmOpen) {
    if (s.pausedMs !== null) {
      s.deadline = Date.now() + s.pausedMs
      s.pausedMs = null
    }
  }
  s.resetConfirmOpen = open
}

function resetUndoTTL(s: State) {
  if (!s.snapshot) return
  if (s.resetConfirmOpen) {
    s.pausedMs = UNDO_DURATION_MS
  } else {
    s.deadline = Date.now() + UNDO_DURATION_MS
  }
  s.secondsLeft = TOTAL_SECONDS
}

describe('Undo banner — expiration boundary with last-moment Renovar while paused', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('clicking Renovar inside the modal at the last moment prevents expiration while paused', () => {
    const s = createBanner()
    // Advance to 14.999s elapsed → only 1ms remaining of the original window.
    vi.advanceTimersByTime(UNDO_DURATION_MS - 1)
    tick(s)
    expect(s.secondsLeft).toBe(1)
    expect(s.expired).toBe(false)

    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(1)
    expect(s.deadline).toBeNull()

    // Last-moment renew while paused: queues a brand-new full window.
    resetUndoTTL(s)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)
    expect(s.deadline).toBeNull()
    expect(s.expired).toBe(false)

    // Time passing inside the modal must NOT expire the banner.
    vi.advanceTimersByTime(60_000)
    tick(s) // no-op while deadline is null
    expect(s.expired).toBe(false)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
  })

  it('after resume, the banner expires exactly at zero of the renewed window (within one tick)', () => {
    const s = createBanner()
    vi.advanceTimersByTime(UNDO_DURATION_MS - 1) // 1ms left
    tick(s)
    setResetConfirmOpen(s, true)
    resetUndoTTL(s)            // queue full window
    vi.advanceTimersByTime(5_000) // user lingers in modal
    setResetConfirmOpen(s, false) // resume

    const renewedDeadline = s.deadline!
    expect(renewedDeadline).toBe(Date.now() + UNDO_DURATION_MS)

    // Just before deadline → still alive, secondsLeft === 1.
    vi.setSystemTime(new Date(renewedDeadline - 1))
    tick(s)
    expect(s.expired).toBe(false)
    expect(s.secondsLeft).toBe(1)

    // Exactly at deadline → expired, secondsLeft === 0.
    vi.setSystemTime(new Date(renewedDeadline))
    tick(s)
    expect(s.expired).toBe(true)
    expect(s.secondsLeft).toBe(0)
  })

  it('does not expire before the renewed window elapses on the simulated tick loop', () => {
    const s = createBanner()
    vi.advanceTimersByTime(UNDO_DURATION_MS - 1)
    tick(s)
    setResetConfirmOpen(s, true)
    resetUndoTTL(s)
    setResetConfirmOpen(s, false)

    const renewedDeadline = s.deadline!
    const start = Date.now()
    let firstExpiredAt: number | null = null

    // Tick every 250ms across the renewed window + a small overshoot.
    while (Date.now() - start < UNDO_DURATION_MS + TICK_MS * 2) {
      tick(s)
      if (s.expired && firstExpiredAt === null) {
        firstExpiredAt = Date.now()
        break
      }
      vi.advanceTimersByTime(TICK_MS)
    }

    expect(firstExpiredAt).not.toBeNull()
    // Expiration must happen at the deadline, allowing at most one tick of slack.
    expect(firstExpiredAt!).toBeGreaterThanOrEqual(renewedDeadline)
    expect(firstExpiredAt! - renewedDeadline).toBeLessThan(TICK_MS)
    expect(s.secondsLeft).toBe(0)
  })

  it('Renovar at the original deadline boundary while paused still grants a full new window', () => {
    const s = createBanner()
    // Open modal exactly at the original deadline → pausedMs === 0.
    vi.advanceTimersByTime(UNDO_DURATION_MS)
    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(0)
    expect(s.expired).toBe(false) // tick is gated by deadline; paused = no expire

    resetUndoTTL(s)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)
    setResetConfirmOpen(s, false)

    const renewedDeadline = s.deadline!
    // 14.999s into renewed window → still alive.
    vi.setSystemTime(new Date(renewedDeadline - 1))
    tick(s)
    expect(s.expired).toBe(false)
    expect(s.secondsLeft).toBe(1)

    // Cross the renewed deadline → expired exactly at zero.
    vi.setSystemTime(new Date(renewedDeadline))
    tick(s)
    expect(s.expired).toBe(true)
    expect(s.secondsLeft).toBe(0)
  })
})
