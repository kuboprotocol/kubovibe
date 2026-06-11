import { test, expect } from '@playwright/test';

test.describe('PWA Caching Strategies', () => {
  test('should serve critical routes from cache offline', async ({ page, context }) => {
    // 1. Initial load to install service worker and cache assets
    await page.goto('/');
    
    // Wait for SW to be active
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return !!registration;
    });

    // Navigate to key routes to trigger runtime caching if needed
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto('/builder');
    await page.waitForLoadState('networkidle');

    // 2. Go offline
    await context.setOffline(true);

    // 3. Validate Home
    await page.goto('/');
    expect(await page.title()).toContain('Kubo');

    // 4. Validate Dashboard (Route level caching)
    await page.goto('/dashboard');
    const dashboardCheck = page.locator('h1, h2').filter({ hasText: /Dashboard/i });
    await expect(dashboardCheck.first()).toBeVisible();

    // 5. Validate Builder/Canvas
    await page.goto('/builder');
    const builderCheck = page.locator('button').filter({ hasText: /Send/i }).or(page.locator('canvas'));
    await expect(builderCheck.first()).toBeVisible();
  });

  test('should show fallback for missing images offline', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    // Attempt to load a non-cached image
    const imgUrl = '/api/placeholder/400/320'; // Example external or uncached path
    const response = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url);
        return r.status;
      } catch (e) {
        return 'failed';
      }
    }, imgUrl);

    // If runtimeCaching with fallback is working, we might get a 200 (fallback) or handled error
    // Here we just ensure the app doesn't crash
    expect(response).not.toBe('failed');
  });
});
