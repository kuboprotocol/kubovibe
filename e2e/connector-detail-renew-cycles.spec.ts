import { test, expect } from '@playwright/test'

/**
 * E2E: ConnectorDetailPage — repeatedly opening/closing the Reset confirmation
 * dialog must keep the undo banner's "Renovar" button visible and clickable
 * across every cycle.
 *
 * Flow:
 *   1. Log in.
 *   2. Visit /connectors/github?run=<sha> so "Resetar filtros" is enabled.
 *   3. Click "Resetar filtros" → confirm → undo banner appears with "Renovar".
 *   4. Loop N cycles: open Reset dialog, assert Renovar still visible+enabled,
 *      cancel dialog, assert Renovar still visible+enabled+clickable.
 *   5. On the final cycle, actually click Renovar and assert the counter
 *      snaps back to the full 15s window.
 *
 * Requires TEST_EMAIL / TEST_PASSWORD env vars (a confirmed Supabase user).
 */

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const RUN_SHA = 'abcdef1234567890abcdef1234567890abcdef12'
const CYCLES = 5

test.describe('ConnectorDetailPage — Renovar stays clickable across reset-dialog cycles', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'TEST_EMAIL and TEST_PASSWORD must be set to run this test',
  )

  test('Renovar button remains visible and clickable across repeated dialog cycles', async ({
    page,
    context,
  }) => {
    await context.clearCookies()

    // 1. Log in.
    await page.goto('/auth')
    await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
    await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
    await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 })

    // 2. Open the GitHub connector with a `?run=` filter so reset is enabled.
    await page.goto(`/connectors/github?run=${RUN_SHA}`)
    await page.waitForURL('**/connectors/github**', { timeout: 15_000 })

    // 3. Trigger the undo banner: click "Resetar filtros", then confirm.
    const resetTrigger = page.getByRole('button', { name: /resetar filtros/i })
    await expect(resetTrigger).toBeVisible({ timeout: 15_000 })
    await resetTrigger.click()

    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: /^resetar$/i }).click()

    const banner = page.getByTestId('undo-banner')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const renew = page.getByTestId('undo-renew-button')
    await expect(renew).toBeVisible()
    await expect(renew).toBeEnabled()

    // 4. Repeatedly open and close the Reset dialog. The trigger button is
    //    no longer visible (filters are already cleared), so we re-introduce
    //    a `?run=` param via the URL each cycle to make "Resetar filtros"
    //    available again — without unmounting the page.
    for (let i = 0; i < CYCLES; i++) {
      // Re-add a `?run=` filter so the Reset trigger reappears.
      // Preserve the existing path; client-side router picks up the change.
      await page.evaluate((sha) => {
        const url = new URL(window.location.href)
        url.searchParams.set('run', sha)
        window.history.pushState({}, '', url.toString())
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, `${RUN_SHA.slice(0, 8)}cycle${i.toString().padStart(2, '0')}`)

      const trigger = page.getByRole('button', { name: /resetar filtros/i })
      await expect(trigger, `cycle ${i}: trigger visible`).toBeVisible({ timeout: 5_000 })

      // Open dialog.
      await trigger.click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog, `cycle ${i}: dialog open`).toBeVisible()

      // While dialog is open, Renovar must still be visible & enabled.
      await expect(renew, `cycle ${i}: Renovar visible while dialog open`).toBeVisible()
      await expect(renew, `cycle ${i}: Renovar enabled while dialog open`).toBeEnabled()

      // Close dialog via Cancel.
      await dialog.getByRole('button', { name: /^cancelar$/i }).click()
      await expect(dialog, `cycle ${i}: dialog closed`).toBeHidden()

      // After closing, Renovar must still be visible, enabled, and clickable.
      await expect(renew, `cycle ${i}: Renovar visible after close`).toBeVisible()
      await expect(renew, `cycle ${i}: Renovar enabled after close`).toBeEnabled()
    }

    // 5. Final assertion: clicking Renovar resets the counter to the full window.
    await renew.click()
    const counter = page.getByTestId('undo-counter')
    await expect(counter).toBeVisible()
    // Counter shows "15s" right after a renew (modal is closed → live deadline).
    await expect(counter).toHaveText(/15s/, { timeout: 2_000 })
  })
})
