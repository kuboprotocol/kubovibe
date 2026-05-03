import { test, expect } from '@playwright/test'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { trackConnectorEvents } from './helpers/analytics'
import { waitForDialogState } from './helpers/waits'

/**
 * E2E: After Ctrl+Z / Cmd+Z restores the snapshot, the user must be able to
 * re-open the "Resetar filtros" modal — both via click and via keyboard —
 * and dismiss it via the Cancelar button OR Escape, with focus returning to
 * the original trigger every time. Also audits the modal's a11y contract
 * and validates that closing via Escape never emits stray analytics.
 *
 * Coverage:
 *  1. Ctrl+Z + Cmd+Z paths (parameterized)
 *  2. Open by CLICK, close by Cancelar → focus returns to trigger
 *  3. Open by KEYBOARD (Enter), close by Escape → focus returns + no
 *     `filters_reset_*` analytics emitted (modal isn't instrumented)
 *  4. A11y audit: role=alertdialog, accessible name + description,
 *     focus moves into the modal on open, focus trap (Tab cycles),
 *     `aria-modal=true`, no orphan focus on close.
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'

test.describe('ConnectorDetailPage — Reset modal focus + a11y after undo', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  for (const combo of ['Control+z', 'Meta+z'] as const) {
    test(`Cancel button restores focus to trigger after ${combo} (open via click)`, async ({ page }) => {
      const cdp = new ConnectorDetailPage(page, 'github')
      const sha = `${RUN_SHA.slice(0, 8)}${combo === 'Meta+z' ? 'm' : 'c'}clk`

      await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
      await cdp.openWithRun(sha)
      await cdp.triggerUndoBanner()
      await page.waitForURL((u) => u.searchParams.get('run') === null, { timeout: 5_000 })

      // Undo via shortcut.
      await page.keyboard.press(combo)
      await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
      await page.waitForURL((u) => u.searchParams.get('run') === sha, { timeout: 5_000 })

      // Tag trigger to prove identity post mount/unmount cycle.
      await cdp.resetTrigger.evaluate((el) => el.setAttribute('data-df-origin', 'reset-trigger'))

      // ---- Open by CLICK ----
      // Note: a click moves focus to the button on most engines; we still
      // explicitly focus to make the assertion deterministic across browsers.
      await cdp.resetTrigger.focus()
      await cdp.resetTrigger.click()
      await waitForDialogState(cdp.resetDialog, 'open')

      // A11y audit while open.
      const a11y = await page.evaluate(() => {
        const dlg = document.querySelector('[data-testid="reset-filters-dialog"]') as HTMLElement | null
        if (!dlg) return null
        const labelledby = dlg.getAttribute('aria-labelledby')
        const describedby = dlg.getAttribute('aria-describedby')
        const role = dlg.getAttribute('role')
        const ariaModal = dlg.getAttribute('aria-modal')
        const title = labelledby ? document.getElementById(labelledby)?.textContent?.trim() : null
        const desc = describedby ? document.getElementById(describedby)?.textContent?.trim() : null
        const active = document.activeElement
        const focusInside = !!active && dlg.contains(active)
        return { role, ariaModal, title, desc, focusInside, hasLabelledBy: !!labelledby, hasDescribedBy: !!describedby }
      })
      expect(a11y, 'reset dialog mounted').not.toBeNull()
      expect(a11y!.role, 'role=alertdialog').toBe('alertdialog')
      expect(a11y!.ariaModal, 'aria-modal=true').toBe('true')
      expect(a11y!.hasLabelledBy, 'aria-labelledby present').toBe(true)
      expect(a11y!.hasDescribedBy, 'aria-describedby present').toBe(true)
      expect(a11y!.title?.length ?? 0, 'accessible name non-empty').toBeGreaterThan(0)
      expect(a11y!.desc?.length ?? 0, 'accessible description non-empty').toBeGreaterThan(0)
      expect(a11y!.focusInside, 'focus moved inside dialog on open').toBe(true)

      // Focus trap: Tab repeatedly should never escape the dialog.
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab')
        const stillInside = await page.evaluate(() => {
          const dlg = document.querySelector('[data-testid="reset-filters-dialog"]')
          const el = document.activeElement
          return !!dlg && !!el && dlg.contains(el)
        })
        expect(stillInside, `Tab #${i + 1} stays trapped in dialog`).toBe(true)
      }

      // ---- Close via Cancelar button ----
      await cdp.resetCancel.click()
      await waitForDialogState(cdp.resetDialog, 'closed')

      // Focus must return to original trigger.
      const focusBack = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return {
          isBody: el === document.body,
          inDom: !!el && document.contains(el),
          isOriginTrigger: el?.getAttribute('data-df-origin') === 'reset-trigger',
        }
      })
      expect(focusBack.inDom, 'focus owner still in DOM').toBe(true)
      expect(focusBack.isBody, 'focus did not collapse to <body>').toBe(false)
      expect(focusBack.isOriginTrigger, 'focus returned to original trigger').toBe(true)
      await expect(cdp.resetTrigger).toBeFocused()
    })

    test(`Escape closes modal, returns focus, and emits no reset analytics after ${combo} (open via keyboard)`, async ({ page }) => {
      const cdp = new ConnectorDetailPage(page, 'github')
      const sha = `${RUN_SHA.slice(0, 8)}${combo === 'Meta+z' ? 'm' : 'c'}esc`

      await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
      await cdp.openWithRun(sha)
      await cdp.triggerUndoBanner()
      await page.waitForURL((u) => u.searchParams.get('run') === null, { timeout: 5_000 })

      await page.keyboard.press(combo)
      await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
      await page.waitForURL((u) => u.searchParams.get('run') === sha, { timeout: 5_000 })

      await cdp.resetTrigger.evaluate((el) => el.setAttribute('data-df-origin', 'reset-trigger'))
      await cdp.resetTrigger.focus()
      await expect(cdp.resetTrigger).toBeFocused()

      // ---- Open by KEYBOARD (Enter) ----
      // Track analytics across the whole open/close cycle. The reset modal
      // itself is intentionally NOT instrumented — closing via Escape must
      // NOT emit `filters_reset_*` events (would be a regression).
      const counter = trackConnectorEvents(page, [
        'filters_reset_undone',
        'filters_undo_banner_dismissed',
        'filters_undo_dismiss_modal_opened',
        'filters_undo_dismiss_modal_cancelled',
        'filters_undo_dismiss_modal_confirmed',
      ])

      await page.keyboard.press('Enter')
      await waitForDialogState(cdp.resetDialog, 'open')

      // ---- Close via Escape ----
      await page.keyboard.press('Escape')
      await waitForDialogState(cdp.resetDialog, 'closed')

      // Settle for any async analytics inserts.
      await page.waitForTimeout(500)
      expect(counter.count('filters_reset_undone'), 'no undone analytics on Esc').toBe(0)
      expect(counter.count('filters_undo_banner_dismissed'), 'no banner_dismissed on Esc').toBe(0)
      expect(counter.count('filters_undo_dismiss_modal_opened'), 'no dismiss_modal_opened').toBe(0)
      expect(counter.count('filters_undo_dismiss_modal_cancelled'), 'no dismiss_modal_cancelled').toBe(0)
      expect(counter.count('filters_undo_dismiss_modal_confirmed'), 'no dismiss_modal_confirmed').toBe(0)
      expect(counter.total(), 'zero analytics across Esc-close cycle').toBe(0)
      counter.dispose()

      // Focus return assertion.
      const focusBack = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return {
          isBody: el === document.body,
          inDom: !!el && document.contains(el),
          isOriginTrigger: el?.getAttribute('data-df-origin') === 'reset-trigger',
        }
      })
      expect(focusBack.inDom, 'focus owner still in DOM').toBe(true)
      expect(focusBack.isBody, 'focus did not collapse to <body>').toBe(false)
      expect(focusBack.isOriginTrigger, 'focus returned to original trigger after Esc').toBe(true)
      await expect(cdp.resetTrigger).toBeFocused()

      // No focus trap residue: Tab advances away from the trigger normally.
      await page.keyboard.press('Tab')
      const movedAway = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return !!el && el !== document.body && el.getAttribute('data-df-origin') !== 'reset-trigger'
      })
      expect(movedAway, 'Tab advances past trigger after Esc (no trap residue)').toBe(true)
    })
  }
})
