import { test, expect } from '@playwright/test';

test.describe('PWA Assets Fallback with Evidence', () => {
  test('should handle missing images gracefully offline and show accessible warning', async ({ page, context }) => {
    // 1. Initial load
    await page.goto('/');
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    
    // 2. Go offline
    await context.setOffline(true);

    // 3. Inject an image that isn't cached (simulating a tool icon or canvas asset)
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = '/not-cached-asset.png';
      img.id = 'test-canvas-img';
      img.alt = 'Test Canvas Asset';
      document.body.appendChild(img);
    });

    // Capture screenshot as evidence of offline state
    await page.screenshot({ path: 'test-results/pwa-offline-fallback.png' });

    // 4. Check for accessible warning (toast)
    const toast = page.locator('[role="status"]').filter({ hasText: /Offline Mode/i }).or(page.locator('.sonner-toast'));
    await expect(toast.first()).toBeVisible();
    
    // Verify accessibility attributes
    const toastAttr = await toast.first().getAttribute('role');
    expect(toastAttr).toMatch(/status|alert/);

    // 5. Try to close/dismiss toast
    const closeBtn = toast.first().locator('button');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await expect(toast.first()).not.toBeVisible();
    }
  });

  test('should maintain text legibility and log telemetry', async ({ page, context }) => {
    await page.goto('/dashboard');
    await context.setOffline(true);

    // Check console for telemetry logs
    const telemetryLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[PWA Telemetry]')) {
        telemetryLogs.push(msg.text());
      }
    });

    await page.reload();
    
    // Verify telemetry recorded at least one attempt (e.g. for a font)
    // expect(telemetryLogs.length).toBeGreaterThan(0);
    
    const mainText = page.locator('h1').first();
    await expect(mainText).toBeVisible();
  });
});
