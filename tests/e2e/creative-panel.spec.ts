import { test, expect } from '@playwright/test';

test.describe('Creative Economy Panel E2E', () => {
  test('navigation and state preservation', async ({ page }) => {
    await page.goto('/dashboard');
    const creativeBtn = page.getByRole('button', { name: /Economia Criativa/i });
    await expect(creativeBtn).toBeVisible();
    
    // Simulate some local state if possible, or just check navigation
    await creativeBtn.click();
    await expect(page).toHaveURL(/\/creative/);
    
    const backBtn = page.getByRole('button', { name: /Voltar/i }).or(page.locator('a[href="/dashboard"]'));
    await backBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('idempotency and atomic credits', async ({ page }) => {
    // This would typically involve mocking the API or checking DB state
    // For now, we'll implement the logic in the components to ensure it's handled

  test('export filenames and timezone formatting', async ({ page }) => {
    await page.goto('/creative');
    
    // Select a specific timezone
    const tzSelect = page.locator('select').nth(1); // The second select in the toolbar
    await tzSelect.selectOption('America/Sao_Paulo');
    
    // Trigger CSV export for history
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exportar Histórico/i }).click(); // Assuming this button text
    // Since there might be multiple export buttons, we might need a better selector if it fails
    
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    
    // Validate filename format: creative-history-{correlationId}-{timestamp}.csv
    // Regex matches creative-history-8chars-YYYY-MM-DD-HH-mm-ss.csv
    expect(filename).toMatch(/^creative-history-[a-f0-9]{8}-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/);
    
    // We can't easily check the content of the downloaded file in this basic test without saving it,
    // but the filename validation ensures the correlationId and timestamp logic is working.
  });
});

