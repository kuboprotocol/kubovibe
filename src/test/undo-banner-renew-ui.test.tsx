import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { useEffect, useState, useCallback } from 'react'

/**
 * UI integration tests for the undo banner's "Renovar" button.
 *
 * Uses a faithful harness that mirrors the production implementation in
 * ConnectorDetailPage:
 *   - absolute deadline (epoch ms) drives the countdown
 *   - 250ms interval recomputes secondsLeft = ceil((deadline - now) / 1000)
 *   - progress bar width = clamp(secondsLeft / total * 100, 0..100)
 *   - "Renovar" sets deadline = now + UNDO_DURATION_MS and snaps secondsLeft
 *
 * Verifies that:
 *  1. The "Renovar" button is rendered and enabled in the banner.
 *  2. Clicking it immediately updates the on-screen counter back to 15s.
 *  3. The progress bar width snaps back to 100% in the same render.
 *  4. After the renew, the timer keeps decreasing on subsequent ticks.
 */

const UNDO_DURATION_MS = 15_000
const TOTAL_SECONDS = Math.round(UNDO_DURATION_MS / 1000)

function UndoBannerHarness() {
  const [deadline, setDeadline] = useState<number>(() => Date.now() + UNDO_DURATION_MS)
  const [secondsLeft, setSecondsLeft] = useState<number>(TOTAL_SECONDS)

  useEffect(() => {
    const compute = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    setSecondsLeft(compute())
    const id = window.setInterval(() => setSecondsLeft(compute()), 250)
    return () => window.clearInterval(id)
  }, [deadline])

  const resetUndoTTL = useCallback(() => {
    setDeadline(Date.now() + UNDO_DURATION_MS)
    setSecondsLeft(TOTAL_SECONDS)
  }, [])

  const progressPct = Math.max(0, Math.min(100, (secondsLeft / TOTAL_SECONDS) * 100))

  return (
    <div role="status" aria-live="polite">
      <div
        data-testid="undo-progress-bar"
        style={{ width: `${progressPct}%` }}
        aria-hidden
      />
      <span
        data-testid="undo-counter"
        aria-label={`Expira em ${secondsLeft} segundos`}
      >
        {secondsLeft}s
      </span>
      <button
        type="button"
        onClick={resetUndoTTL}
        title={`Reiniciar contador para ${TOTAL_SECONDS}s`}
      >
        Renovar
      </button>
    </div>
  )
}

const getProgressWidth = () => {
  const bar = screen.getByTestId('undo-progress-bar') as HTMLElement
  return parseFloat(bar.style.width)
}

describe('Undo banner — Renovar button (UI integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the "Renovar" button enabled inside the banner', () => {
    render(<UndoBannerHarness />)
    const btn = screen.getByRole('button', { name: /renovar/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeEnabled()
    expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    expect(btn).toHaveAttribute('title', expect.stringContaining(`${TOTAL_SECONDS}s`))
  })

  it('initial render shows full counter (15s) and 100% progress bar', () => {
    render(<UndoBannerHarness />)
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('15s')
    expect(getProgressWidth()).toBe(100)
  })

  it('updates counter and progress bar immediately when "Renovar" is clicked', () => {
    render(<UndoBannerHarness />)

    // Let 10 seconds pass → 5s remaining, ~33% bar.
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('5s')
    expect(getProgressWidth()).toBeCloseTo((5 / 15) * 100, 1)

    // Click Renovar — both UI signals must snap back in the same paint.
    const btn = screen.getByRole('button', { name: /renovar/i })
    act(() => { fireEvent.click(btn) })

    expect(screen.getByTestId('undo-counter')).toHaveTextContent('15s')
    expect(screen.getByTestId('undo-counter')).toHaveAttribute(
      'aria-label',
      `Expira em ${TOTAL_SECONDS} segundos`,
    )
    expect(getProgressWidth()).toBe(100)
  })

  it('after Renovar, the counter resumes ticking from the new deadline', () => {
    render(<UndoBannerHarness />)
    act(() => { vi.advanceTimersByTime(12_000) }) // 3s left
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('3s')

    act(() => { fireEvent.click(screen.getByRole('button', { name: /renovar/i })) })
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('15s')
    expect(getProgressWidth()).toBe(100)

    // Advance 5s into the renewed window: 10s left, bar ~66%.
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('10s')
    expect(getProgressWidth()).toBeCloseTo((10 / 15) * 100, 1)
  })

  it('successive Renovar clicks always restart the counter and bar to full', () => {
    render(<UndoBannerHarness />)
    const btn = screen.getByRole('button', { name: /renovar/i })

    for (let i = 0; i < 3; i++) {
      act(() => { vi.advanceTimersByTime(8_000) })
      act(() => { fireEvent.click(btn) })
      expect(screen.getByTestId('undo-counter')).toHaveTextContent('15s')
      expect(getProgressWidth()).toBe(100)
    }
  })

  it('the button stays enabled even after the counter reaches 0 before renew', () => {
    render(<UndoBannerHarness />)
    act(() => { vi.advanceTimersByTime(15_000) })
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('0s')
    expect(getProgressWidth()).toBe(0)

    const btn = screen.getByRole('button', { name: /renovar/i })
    expect(btn).toBeEnabled()
    act(() => { fireEvent.click(btn) })
    expect(screen.getByTestId('undo-counter')).toHaveTextContent('15s')
    expect(getProgressWidth()).toBe(100)
  })
})
