import { test, expect } from '@playwright/test';

/**
 * Test to detect redirect loops in the preview environment.
 * A redirect loop usually manifests as a large number of redirects
 * or a timeout during navigation.
 */
test('should detect redirect loops during initial load', async ({ page }) => {
  const maxRedirects = 5;
  let redirectCount = 0;

  // Track all requests to count redirects
  page.on('request', request => {
    if (request.isNavigationRequest() && request.redirectedFrom()) {
      redirectCount++;
      console.log(`[Redirect Check] Redirect ${redirectCount}: ${request.url()}`);
    }
  });

  try {
    // Navigate to the root with a reasonable timeout
    const response = await page.goto('/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Check if the page loaded successfully (200 OK)
    expect(response?.status()).toBe(200);
    
    // Fail if we encountered too many redirects
    expect(redirectCount, `Detected possible redirect loop: ${redirectCount} redirects occurred.`).toBeLessThanOrEqual(maxRedirects);
    
    // Verify we are not on the canonical domain if we should be on preview
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('kubovibe.dev');
    
    console.log(`[Redirect Check] Page loaded successfully at ${finalUrl} with ${redirectCount} redirects.`);
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error(`Navigation timed out. Possible infinite redirect loop or server hang. Total redirects: ${redirectCount}`);
    }
    throw error;
  }
});
