import { test, expect } from '@playwright/test';

test.describe('PWA Offline Functionality', () => {
  test('should be available offline after initial load', async ({ page, context }) => {
    // 1. Initial load to install service worker
    await page.goto('/');
    
    // Wait for service worker to be ready
    const swReady = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return !!registration;
    });
    expect(swReady).toBe(true);

    // 2. Go offline
    await context.setOffline(true);

    // 3. Reload and check if content is still there
    await page.reload();
    
    // Check for a known element that should be cached
    const title = await page.title();
    expect(title).toContain('Kubo');
    
    // 4. Try navigating to another main route while offline
    await page.goto('/auth');
    const authHeading = page.getByRole('heading', { name: /entrar/i }).or(page.getByRole('heading', { name: /sign in/i }));
    // Depending on the app language, we check for presence
    expect(await authHeading.count()).toBeGreaterThan(0);
  });
});
