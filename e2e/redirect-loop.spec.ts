import { test, expect } from '@playwright/test';

/**
 * Test to detect redirect loops in the preview environment.
 * Monitors redirect counts and fails if a limit is exceeded or navigation times out.
 */
test('should detect and prevent redirect loops', async ({ page }) => {
  const maxRedirects = 4;
  let redirectCount = 0;

  // Monitor redirects
  page.on('request', request => {
    if (request.isNavigationRequest() && request.redirectedFrom()) {
      redirectCount++;
      console.log(`[E2E] Redirect detected: ${request.url()}`);
    }
  });

  // Also check browser console for our internal loop detection
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
    if (msg.text().includes('Redirect loop detected')) {
      console.warn('[E2E] Browser detected its own redirect loop!');
    }
  });

  try {
    // Em ambientes de sandbox, usamos uma URL base que seja resolvida internamente.
    // O teste unitário já valida a lógica de redirecionamento para múltiplos domínios.
    const response = await page.goto('/', { 
      waitUntil: 'commit',
      timeout: 15000 
    });

    // Validations
    expect(redirectCount, `Too many redirects: ${redirectCount}`).toBeLessThanOrEqual(maxRedirects);
    
    const loopError = consoleMessages.find(m => m.includes('Redirect loop detected'));
    expect(loopError, 'The browser logic should not have triggered its own loop protection in a healthy environment.').toBeUndefined();

    console.log(`[E2E] Navigation stable at: ${page.url()} after ${redirectCount} redirects.`);
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error(`Navigation timed out - likely infinite redirect loop. Redirects so far: ${redirectCount}`);
    }
    throw error;
  }
});
