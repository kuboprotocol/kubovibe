import { test, expect } from '@playwright/test'
import { ConnectorDetailPage } from './helpers/connectorDetail.page'
import { waitForDialogState, expectActionable } from './helpers/waits'

/**
 * E2E: Undo shortcuts (Ctrl+Z on Linux/Win, Cmd+Z on macOS) must restore the
 * filter snapshot, hide the undo banner, re-apply the URL params, and emit
 * a `filters_reset_undone` analytics event with `source=shortcut`.
 *
 * Coverage:
 *  - Ctrl+Z restores snapshot + emits analytics (Linux/Win path)
 *  - Cmd+Z (Meta+Z) restores snapshot + emits analytics (macOS path)
 *  - Shortcut is a no-op when banner is not visible (no analytics, no nav)
 *  - Shortcut is suppressed while a modal owns focus (e.g. reset confirm)
 *  - Shortcut is suppressed when typing inside an editable field
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = 'feedface1234567890abcdef1234567890abcdef'

test.describe('ConnectorDetailPage — Undo shortcuts (Ctrl/Cmd+Z)', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('Ctrl+Z restores snapshot, hides banner, and emits analytics', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')
    const sha = `${RUN_SHA.slice(0, 8)}ctrlz001`

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(sha)
    await cdp.triggerUndoBanner()

    // After reset, ?run= should be gone from the URL.
    await page.waitForURL((u) => u.searchParams.get('run') === null, { timeout: 5_000 })

    const undoneP = cdp.waitForEvent('filters_reset_undone')
    await page.keyboard.press('Control+z')

    // Analytics body must carry source=shortcut.
    const req = await undoneP
    expect(req.postData() ?? '').toContain('"source":"shortcut"')

    // Banner gone, snapshot reapplied to URL.
    await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
    await page.waitForURL((u) => u.searchParams.get('run') === sha, { timeout: 5_000 })
  })

  test('Cmd+Z (Meta+Z) restores snapshot and emits analytics — macOS path', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')
    const sha = `${RUN_SHA.slice(0, 8)}cmdz0001`

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(sha)
    await cdp.triggerUndoBanner()
    await page.waitForURL((u) => u.searchParams.get('run') === null, { timeout: 5_000 })

    const undoneP = cdp.waitForEvent('filters_reset_undone')
    await page.keyboard.press('Meta+z')

    const req = await undoneP
    expect(req.postData() ?? '').toContain('"source":"shortcut"')

    await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })
    await page.waitForURL((u) => u.searchParams.get('run') === sha, { timeout: 5_000 })
  })

  test('Ctrl+Z is a no-op when no undo banner is visible (no analytics, no nav)', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')
    const sha = `${RUN_SHA.slice(0, 8)}noopz001`

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(sha)
    await expect(cdp.banner).toHaveCount(0)

    // Capture any undone events that fire during the no-op window.
    const undoneEvents: string[] = []
    const onRequest = (req: import('@playwright/test').Request) => {
      if (req.method() !== 'POST') return
      if (!/\/rest\/v1\/connector_activity_logs/.test(req.url())) return
      const body = req.postData() ?? ''
      if (body.includes('"event_type":"filters_reset_undone"')) undoneEvents.push(body)
    }
    page.on('request', onRequest)

    await page.keyboard.press('Control+z')
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(500)

    expect(undoneEvents.length, 'no undone events without an active banner').toBe(0)
    // URL must remain on the original ?run=.
    expect(new URL(page.url()).searchParams.get('run')).toBe(sha)
    page.off('request', onRequest)
  })

  test('Ctrl+Z is suppressed while reset-confirm modal owns focus', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')
    const sha = `${RUN_SHA.slice(0, 8)}modalz01`

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(sha)
    await cdp.triggerUndoBanner()

    // Open the reset confirm modal so it captures focus.
    await cdp.openResetCycle(`${RUN_SHA.slice(0, 8)}modalz02`)

    const undoneEvents: string[] = []
    const onRequest = (req: import('@playwright/test').Request) => {
      if (req.method() !== 'POST') return
      if (!/\/rest\/v1\/connector_activity_logs/.test(req.url())) return
      const body = req.postData() ?? ''
      if (body.includes('"event_type":"filters_reset_undone"')) undoneEvents.push(body)
    }
    page.on('request', onRequest)

    await page.keyboard.press('Control+z')
    await page.waitForTimeout(400)

    // Modal still open, banner still present, no undone analytics.
    await expect(cdp.resetDialog).toHaveAttribute('data-state', 'open')
    await expect(cdp.banner).toBeVisible()
    expect(undoneEvents.length, 'undo shortcut suppressed under modal').toBe(0)

    // Cancel modal and confirm shortcut is functional again afterwards.
    await cdp.resetCancel.click()
    await waitForDialogState(cdp.resetDialog, 'closed')
    await expectActionable(cdp.renew, 'Renovar (after modal cancel)')

    const undoneP = cdp.waitForEvent('filters_reset_undone')
    await page.keyboard.press('Control+z')
    await undoneP
    await expect(cdp.banner).toHaveCount(0, { timeout: 5_000 })

    page.off('request', onRequest)
  })

  test('Ctrl+Z inside an editable field does not trigger undo', async ({ page }) => {
    const cdp = new ConnectorDetailPage(page, 'github')
    const sha = `${RUN_SHA.slice(0, 8)}editz001`

    await cdp.login(TEST_EMAIL!, TEST_PASSWORD!)
    await cdp.openWithRun(sha)
    await cdp.triggerUndoBanner()

    await page.evaluate(() => {
      const i = document.createElement('input')
      i.id = '__df_undo_probe__'
      i.type = 'text'
      document.body.appendChild(i)
      i.focus()
    })
    await expect(page.locator('#__df_undo_probe__')).toBeFocused()

    const undoneEvents: string[] = []
    const onRequest = (req: import('@playwright/test').Request) => {
      if (req.method() !== 'POST') return
      if (!/\/rest\/v1\/connector_activity_logs/.test(req.url())) return
      const body = req.postData() ?? ''
      if (body.includes('"event_type":"filters_reset_undone"')) undoneEvents.push(body)
    }
    page.on('request', onRequest)

    await page.keyboard.press('Control+z')
    await page.waitForTimeout(400)

    expect(undoneEvents.length, 'undo skipped inside editable field').toBe(0)
    await expect(cdp.banner).toBeVisible()
    page.off('request', onRequest)

    await page.evaluate(() => document.getElementById('__df_undo_probe__')?.remove())
  })
})
