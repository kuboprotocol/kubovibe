import { test, expect } from '@playwright/test';

test.describe('Orchestrator Deep Linking and Search', () => {
  test('should open specific job and event via URL parameters', async ({ page }) => {
    // We'll use a known ID format or wait for data to load
    await page.goto('/orchestrator');
    
    // Wait for jobs to load
    await page.waitForSelector('table tbody tr');
    
    // Get the first job ID
    const firstJobId = await page.locator('table tbody tr:first-child td:nth-child(2) span').first().innerText();
    
    // Navigate with jobId in URL
    await page.goto(`/orchestrator?jobId=${firstJobId}`);
    
    // Check if the sheet opened
    await expect(page.locator('text=Detalhes do Job')).toBeVisible();
    await expect(page.locator(`text=ID: ${firstJobId}`)).toBeVisible();
  });

  test('should persist search term in URL and localStorage', async ({ page }) => {
    await page.goto('/orchestrator');
    
    const testSearch = 'test-correlation-123';
    const searchInput = page.locator('input[placeholder*="Filtrar por TraceID"]');
    await searchInput.fill(testSearch);
    
    // Check URL
    await expect(page).toHaveURL(/.*q=test-correlation-123/);
    
    // Refresh page
    await page.reload();
    
    // Check if search persists
    await expect(searchInput).toHaveValue(testSearch);
  });

  test('should show empty state when no results found', async ({ page }) => {
    await page.goto('/orchestrator?q=non-existent-correlation-id-999');
    
    // Should show no results in table
    await expect(page.locator('text=Nenhum job encontrado')).toBeVisible();
  });

  test('should copy TraceID to clipboard', async ({ page }) => {
    await page.goto('/orchestrator');
    await page.waitForSelector('table tbody tr');
    
    // Hover over the first row ID cell to show copy button
    await page.locator('table tbody tr:first-child td:nth-child(2)').hover();
    
    const copyBtn = page.locator('table tbody tr:first-child td:nth-child(2) button').first();
    await copyBtn.click();
    
    // Check for toast
    await expect(page.locator('text=TraceID copiado!')).toBeVisible();
  });
});
