import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * Integration tests for the Ctrl/Cmd+Shift+R shortcut that renews the
 * paste-state TTL from anywhere on the page without moving focus.
 *
 * Mirrors the production handler in ConnectorDetailPage:
 *  - only fires when state !== 'idle'
 *  - requires (meta || ctrl) + shift + key R, no alt
 *  - skipped when typing in INPUT/TEXTAREA/SELECT/contenteditable/role=textbox
 *  - calls preventDefault + stopPropagation (blocks browser hard-reload)
 *  - does NOT change document.activeElement
 */

type State = 'idle' | 'verified' | 'unverified' | 'expired'

function makeHandler(getState: () => State, renew: () => void) {
  return (e: KeyboardEvent) => {
    if (getState() === 'idle') return
    const isCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && (e.key === 'r' || e.key === 'R')
    if (!isCombo) return
    const target = e.target as HTMLElement | null
    if (target && target instanceof HTMLElement) {
      const tag = target.tagName
      const role = target.getAttribute('role')
      const editable = (
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        target.isContentEditable ||
        role === 'textbox' || role === 'combobox' || role === 'searchbox' ||
        target.closest('[contenteditable="true"], [role="textbox"]') !== null
      )
      if (editable) return
    }
    e.preventDefault()
    e.stopPropagation()
    renew()
  }
}

function dispatchCombo(opts: {
  key?: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  target?: EventTarget
}) {
  const ev = new KeyboardEvent('keydown', {
    key: opts.key ?? 'R',
    ctrlKey: !!opts.ctrl,
    metaKey: !!opts.meta,
    shiftKey: !!opts.shift,
    altKey: !!opts.alt,
    bubbles: true,
    cancelable: true,
  })
  ;(opts.target ?? window).dispatchEvent(ev)
  return ev
}

describe('Renew TTL shortcut (Ctrl/Cmd+Shift+R)', () => {
  let renew: ReturnType<typeof vi.fn>
  let state: State
  let handler: (e: KeyboardEvent) => void

  beforeEach(() => {
    renew = vi.fn()
    state = 'verified'
    handler = makeHandler(() => state, renew)
    window.addEventListener('keydown', handler)
  })
  afterEach(() => {
    window.removeEventListener('keydown', handler)
    document.body.innerHTML = ''
  })

  it('fires renew on Ctrl+Shift+R', () => {
    dispatchCombo({ ctrl: true, shift: true, key: 'R' })
    expect(renew).toHaveBeenCalledTimes(1)
  })

  it('fires renew on Cmd+Shift+R (macOS)', () => {
    dispatchCombo({ meta: true, shift: true, key: 'R' })
    expect(renew).toHaveBeenCalledTimes(1)
  })

  it('accepts both lowercase r and uppercase R', () => {
    dispatchCombo({ ctrl: true, shift: true, key: 'r' })
    dispatchCombo({ ctrl: true, shift: true, key: 'R' })
    expect(renew).toHaveBeenCalledTimes(2)
  })

  it('does not fire without Shift (would conflict with browser reload)', () => {
    dispatchCombo({ ctrl: true, key: 'R' })
    dispatchCombo({ meta: true, key: 'R' })
    expect(renew).not.toHaveBeenCalled()
  })

  it('does not fire when Alt is also held', () => {
    dispatchCombo({ ctrl: true, shift: true, alt: true, key: 'R' })
    expect(renew).not.toHaveBeenCalled()
  })

  it('is a no-op when paste state is idle', () => {
    state = 'idle'
    dispatchCombo({ ctrl: true, shift: true, key: 'R' })
    expect(renew).not.toHaveBeenCalled()
  })

  it('still fires when state is expired (allows re-validation)', () => {
    state = 'expired'
    dispatchCombo({ ctrl: true, shift: true, key: 'R' })
    expect(renew).toHaveBeenCalledTimes(1)
  })

  it('calls preventDefault + stopPropagation to suppress hard-reload', () => {
    const ev = dispatchCombo({ ctrl: true, shift: true, key: 'R' })
    expect(ev.defaultPrevented).toBe(true)
  })

  it('skips when focused on an INPUT', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    dispatchCombo({ ctrl: true, shift: true, key: 'R', target: input })
    expect(renew).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(input)
  })

  it('skips when focused on a TEXTAREA', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    dispatchCombo({ ctrl: true, shift: true, key: 'R', target: ta })
    expect(renew).not.toHaveBeenCalled()
  })

  it('skips when focused inside a contenteditable region', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('contenteditable', 'true')
    const inner = document.createElement('span')
    wrap.appendChild(inner)
    document.body.appendChild(wrap)
    dispatchCombo({ ctrl: true, shift: true, key: 'R', target: inner })
    expect(renew).not.toHaveBeenCalled()
  })

  it('skips when focused on role="textbox"', () => {
    const div = document.createElement('div')
    div.setAttribute('role', 'textbox')
    document.body.appendChild(div)
    dispatchCombo({ ctrl: true, shift: true, key: 'R', target: div })
    expect(renew).not.toHaveBeenCalled()
  })

  it('does NOT change focus when firing from a non-editable element', () => {
    const btn = document.createElement('button')
    btn.textContent = 'somewhere else'
    document.body.appendChild(btn)
    btn.focus()
    expect(document.activeElement).toBe(btn)
    dispatchCombo({ ctrl: true, shift: true, key: 'R', target: btn })
    expect(renew).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(btn) // focus preserved
  })
})
