import { test, expect } from '@playwright/test';

test.describe('Creative Economy Panel - State Preservation', () => {
  test('should preserve state when navigating back from /creative', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Simulate some "state" in dashboard, e.g., scroll position or an open tab
    await page.evaluate(() => window.scrollTo(0, 500));
    const initialScroll = await page.evaluate(() => window.scrollY);

    const creativeBtn = page.getByRole('button', { name: /Economia Criativa/i });
    await creativeBtn.click();
    await expect(page).toHaveURL(/\/creative/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);

    // Check if scroll position is roughly preserved (if the app supports it)
    const finalScroll = await page.evaluate(() => window.scrollY);
    expect(finalScroll).toBe(initialScroll);
  });
});
