import { test, expect } from '@playwright/test'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { waitForDialogState } from './helpers/waits'

/**
 * E2E: After Ctrl+Z / Cmd+Z restores the filter snapshot (banner gone, ?run=
 * reapplied), opening the "Resetar filtros" modal via keyboard and closing it
 * with Escape must return focus to the trigger button (Radix focus-return
 * contract) — never to <body>, and never trapped on a hidden node.
 *
 * Coverage:
 *  - Trigger has focus before Enter opens the modal
 *  - Modal opens (data-state=open) and a focusable child receives focus
 *  - Escape closes the modal AND returns focus to the original trigger
 *  - document.activeElement is still in DOM (no orphan focus)
 *  - A subsequent Tab from the trigger advances normally (no trap)
 *  - Repeated open/close cycles never lose focus
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = '7f0c0537aabbccddeeff00112233445566778899'

test.describe('ConnectorDetailPage — Reset modal Escape returns focus after undo', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  for (const combo of ['Control+z', 'Meta+z'] as const) {
    test(`Escape on reset modal restores focus to trigger after ${combo}`, async ({ page }) => {
      const cdp = new ConnectorDetailPage(page, 'github')
      const sha = `${RUN_SHA.slice(0, 8)}${combo === 'Meta+z' ? 'meta' : 'ctrl'}`

      await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
      await cdp.openWithRun(sha)
      await cdp.triggerUndoBanner()
      await page.waitForURL((u) => u.searchParams.get('run') === null, { timeout: 5_000 })

      // Undo via shortcut → snapshot restored, banner gone.
      await page.keyboard.press(combo)
      await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
      await page.waitForURL((u) => u.searchParams.get('run') === sha, { timeout: 5_000 })

      // Tag the trigger so we can re-identify the original element after the
      // modal mount/unmount cycle (React may keep the same node, but we want
      // an unambiguous identity assertion).
      await cdp.resetTrigger.evaluate((el) => el.setAttribute('data-df-origin', 'reset-trigger'))
      await cdp.resetTrigger.focus()
      await expect(cdp.resetTrigger).toBeFocused()

      // Open via Enter — proves keyboard activation flows.
      await page.keyboard.press('Enter')
      await waitForDialogState(cdp.resetDialog, 'open')

      // Radix should auto-focus a child of the dialog (cancel/confirm), not
      // leave focus on the trigger and not collapse to <body>.
      const focusedInsideDialog = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return false
        const dlg = document.querySelector('[data-testid="reset-filters-dialog"]')
        return !!dlg && dlg.contains(el)
      })
      expect(focusedInsideDialog, 'focus moved into dialog on open').toBe(true)

      // Close with Escape.
      await page.keyboard.press('Escape')
      await waitForDialogState(cdp.resetDialog, 'closed')

      // ---- Focus return assertions ----
      const post = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return {
          isBody: el === document.body,
          inDom: !!el && document.contains(el),
          isOriginTrigger: el?.getAttribute('data-df-origin') === 'reset-trigger',
          tag: el?.tagName ?? null,
        }
      })
      expect(post.inDom, 'focus owner still in DOM').toBe(true)
      expect(post.isBody, 'focus did not collapse to <body>').toBe(false)
      expect(post.isOriginTrigger, 'focus returned to the original trigger').toBe(true)
      await expect(cdp.resetTrigger).toBeFocused()

      // No focus trap: Tab from the trigger must move focus elsewhere.
      await page.keyboard.press('Tab')
      const movedAway = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return !!el && el.getAttribute('data-df-origin') !== 'reset-trigger' && el !== document.body
      })
      expect(movedAway, 'Tab advances focus past the trigger (no trap)').toBe(true)

      // Re-cycle: re-focus trigger, open + Escape again, focus must return.
      await cdp.resetTrigger.focus()
      await expect(cdp.resetTrigger).toBeFocused()
      await page.keyboard.press('Enter')
      await waitForDialogState(cdp.resetDialog, 'open')
      await page.keyboard.press('Escape')
      await waitForDialogState(cdp.resetDialog, 'closed')
      await expect(cdp.resetTrigger).toBeFocused()
    })
  }
})
