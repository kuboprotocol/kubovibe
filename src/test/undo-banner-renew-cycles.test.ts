import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Verifies the undo banner's "Renovar" button is robust against repeated
 * open/close cycles of the reset-confirmation modal.
 *
 * Mirrors production logic in ConnectorDetailPage:
 *   - Pause on modal open: pausedMs = max(0, deadline - now); deadline = null
 *   - Resume on modal close: deadline = now + pausedMs; pausedMs = null
 *   - resetUndoTTL():
 *       running → deadline = now + UNDO_DURATION_MS
 *       paused  → pausedMs = UNDO_DURATION_MS
 *       always  → secondsLeft snaps to TOTAL_SECONDS
 *
 * Asserts:
 *   1. `Renovar` is enabled across every open/close phase.
 *   2. Countdown always restarts to the full window after renew, regardless
 *      of how many open/close cycles preceded it.
 *   3. State machine never lands in an inconsistent shape (deadline + pausedMs
 *      both set, or both null while a snapshot is active).
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

/** UI-equivalent: Renovar is enabled iff there's an active snapshot. */
function renewEnabled(s: State) {
  return s.snapshot !== null
}

/** Sanity invariant: never both null while alive, never both set. */
function assertConsistent(s: State) {
  if (!s.snapshot) return
  expect(s.deadline === null && s.pausedMs === null).toBe(false)
  expect(s.deadline !== null && s.pausedMs !== null).toBe(false)
}

describe('Undo banner — Renovar across repeated modal open/close cycles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('keeps Renovar enabled through every phase of repeated cycles', () => {
    const s = createBanner()
    expect(renewEnabled(s)).toBe(true)

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(2_000)
      tick(s)
      expect(renewEnabled(s)).toBe(true)

      setResetConfirmOpen(s, true)
      expect(renewEnabled(s)).toBe(true)
      assertConsistent(s)

      setResetConfirmOpen(s, false)
      expect(renewEnabled(s)).toBe(true)
      assertConsistent(s)
    }
  })

  it('countdown resets correctly after multiple open/close cycles followed by renew', () => {
    const s = createBanner()

    // Cycle the modal 4 times with progressing time, never renewing.
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(1_500)
      setResetConfirmOpen(s, true)
      vi.advanceTimersByTime(800) // time inside modal does NOT decrement pausedMs
      setResetConfirmOpen(s, false)
    }

    tick(s)
    // 4 * 1500ms = 6_000ms of "active" time elapsed → ~9s remaining.
    expect(s.secondsLeft).toBe(9)
    expect(s.expired).toBe(false)

    // Renovar (live, modal closed) must restart full window.
    resetUndoTTL(s)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(progressPct(s)).toBe(100)
    assertConsistent(s)

    // And it must keep ticking down from the full window.
    vi.advanceTimersByTime(5_000)
    tick(s)
    expect(s.secondsLeft).toBe(10)
  })

  it('renewing inside each cycle (paused) consistently snaps state to full', () => {
    const s = createBanner()

    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(3_000)
      tick(s)
      setResetConfirmOpen(s, true)
      assertConsistent(s)

      // Renew while paused — should queue full window, not set deadline.
      resetUndoTTL(s)
      expect(s.deadline).toBeNull()
      expect(s.pausedMs).toBe(UNDO_DURATION_MS)
      expect(s.secondsLeft).toBe(TOTAL_SECONDS)
      expect(progressPct(s)).toBe(100)
      expect(renewEnabled(s)).toBe(true)

      setResetConfirmOpen(s, false)
      // Resume must restore deadline = now + UNDO_DURATION_MS.
      expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
      expect(s.pausedMs).toBeNull()
      tick(s)
      expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    }
  })

  it('alternating live and paused renews keeps the countdown coherent', () => {
    const s = createBanner()

    // Phase 1: live renew
    vi.advanceTimersByTime(4_000)
    resetUndoTTL(s)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)

    // Phase 2: open modal, renew, close
    vi.advanceTimersByTime(2_000)
    setResetConfirmOpen(s, true)
    resetUndoTTL(s)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS)
    setResetConfirmOpen(s, false)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)

    // Phase 3: open modal, do NOT renew, close
    vi.advanceTimersByTime(1_000)
    setResetConfirmOpen(s, true)
    expect(s.pausedMs).toBe(UNDO_DURATION_MS - 1_000)
    setResetConfirmOpen(s, false)
    expect(s.deadline).toBe(Date.now() + (UNDO_DURATION_MS - 1_000))

    // Phase 4: live renew again
    vi.advanceTimersByTime(2_000)
    resetUndoTTL(s)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
    tick(s)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(s.expired).toBe(false)
    expect(renewEnabled(s)).toBe(true)
  })

  it('Renovar stays enabled even when the modal is opened immediately after the previous close', () => {
    const s = createBanner()
    for (let i = 0; i < 10; i++) {
      setResetConfirmOpen(s, true)
      expect(renewEnabled(s)).toBe(true)
      setResetConfirmOpen(s, false)
      expect(renewEnabled(s)).toBe(true)
      assertConsistent(s)
    }
    resetUndoTTL(s)
    expect(s.secondsLeft).toBe(TOTAL_SECONDS)
    expect(s.deadline).toBe(Date.now() + UNDO_DURATION_MS)
  })
})
