import { test, expect } from '@playwright/test'
import { trackConnectorEvents } from './helpers/analytics'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { waitForDialogState, expectActionable } from './helpers/waits'

/**
 * E2E: Shift+Esc must dismiss the undo banner WITHOUT opening the
 * confirmation modal, and the "Renovar" button must remain functional
 * for the next undo cycle. Also covers:
 *   - analytics asserts (filters_undo_banner_dismissed, reason=shortcut-direct)
 *   - failure scenarios (Esc alone DOES open the modal; Shift+Esc inside
 *     an editable field is a no-op)
 *   - keyboard shortcuts integration with the dismissal lifecycle
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = 'beefcafe1234567890abcdef1234567890abcdef'

test.describe('ConnectorDetailPage — Shift+Esc dismisses banner without modal', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('Shift+Esc dismisses banner directly; Renovar still works on next cycle', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(RUN_SHA)
    await cdp.triggerUndoBanner()

    // Renovar must be actionable before we test the shortcut.
    await expectActionable(cdp.renew, 'Renovar (initial)')

    // ---- Analytics + behavior assertion for Shift+Esc ----
    const dismissedEventP = cdp.waitForEvent('filters_undo_banner_dismissed')

    await cdp.pressShiftEsc()

    // Banner must be gone.
    await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
    // Confirmation modal must NEVER have opened.
    await expect(cdp.dismissDialog).toHaveCount(0)

    // Analytics: dismissal should have been logged with reason=shortcut-direct.
    const dismissedReq = await dismissedEventP
    const body = dismissedReq.postData() ?? ''
    expect(body).toContain('"reason":"shortcut-direct"')
    // And no "modal_opened" event should have been emitted for this path.
    // (We can't easily prove a negative across the wire, but the dialog
    // count assertion above already guarantees it on the UI side.)

    // ---- Cycle 2: Renovar must still work after a fresh undo banner ----
    await cdp.openResetCycle(`${RUN_SHA.slice(0, 8)}cycle02`)
    // While the reset modal is open, Renovar from the previous cycle is gone
    // (banner was dismissed). Confirm reset to spawn a NEW banner.
    await cdp.resetConfirm.click()
    await waitForDialogState(cdp.resetDialog, 'closed')
    await expect(cdp.banner).toBeVisible({ timeout: 10_000 })
    await expectActionable(cdp.renew, 'Renovar (cycle 2)')

    await cdp.renew.click()
    // Counter snaps back to the full 15s window.
    await expect(cdp.counter).toHaveText(/15s/, { timeout: 2_000 })
  })

  test('Esc (no Shift) opens the confirmation modal — failure path for direct-dismiss', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(`${RUN_SHA.slice(0, 8)}escpath`)
    await cdp.triggerUndoBanner()

    const openedEventP = cdp.waitForEvent('filters_undo_dismiss_modal_opened')
    await cdp.pressEsc()
    await waitForDialogState(cdp.dismissDialog, 'open')
    const openedReq = await openedEventP
    expect(openedReq.postData() ?? '').toContain('"source":"esc"')

    // Banner is still in the DOM (just paused) — Renovar lives behind the
    // overlay but must not have been removed.
    await expect(cdp.banner).toBeVisible()
    await expect(cdp.counter).toContainText('pausado')

    // Cancel the modal — analytics should fire the "cancelled" phase.
    const cancelledP = cdp.waitForEvent('filters_undo_dismiss_modal_cancelled')
    await cdp.dismissCancel.click()
    await waitForDialogState(cdp.dismissDialog, 'closed')
    await cancelledP

    // Renovar must remain actionable after closing the modal.
    await expectActionable(cdp.renew, 'Renovar (after Esc cancel)')
  })

  test('Shift+Esc inside an editable field is a no-op (does not dismiss)', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(`${RUN_SHA.slice(0, 8)}edit`)
    await cdp.triggerUndoBanner()

    // Inject a temporary input, focus it, then fire the shortcut from inside.
    await page.evaluate(() => {
      const i = document.createElement('input')
      i.id = '__df_test_input__'
      i.type = 'text'
      document.body.appendChild(i)
      i.focus()
    })
    const probe = page.locator('#__df_test_input__')
    await expect(probe).toBeFocused()

    await page.keyboard.press('Shift+Escape')

    // Banner must remain — handler skips editable targets.
    await expect(cdp.banner).toBeVisible()
    await expect(cdp.dismissDialog).toHaveCount(0)
    await expectActionable(cdp.renew, 'Renovar (after no-op shortcut)')

    // Cleanup probe to keep the DOM clean for any follow-up assertions.
    await page.evaluate(() => document.getElementById('__df_test_input__')?.remove())
  })

  test('Repeated Shift+Esc after dismissal is idempotent — no duplicate analytics, Renovar still works on next cycle', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(`${RUN_SHA.slice(0, 8)}idemp`)
    await cdp.triggerUndoBanner()

    // Count every dismissal event emitted to the network — the second
    // Shift+Esc must NOT add to this count once the banner is gone.
    const dismissEvents: string[] = []
    const onRequest = (req: import('@playwright/test').Request) => {
      if (req.method() !== 'POST') return
      if (!/\/rest\/v1\/connector_activity_logs/.test(req.url())) return
      const body = req.postData() ?? ''
      if (body.includes('"event_type":"filters_undo_banner_dismissed"')) {
        dismissEvents.push(body)
      }
    }
    page.on('request', onRequest)

    // 1st Shift+Esc → dismiss + log exactly one event.
    const firstDismissP = cdp.waitForEvent('filters_undo_banner_dismissed')
    await cdp.pressShiftEsc()
    await firstDismissP
    await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
    expect(dismissEvents.length, 'exactly one dismiss event after first Shift+Esc').toBe(1)

    // 2nd & 3rd Shift+Esc → must be no-ops: no banner, no modal, no events.
    await cdp.pressShiftEsc()
    await cdp.pressShiftEsc()
    // Settle: give any stray inserts a window to land before asserting.
    await page.waitForTimeout(500)

    expect(dismissEvents.length, 'no duplicate dismiss events after repeats').toBe(1)
    await expect(cdp.banner).toHaveCount(0)
    await expect(cdp.dismissDialog).toHaveCount(0)

    page.off('request', onRequest)

    // Spawn a fresh banner via a new reset cycle and confirm Renovar still
    // works end-to-end (counter snaps to 15s).
    await cdp.openResetCycle(`${RUN_SHA.slice(0, 8)}idemp02`)
    await cdp.resetConfirm.click()
    await waitForDialogState(cdp.resetDialog, 'closed')
    await expect(cdp.banner).toBeVisible({ timeout: 10_000 })
    await expectActionable(cdp.renew, 'Renovar (post-idempotent-dismiss)')
    await cdp.renew.click()
    await expect(cdp.counter).toHaveText(/15s/, { timeout: 2_000 })
  })
})
