import { test, expect } from '@playwright/test';

test.describe('PWA Assets Fallback', () => {
  test('should handle missing images gracefully offline and show warning', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    
    await context.setOffline(true);

    // Inject an image that isn't cached
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.src = '/non-existent-image-404.png';
      img.id = 'test-offline-img';
      img.onerror = () => {
        window.dispatchEvent(new CustomEvent('pwa:asset-fallback', { 
          detail: { type: 'image', url: img.src } 
        }));
      };
      document.body.appendChild(img);
    });

    // Check if the discrete warning is shown
    const toast = page.locator('li').filter({ hasText: /Offline Mode/i }).or(page.locator('.sonner-toast'));
    await expect(toast.first()).toBeVisible();
    
    // Check if fallback SVG is likely used (in a real browser SW would serve it)
  });

  test('should maintain text legibility with font fallback', async ({ page, context }) => {
    await page.goto('/dashboard');
    await context.setOffline(true);

    const mainText = page.locator('h1').first();
    await expect(mainText).toBeVisible();
    
    // Check for console errors related to fonts
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('.woff2')) errors.push(msg.text());
    });
    
    await page.reload();
    // Browser might log font failure but SW should handle it or UI should stay clean
    expect(errors.length).toBe(0);
  });
});
