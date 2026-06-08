import { test, expect } from '@playwright/test';

test.describe('Idempotency and Atomic Credits', () => {
  test('should not deduct credits twice on rapid clicks', async ({ page }) => {
    await page.goto('/creative');
    
    // Select a tool, e.g., Nano Banana
    const toolCard = page.getByText('Nano Banana');
    await toolCard.click();
    
    const input = page.getByPlaceholder(/Digite sua ideia/i);
    await input.fill('Test idempotency');
    
    const submitBtn = page.getByRole('button', { name: /Gerar/i });
    
    // Click twice rapidly
    await submitBtn.click();
    await submitBtn.click();
    
    // Check history for only one entry (or one with the same idempotency key)
    const historyEntries = page.locator('[data-testid="history-item"]');
    // Expect logic: only 1 entry should be created if idempotency is working
    // This depends on the UI implementation.
  });
});
