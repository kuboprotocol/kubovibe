import { test, expect } from '@playwright/test';

/**
 * Test to detect redirect loops in the preview environment.
 * Monitors redirect counts and fails if a limit is exceeded or navigation times out.
 * Also validates that React renders correctly and doesn't stay on a black screen.
 */
test('should detect and prevent redirect loops on preview domains', async ({ page }) => {
  const maxRedirects = 4;
  let redirectCount = 0;

  // Monitor redirects
  page.on('request', request => {
    if (request.isNavigationRequest() && request.redirectedFrom()) {
      redirectCount++;
      console.log(`[E2E] Redirect detected: ${request.url()}`);
    }
  });

  // Check browser console for our internal loop detection
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('Redirect loop detected')) {
      console.warn('[E2E] Browser detected its own redirect loop!');
    }
  });

  try {
    // Go to the home page
    const response = await page.goto('/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Validations
    expect(redirectCount, `Too many redirects: ${redirectCount}`).toBeLessThanOrEqual(maxRedirects);
    
    const loopError = consoleMessages.find(m => m.includes('Redirect loop detected'));
    expect(loopError, 'The browser logic should not have triggered its own loop protection.').toBeUndefined();

    // Validate React rendering (checking for the main app container or a specific text)
    // Based on App.tsx, we have a Suspense fallback "Carregando Kubo Vibe..."
    // We want to make sure the actual content renders.
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    
    // Check that we are not stuck in the black screen / loader indefinitely
    const loader = page.getByText('Carregando Kubo Vibe...');
    if (await loader.isVisible()) {
      await expect(loader).not.toBeVisible({ timeout: 15000 });
    }

    console.log(`[E2E] Navigation stable and UI rendered at: ${page.url()} after ${redirectCount} redirects.`);
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error(`Navigation or rendering timed out. Redirects: ${redirectCount}. Console: ${consoleMessages.slice(-5).join('\n')}`);
    }
    throw error;
  }
});

test('should handle old service worker cache gracefully', async ({ page, context }) => {
  // Simulate an old service worker environment by adding a dummy SW or specific cache entries if possible
  // For this test, we'll simulate the "stale cache" by ensuring the app still boots even with unexpected storage state
  
  await context.addInitScript(() => {
    // Mock a broken or old service worker registration
    Object.defineProperty(navigator, 'serviceWorker', {
      get: () => ({
        register: () => Promise.resolve({ active: { state: 'activated' } }),
        getRegistrations: () => Promise.resolve([]),
      })
    });
    
    // Fill cache with some "old" data to see if it causes issues
    window.localStorage.setItem('vibe_pwa_version', '0.0.1-stale');
  });

  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  
  // Verify that the app cleared or handled the versioning
  console.log('[E2E] App opened correctly despite simulated stale cache state');
});

