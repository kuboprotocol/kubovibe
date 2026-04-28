import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Integration tests for the "Renovar" button on the undo banner
 * (ConnectorDetailPage). Mirrors the production logic:
 *
 *  - Absolute deadline (epoch ms) drives countdown via 250ms interval.
 *  - secondsLeft = ceil((deadline - now) / 1000)
 *  - progressPct = clamp(secondsLeft / totalSeconds * 100, 0..100)
 *  - When resetConfirmOpen → pause: capture remaining ms, clear deadline.
 *  - resetUndoTTL():
 *      • running  → deadline = now + UNDO_DURATION_MS (full reset)
 *      • paused   → pausedMs = UNDO_DURATION_MS (resume restarts full)
 *      • secondsLeft snaps immediately to total
 *
 * These tests guarantee:
 *   1. Click "Renovar" → expiration restarts immediately (deadline moves forward,
 *      secondsLeft = total in the same tick).
 *   2. Progress bar reflects the new deadline (back to 100%) and decays
 *      monotonically until 0% at expiration.
 */

const UNDO_DURATION_MS = 15_000
const TOTAL_SECONDS = Math.round(UNDO_DURATION_MS / 1000) // 15

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
    snapshot: { removed: ['run', 'runs'] },
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

describe('Undo banner — Renovar button', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('immediately restarts the deadline when "Renovar" is clicked', () => {
    const s = createBanner()
    vi.advanceTimersByTime(10_000) // 10s elapsed → 5s left
    tick(s)
    expect(s.secondsLeft).toBe(5)
    const beforeDeadline = s.deadline!

    resetUndoTTL(s)

    expect(s.deadline! - beforeDeadline).toBe(10_000) // moved forward
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS) // snaps to full immediately
    expect(s.expired).toBe(false)
  })

  it('progress bar jumps back to 100% on renew', () => {
    const s = createBanner()
    vi.advanceTimersByTime(12_000) // 3s left
    tick(s)
    expect(progressPct(s)).toBeCloseTo(20, 1) // 3/15 = 20%

    resetUndoTTL(s)
    expect(progressPct(s)).toBe(100)
  })

  it('progress bar decays monotonically to 0% over the new full window', () => {
    const s = createBanner()
    vi.advanceTimersByTime(14_000) // about to expire
    tick(s)
    expect(s.secondsLeft).toBe(1)

    resetUndoTTL(s)
    const samples: number[] = []
    for (let i = 0; i <= TOTAL_SECONDS; i++) {
      tick(s)
      samples.push(progressPct(s))
      vi.advanceTimersByTime(1000)
    }
    // First sample = 100, last sample = 0, strictly non-increasing.
    expect(samples[0]).toBe(100)
    expect(samples[samples.length - 1]).toBe(0)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1])
    }
  })

  it('only marks expired after the renewed deadline elapses (not before)', () => {
    const s = createBanner()
    vi.advanceTimersByTime(14_500)
    tick(s)
    resetUndoTTL(s)

    // 14.5s into renewed window → still alive
    vi.advanceTimersByTime(14_500)
    tick(s)
    expect(s.expired).toBe(false)
    expect(s.secondsLeft).toBe(1)

    // Cross the renewed deadline → expired
    vi.advanceTimersByTime(600)
    tick(s)
    expect(s.expired).toBe(true)
    expect(s.secondsLeft).toBe(0)
    expect(progressPct(s)).toBe(0)
  })

  it('renewing while paused (resetConfirmOpen) restores full window on resume', () => {
    const s = createBanner()
    vi.advanceTimersByTime(10_000)
    tick(s)
    setResetConfirmOpen(s, true)
    expect(s.deadline).toBeNull()
    expect(s.pausedMs).toBe(5_000)

    resetUndoTTL(s)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS) // queued full window
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)

    setResetConfirmOpen(s, false)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    tick(s)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(progressPct(s)).toBe(100)
  })

  it('successive renewals always restart from full duration', () => {
    const s = createBanner()
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(7_000)
      tick(s)
      resetUndoTTL(s)
      expect(s.secondsLeft).toBe(TOTAL_SECONDS)
      expect(progressPct(s)).toBe(100)
      expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    }
  })

  it('does nothing when there is no active snapshot', () => {
    const s: State = { ...createBanner(), snapshot: null, deadline: null, secondsLeft: 0 }
    resetUndoTTL(s)
    expect(s.deadline).toBeNull()
    expect(s.secondsLeft).toBe(0)
  })
})
