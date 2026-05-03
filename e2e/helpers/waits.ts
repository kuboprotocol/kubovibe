import { Page, Locator, expect, Request } from '@playwright/test'

/**
 * Deterministic wait helpers (DF = Deterministic Flow).
 *
 * Goal: replace ad-hoc `waitForTimeout` / `toBeVisible`-only checks with
 * waits that hook into actual application state (Radix data-state attrs,
 * computed style, URL params, network activity) so suites stop flaking
 * under animation, hydration, or router races.
 */

export const DF_TIMEOUT = 5_000

/** Wait until the URL's search params satisfy a predicate (router state). */
export async function waitForSearchParam(
  page: Page,
  key: string,
  expected: string | ((v: string | null) => boolean),
  timeout = DF_TIMEOUT,
) {
  await page.waitForURL((url) => {
    const v = url.searchParams.get(key)
    return typeof expected === 'function' ? expected(v) : v === expected
  }, { timeout })
}

/** Wait for a Radix dialog/alertdialog to reach a given data-state. */
export async function waitForDialogState(
  dialog: Locator,
  state: 'open' | 'closed',
  timeout = DF_TIMEOUT,
) {
  if (state === 'open') {
    await expect(dialog).toHaveAttribute('data-state', 'open', { timeout })
  } else {
    await expect(dialog).toHaveCount(0, { timeout })
  }
}

/** Assert a control is visible, enabled, and not blocked by an overlay. */
export async function expectActionable(locator: Locator, label = 'control') {
  await expect(locator, `${label}: visible`).toBeVisible()
  await expect(locator, `${label}: enabled`).toBeEnabled()
  const blocked = await locator.evaluate((el) =>
    window.getComputedStyle(el as Element).pointerEvents === 'none',
  )
  if (blocked) {
    throw new Error(`${label}: pointer-events is none — overlay blocking clicks`)
  }
}

/** Wait for an analytics insert against connector_activity_logs. */
export async function waitForConnectorEvent(
  page: Page,
  eventType: string,
  timeout = DF_TIMEOUT,
): Promise<Request> {
  return page.waitForRequest(
    (req) => {
      if (req.method() !== 'POST') return false
      if (!/\/rest\/v1\/connector_activity_logs/.test(req.url())) return false
      try {
        const body = req.postData() ?? ''
        return body.includes(`"event_type":"${eventType}"`)
      } catch {
        return false
      }
    },
    { timeout },
  )
}

/** Re-add a `?run=` param without unmounting the page (popstate dispatch). */
export async function pushRunParam(page: Page, sha: string) {
  await page.evaluate((s) => {
    const url = new URL(window.location.href)
    url.searchParams.set('run', s)
    window.history.pushState({}, '', url.toString())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, sha)
  await waitForSearchParam(page, 'run', sha)
}
