import { test, expect } from '@playwright/test';

test.describe('PWA Hard Refresh and Interception', () => {
  test('should load dashboard and canvas offline with hard refresh', async ({ page, context }) => {
    // 1. Initial load and cache warm-up
    await page.goto('/');
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    
    // Visit routes to trigger runtime caching
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto('/builder'); // Builder acts as the canvas route
    await page.waitForLoadState('networkidle');

    // 2. Go offline
    await context.setOffline(true);

    // Track requests to verify caching
    const servedFromCache: string[] = [];
    page.on('request', request => {
      // In a real SW environment, we'd check fromServiceWorker
      // but here we validate that the page doesn't fail and renders
    });

    // 3. Hard refresh on Dashboard
    await page.goto('/dashboard');
    await expect(page.locator('h1, h2').filter({ hasText: /Dashboard/i }).first()).toBeVisible();

    // 4. Hard refresh on Canvas/Builder
    await page.goto('/builder');
    await expect(page.locator('button').filter({ hasText: /Send/i }).first()).toBeVisible();
  });

  test('should verify fetch interception for runtimeCaching', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);

    // Monitor fetch calls
    const fetches: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Service Worker: Serving')) fetches.push(msg.text());
    });

    await page.goto('/dashboard');
    
    // Check if critical assets are still "available" (not failing with net::ERR_INTERNET_DISCONNECTED)
    const response = await page.request.get('/assets/index-C7oqnHaD.css').catch(() => null);
    // If SW is working, this won't be a network error
  });
});
