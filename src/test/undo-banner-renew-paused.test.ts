import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Tests for the undo banner's "Renovar" interaction with the **paused** state.
 *
 * Mirrors production logic in ConnectorDetailPage:
 *   - Pause is triggered when `resetConfirmOpen` flips to true:
 *       pausedMs = max(0, deadline - now); deadline = null
 *   - Resume (resetConfirmOpen → false):
 *       deadline = now + pausedMs; pausedMs = null
 *   - resetUndoTTL():
 *       running → deadline = now + UNDO_DURATION_MS; secondsLeft snaps to total
 *       paused  → pausedMs = UNDO_DURATION_MS; secondsLeft snaps to total
 *                 (the *queued* remaining time is restored to full window)
 *
 * Verifies:
 *   1. Renovar while paused does NOT immediately set a deadline.
 *   2. pausedMs is queued back to the full UNDO_DURATION_MS regardless of how
 *      much time was left when the modal opened.
 *   3. secondsLeft (UI) snaps to TOTAL_SECONDS in the same tick.
 *   4. progressPct jumps back to 100% while still paused.
 *   5. On resume, the deadline equals now + UNDO_DURATION_MS and the counter
 *      resumes ticking down from the renewed remaining time (not the previous
 *      smaller remainder).
 *   6. Renew → resume → tick respects the new deadline (no expiration before
 *      the renewed window elapses).
 */

const UNDO_DURATION_MS = 15_000
const TOTAL_SECONDS = Math.round(UNDO_DURATION_MS / 1000)

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

function progressPct(s: State) {
  return Math.max(0, Math.min(100, (s.secondsLeft / TOTAL_SECONDS) * 100))
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

describe('Undo banner — Renovar while paused (modal open)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('does not set a live deadline while paused; queues full window in pausedMs', () => {
    const s = createBanner()
    vi.advanceTimersByTime(10_000) // 5s left
    tick(s)
    setResetConfirmOpen(s, true)
    expect(s.deadline).toBeNull()
    expect(s.pausedMs).toBe(5_000)

    resetUndoTTL(s)

    expect(s.deadline).toBeNull()                // still paused, no live ticking
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)    // queued back to full
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)    // UI snap
    expect(progressPct(s)).toBe(100)             // bar back to full
    expect(s.expired).toBe(false)
  })

  it('queues full window regardless of remaining ms at pause time', () => {
    const cases = [14_000, 8_000, 3_000, 500] // ms elapsed before opening modal
    for (const elapsed of cases) {
      const s = createBanner()
      vi.advanceTimersByTime(elapsed)
      tick(s)
      setResetConfirmOpen(s, true)
      const beforePausedMs = s.pausedMs
      expect(beforePausedMs).toBe(Math.max(0, UNDO_DURATION_MS - elapsed))

      resetUndoTTL(s)
      expect(s.pausedMs).toBe(UNDO_DURATION_MS)
      expect(s.secondsLeft).toBe(TOTAL_SECONDS)
      expect(progressPct(s)).toBe(100)
      // restore time so the next iteration's clock baseline is consistent
      vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
    }
  })

  it('resume after renew restores the deadline to now + UNDO_DURATION_MS', () => {
    const s = createBanner()
    vi.advanceTimersByTime(9_000) // 6s left
    tick(s)
    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(6_000)

    resetUndoTTL(s) // queue full window
    // simulate user spending time inside the modal — must not affect queued ms
    vi.advanceTimersByTime(20_000)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)

    setResetConfirmOpen(s, false)
    expect(s.pausedMs).toBeNull()
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    tick(s)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(progressPct(s)).toBe(100)
    expect(s.expired).toBe(false)
  })

  it('counter resumes ticking from the renewed remaining time, not the old one', () => {
    const s = createBanner()
    vi.advanceTimersByTime(13_000) // only 2s would remain
    tick(s)
    expect(s.secondsLeft).toBe(2)
    setResetConfirmOpen(s, true)
    resetUndoTTL(s)
    setResetConfirmOpen(s, false)

    // Tick second-by-second through the renewed window — must NOT expire at 2s.
    const samples: number[] = []
    for (let elapsed = 0; elapsed <= TOTAL_SECONDS; elapsed++) {
      tick(s)
      samples.push(s.secondsLeft)
      vi.advanceTimersByTime(1000)
    }
    // First sample = full window, last = 0, strictly non-increasing.
    expect(samples[0]).toBe(TOTAL_SECONDS)
    expect(samples[samples.length - 1]).toBe(0)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1])
    }
    // Mid-window assertion: 7s in → 8s remaining (proves we didn't keep the old 2s).
    expect(samples[7]).toBe(TOTAL_SECONDS - 7)
  })

  it('does not mark expired before the renewed deadline elapses post-resume', () => {
    const s = createBanner()
    vi.advanceTimersByTime(14_500) // ~0.5s left
    tick(s)
    setResetConfirmOpen(s, true)
    resetUndoTTL(s)
    setResetConfirmOpen(s, false)

    // 14.9s into the renewed window → still alive
    vi.advanceTimersByTime(14_900)
    tick(s)
    expect(s.expired).toBe(false)
    expect(s.secondsLeft).toBeGreaterThan(0)

    // Cross the renewed deadline → expired
    vi.advanceTimersByTime(200)
    tick(s)
    expect(s.expired).toBe(true)
    expect(s.secondsLeft).toBe(0)
    expect(progressPct(s)).toBe(0)
  })

  it('multiple renews while paused remain idempotent (still queues full window)', () => {
    const s = createBanner()
    vi.advanceTimersByTime(11_000) // 4s left
    tick(s)
    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(4_000)

    resetUndoTTL(s)
    resetUndoTTL(s)
    resetUndoTTL(s)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(s.deadline).toBeNull()

    setResetConfirmOpen(s, false)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    tick(s)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
  })

  it('renewing without a prior pause snapshot still resumes correctly when paused after', () => {
    // Edge case: open modal first (no prior renew), close, then renew live, then pause again.
    const s = createBanner()
    vi.advanceTimersByTime(5_000) // 10s left
    tick(s)

    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(10_000)
    setResetConfirmOpen(s, false)
    expect(s.deadline).toBe(Date.now() + 10_000)

    resetUndoTTL(s) // live renew
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)

    vi.advanceTimersByTime(4_000) // 11s left
    tick(s)
    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(11_000)

    resetUndoTTL(s) // paused renew → queues full
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)

    setResetConfirmOpen(s, false)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    tick(s)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(progressPct(s)).toBe(100)
  })
})
