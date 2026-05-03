import { test, expect } from '@playwright/test'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { trackConnectorEvents } from './helpers/analytics'
import { waitForDialogState, expectActionable } from './helpers/waits'

/**
 * E2E: Dispensar button → modal → Confirmar.
 *  - Emits `filters_undo_dismiss_modal_opened` (source=button)
 *  - Emits `filters_undo_dismiss_modal_confirmed` (source=button)
 *  - Emits `filters_undo_banner_dismissed` (reason=manual)
 *  - Does NOT emit `_cancelled`
 *  - Banner unmounts, counter disappears, Renovar gone
 *  - A fresh undo cycle still works end-to-end (banner returns, Renovar
 *    actionable, counter snaps to 15s)
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = 'c0nf1rm00112233445566778899aabbccddeeff0'

test.describe('ConnectorDetailPage — Dispensar modal Confirm path', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('Confirming the dismiss modal removes banner+Renovar and emits confirmed analytics', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(RUN_SHA)
    await cdp.triggerUndoBanner()

    const counter = trackConnectorEvents(page, [
      'filters_undo_dismiss_modal_opened',
      'filters_undo_dismiss_modal_confirmed',
      'filters_undo_dismiss_modal_cancelled',
      'filters_undo_banner_dismissed',
    ])

    // ---- Open modal via Dispensar button ----
    await expectActionable(cdp.dismiss, 'Dispensar button')
    await cdp.dismiss.click()
    await waitForDialogState(cdp.dismissDialog, 'open')
    const openedReq = await counter.waitFor('filters_undo_dismiss_modal_opened')
    expect(openedReq.postData() ?? '').toContain('"source":"button"')

    // Banner mounted but paused while modal owns focus.
    await expect(cdp.banner).toBeVisible()
    await expect(cdp.banner).toHaveAttribute('data-paused', 'true')
    await expect(cdp.counter).toContainText('pausado')

    // ---- Confirm dismissal ----
    await cdp.dismissConfirmBtn.click()
    const confirmedReq = await counter.waitFor('filters_undo_dismiss_modal_confirmed')
    expect(confirmedReq.postData() ?? '').toContain('"source":"button"')
    const dismissedReq = await counter.waitFor('filters_undo_banner_dismissed')
    expect(dismissedReq.postData() ?? '').toContain('"reason":"manual"')

    // Modal + banner both fully unmounted.
    await waitForDialogState(cdp.dismissDialog, 'closed')
    await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
    await expect(cdp.renew).toHaveCount(0)
    await expect(cdp.counter).toHaveCount(0)

    // Settle and verify negative analytics.
    await page.waitForTimeout(400)
    expect(counter.count('filters_undo_dismiss_modal_opened'), 'one opened event').toBe(1)
    expect(counter.count('filters_undo_dismiss_modal_confirmed'), 'one confirmed event').toBe(1)
    expect(counter.count('filters_undo_banner_dismissed'), 'one banner_dismissed event').toBe(1)
    expect(counter.count('filters_undo_dismiss_modal_cancelled'), 'no cancel event on confirm path').toBe(0)

    counter.dispose()

    // ---- Sanity: a fresh undo cycle still works end-to-end ----
    await cdp.openResetCycle(`${RUN_SHA.slice(0, 8)}confirm2`)
    await cdp.resetConfirm.click()
    await waitForDialogState(cdp.resetDialog, 'closed')
    await expect(cdp.banner).toBeVisible({ timeout: 10_000 })
    await expect(cdp.banner).toHaveAttribute('data-paused', 'false')
    await expectActionable(cdp.renew, 'Renovar (post-confirm-dismiss)')
    await cdp.renew.click()
    await expect(cdp.counter).toHaveText(/15s/, { timeout: 2_000 })
  })
})
