import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { useEffect, useState, useCallback } from 'react'

/**
 * UI integration tests for the undo banner's "Renovar" button.
 *
 * Mirrors production:
 *   - absolute deadline (epoch ms) drives the countdown
 *   - 250ms interval recomputes secondsLeft = ceil((deadline - now) / 1000)
 *   - progress bar width = clamp(secondsLeft / total * 100, 0..100)
 *   - "Renovar" sets deadline = now + UNDO_DURATION_MS and snaps secondsLeft
 *
 * Now leverages the production `data-testid` hooks
 * (`undo-banner`, `undo-counter`, `undo-progress-bar`, `undo-renew-button`)
 * and asserts both inline width style and numeric `data-progress-pct`
 * for precise width validation.
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
    <div role="status" aria-live="polite" data-testid="undo-banner">
      <div
        data-testid="undo-progress-bar"
        data-progress-pct={progressPct}
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
        data-testid="undo-renew-button"
        onClick={resetUndoTTL}
        title={`Reiniciar contador para ${TOTAL_SECONDS}s`}
      >
        Renovar
      </button>
    </div>
  )
}

const getBar = () => screen.getByTestId('undo-progress-bar') as HTMLElement
const getCounter = () => screen.getByTestId('undo-counter')
const getRenew = () => screen.getByTestId('undo-renew-button')

const getProgressWidthPct = () => parseFloat(getBar().style.width)
const getProgressDataPct = () => parseFloat(getBar().getAttribute('data-progress-pct') || 'NaN')

describe('Undo banner — Renovar button (UI integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders banner with all expected testids and the renew button enabled', () => {
    render(<UndoBannerHarness />)
    const banner = screen.getByTestId('undo-banner')
    expect(banner).toBeInTheDocument()
    expect(within(banner).getByTestId('undo-counter')).toBeInTheDocument()
    expect(within(banner).getByTestId('undo-progress-bar')).toBeInTheDocument()
    const btn = within(banner).getByTestId('undo-renew-button')
    expect(btn).toBeEnabled()
    expect(btn).toHaveAttribute('title', expect.stringContaining(`${TOTAL_SECONDS}s`))
    expect(btn).toHaveTextContent(/renovar/i)
  })

  it('initial render shows full counter text and 100% width (style + data attr)', () => {
    render(<UndoBannerHarness />)
    expect(getCounter()).toHaveTextContent(`${TOTAL_SECONDS}s`)
    expect(getBar().style.width).toBe('100%')
    expect(getProgressWidthPct()).toBe(100)
    expect(getProgressDataPct()).toBe(100)
  })

  it('counter and progress width snap back instantly when "Renovar" is clicked', () => {
    render(<UndoBannerHarness />)

    act(() => { vi.advanceTimersByTime(10_000) }) // 5s left → ~33.33% width
    expect(getCounter()).toHaveTextContent('5s')
    expect(getProgressWidthPct()).toBeCloseTo((5 / TOTAL_SECONDS) * 100, 5)
    expect(getProgressDataPct()).toBeCloseTo((5 / TOTAL_SECONDS) * 100, 5)

    act(() => { fireEvent.click(getRenew()) })

    expect(getCounter()).toHaveTextContent(`${TOTAL_SECONDS}s`)
    expect(getCounter()).toHaveAttribute('aria-label', `Expira em ${TOTAL_SECONDS} segundos`)
    expect(getBar().style.width).toBe('100%')
    expect(getProgressWidthPct()).toBe(100)
    expect(getProgressDataPct()).toBe(100)
  })

  it('after Renovar, the counter and width resume ticking from the new deadline', () => {
    render(<UndoBannerHarness />)
    act(() => { vi.advanceTimersByTime(12_000) })
    expect(getCounter()).toHaveTextContent('3s')

    act(() => { fireEvent.click(getRenew()) })
    expect(getCounter()).toHaveTextContent(`${TOTAL_SECONDS}s`)
    expect(getProgressWidthPct()).toBe(100)

    act(() => { vi.advanceTimersByTime(5_000) }) // 10s left → ~66.66%
    const expected = (10 / TOTAL_SECONDS) * 100
    expect(getCounter()).toHaveTextContent('10s')
    expect(getProgressWidthPct()).toBeCloseTo(expected, 5)
    expect(getProgressDataPct()).toBeCloseTo(expected, 5)
    // style.width string must mirror the numeric data attribute exactly.
    expect(getBar().style.width).toBe(`${expected}%`)
  })

  it('successive Renovar clicks always restart counter text and width to 100%', () => {
    render(<UndoBannerHarness />)
    for (let i = 0; i < 3; i++) {
      act(() => { vi.advanceTimersByTime(8_000) })
      act(() => { fireEvent.click(getRenew()) })
      expect(getCounter()).toHaveTextContent(`${TOTAL_SECONDS}s`)
      expect(getBar().style.width).toBe('100%')
      expect(getProgressDataPct()).toBe(100)
    }
  })

  it('renew button stays enabled after counter reaches 0 and restores full state', () => {
    render(<UndoBannerHarness />)
    act(() => { vi.advanceTimersByTime(15_000) })
    expect(getCounter()).toHaveTextContent('0s')
    expect(getBar().style.width).toBe('0%')
    expect(getProgressDataPct()).toBe(0)

    const btn = getRenew()
    expect(btn).toBeEnabled()
    act(() => { fireEvent.click(btn) })
    expect(getCounter()).toHaveTextContent(`${TOTAL_SECONDS}s`)
    expect(getBar().style.width).toBe('100%')
    expect(getProgressDataPct()).toBe(100)
  })
})
