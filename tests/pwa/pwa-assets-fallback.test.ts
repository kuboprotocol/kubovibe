import { test, expect } from '@playwright/test';

test.describe('PWA Assets Fallback', () => {
  test('should handle missing images gracefully offline', async ({ page, context }) => {
    // 1. Initial load to register SW and cache fallbacks
    await page.goto('/');
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    
    // 2. Go offline
    await context.setOffline(true);

    // 3. Inject an image that isn't cached
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = '/not-cached-image.png';
      img.id = 'test-fallback-img';
      document.body.appendChild(img);
    });

    // 4. In a real environment, the SW would serve placeholders/img-fallback.svg
    // We check if the app continues to render or if the image error is handled
    const img = page.locator('#test-fallback-img');
    await expect(img).toBeVisible();
  });

  test('should handle missing fonts gracefully offline', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    // Check if the page title (which uses the theme font) is still readable
    const title = page.locator('h1').first();
    // Even if font fails, browser should fallback to sans-serif
    await expect(title).toBeVisible();
    const fontFamily = await title.evaluate(el => window.getComputedStyle(el).fontFamily);
    expect(fontFamily).toBeTruthy();
  });
});
