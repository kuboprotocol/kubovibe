import { test, expect } from '@playwright/test'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { trackConnectorEvents } from './helpers/analytics'
import { waitForDialogState, expectActionable } from './helpers/waits'

/**
 * E2E: Dispensar button → modal → Cancelar.
 *  - Emits `filters_undo_dismiss_modal_opened` (source=button)
 *  - Emits `filters_undo_dismiss_modal_cancelled` (source=button)
 *  - Does NOT emit `_confirmed` or `filters_undo_banner_dismissed`
 *  - Banner stays mounted, counter resumes from "pausado" to live ticking
 *  - Renovar remains actionable and resets the counter to 15s
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = 'cancel00deadbeef00cafebabe00deadbeef0011'

test.describe('ConnectorDetailPage — Dispensar modal Cancel path', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('Cancelling the dismiss modal keeps banner + Renovar consistent and emits cancelled analytics', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(RUN_SHA)
    await cdp.triggerUndoBanner()

    const counter = trackConnectorEvents(page, [
      'filters_undo_dismiss_modal_opened',
      'filters_undo_dismiss_modal_cancelled',
      'filters_undo_dismiss_modal_confirmed',
      'filters_undo_banner_dismissed',
    ])

    // Open modal via the explicit Dispensar button.
    await expectActionable(cdp.dismiss, 'Dispensar button')
    await cdp.dismiss.click()
    await waitForDialogState(cdp.dismissDialog, 'open')
    const openedReq = await counter.waitFor('filters_undo_dismiss_modal_opened')
    expect(openedReq.postData() ?? '').toContain('"source":"button"')

    // Counter is paused while modal owns focus.
    await expect(cdp.banner).toBeVisible()
    await expect(cdp.counter).toContainText('pausado')

    // Cancel the dismissal — this is the path under test.
    await cdp.dismissCancel.click()
    const cancelledReq = await counter.waitFor('filters_undo_dismiss_modal_cancelled')
    expect(cancelledReq.postData() ?? '').toContain('"source":"button"')
    await waitForDialogState(cdp.dismissDialog, 'closed')

    // Negative analytics assertions: nothing was confirmed/dismissed.
    await page.waitForTimeout(400) // settle any stray inserts
    expect(counter.count('filters_undo_dismiss_modal_opened'), 'one opened event').toBe(1)
    expect(counter.count('filters_undo_dismiss_modal_cancelled'), 'one cancelled event').toBe(1)
    expect(counter.count('filters_undo_dismiss_modal_confirmed'), 'no confirmed events').toBe(0)
    expect(counter.count('filters_undo_banner_dismissed'), 'no banner_dismissed events').toBe(0)

    // Banner is still visible and resumed (no longer paused).
    await expect(cdp.banner).toBeVisible()
    await expect(cdp.counter).not.toContainText('pausado')
    // data-paused attribute reflects the resumed state.
    await expect(cdp.banner).toHaveAttribute('data-paused', 'false')

    // Renovar remains actionable and resets counter to the full window.
    await expectActionable(cdp.renew, 'Renovar (after Cancel)')
    await cdp.renew.click()
    await expect(cdp.counter).toHaveText(/15s/, { timeout: 2_000 })

    counter.dispose()
  })
})
