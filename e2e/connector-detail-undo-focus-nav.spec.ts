import { test, expect } from '@playwright/test'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { trackConnectorEvents } from './helpers/analytics'

/**
 * E2E: After Ctrl+Z / Cmd+Z hides the undo banner, keyboard focus and Tab
 * navigation must remain healthy:
 *   - document.activeElement stays inside the page (not on <body>)
 *   - Tab moves focus to a visible, focusable element each step
 *   - The "Resetar filtros" trigger (re-enabled by snapshot restore) is
 *     reachable via keyboard
 *   - No focus is trapped on the (now-removed) undo banner / Renovar btn
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = '0ca11ba711223344556677889900aabbccddeeff'

test.describe('ConnectorDetailPage — focus & keyboard nav after Ctrl/Cmd+Z', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  for (const combo of ['Control+z', 'Meta+z'] as const) {
    test(`focus & Tab navigation remain healthy after ${combo}`, async ({ page }) => {
      const cdp = new ConnectorDetailPage(page, 'github')
      const sha = `${RUN_SHA.slice(0, 8)}${combo === 'Meta+z' ? 'meta' : 'ctrl'}`

      await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
      await cdp.openWithRun(sha)
      await cdp.triggerUndoBanner()

      // After reset, ?run= is gone and the undo banner is in the DOM.
      await page.waitForURL((u) => u.searchParams.get('run') === null, { timeout: 5_000 })
      await expect(cdp.banner).toBeVisible()

      // Move focus onto the Renovar button so we can prove it is NOT a
      // dangling focus owner after undo removes the banner.
      await cdp.renew.focus()
      await expect(cdp.renew).toBeFocused()

      // Trigger undo + assert analytics.
      const counter = trackConnectorEvents(page, ['filters_reset_undone'])
      await page.keyboard.press(combo)
      await counter.waitFor('filters_reset_undone')
      await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
      await page.waitForURL((u) => u.searchParams.get('run') === sha, { timeout: 5_000 })
      counter.dispose()

      // ---- Focus health checks ----
      // 1. activeElement must NOT be document.body (that would mean focus
      //    was lost when the banner unmounted — a known a11y regression).
      const activeInfo = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return {
          tag: el?.tagName ?? null,
          isBody: el === document.body,
          inDom: !!el && document.contains(el),
        }
      })
      expect(activeInfo.inDom, 'focused element still in DOM').toBe(true)
      expect(activeInfo.isBody, 'focus did not collapse to <body>').toBe(false)

      // 2. Tab must move focus to a visible, focusable element. We try a
      //    few presses (skipping potential skip-links / non-visible nodes)
      //    and expect to land on something visible & enabled.
      let landed = false
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        const ok = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (!el || el === document.body) return false
          const r = el.getBoundingClientRect()
          const visible = r.width > 0 && r.height > 0
          const style = window.getComputedStyle(el)
          const interactive = style.pointerEvents !== 'none' && style.visibility !== 'hidden'
          const disabled = (el as HTMLButtonElement).disabled === true
          return visible && interactive && !disabled
        })
        if (ok) { landed = true; break }
      }
      expect(landed, 'Tab reaches a visible focusable element after undo').toBe(true)

      // 3. The Resetar filtros trigger must be reachable via keyboard
      //    (snapshot restored ?run=, so it is enabled again).
      await cdp.resetTrigger.focus()
      await expect(cdp.resetTrigger).toBeFocused()
      await expect(cdp.resetTrigger).toBeEnabled()

      // 4. Pressing Enter on the focused trigger must open the reset modal —
      //    proves keyboard activation still flows end-to-end.
      await page.keyboard.press('Enter')
      await expect(cdp.resetDialog).toHaveAttribute('data-state', 'open', { timeout: 5_000 })
      // Esc closes it; the undo banner is no longer visible so the page-level
      // Esc handler must NOT swallow the close.
      await page.keyboard.press('Escape')
      await expect(cdp.resetDialog).toHaveCount(0, { timeout: 5_000 })
    })
  }
})
