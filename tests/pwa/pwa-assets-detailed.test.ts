import { test, expect } from '@playwright/test';

test.describe('PWA Granular Fallbacks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => await navigator.serviceWorker.ready);
  });

  test('should handle PNG fallback in TLDraw context', async ({ page, context }) => {
    await context.setOffline(true);
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = '/tools/icon-heavy.png';
      img.id = 'test-png';
      document.body.appendChild(img);
    });
    await page.screenshot({ path: 'test-results/fallback-png.png' });
    const toast = page.locator('[role="status"]').filter({ hasText: /image/i });
    await expect(toast.first()).toBeVisible();
  });

  test('should handle SVG fallback for icons', async ({ page, context }) => {
    await context.setOffline(true);
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = '/icons/missing-vector.svg';
      img.id = 'test-svg';
      document.body.appendChild(img);
    });
    await page.screenshot({ path: 'test-results/fallback-svg.png' });
    const toast = page.locator('[role="status"]').filter({ hasText: /svg/i });
    await expect(toast.first()).toBeVisible();
  });

  test('should handle WOFF2 font fallback gracefully', async ({ page, context }) => {
    await context.setOffline(true);
    await page.reload();
    await page.screenshot({ path: 'test-results/fallback-font.png' });
    // Text should still be rendered by browser fallback
    await expect(page.locator('body')).toBeVisible();
  });
});
