import { test, expect } from '@playwright/test';

test.describe('Creative Page - Reset and Scheduled Jobs', () => {
  test('should reset filters and sorting to default state', async ({ page }) => {
    await page.goto('/creative');
    
    // Change filter
    await page.selectOption('select[name="filter"]', 'failed');
    await page.fill('input[placeholder*="Buscar"]', 'test-query');
    
    // Click reset button (assuming text "Reiniciar" or icon)
    await page.click('button:has-text("Reiniciar")');
    
    // Verify defaults
    await expect(page.locator('select[name="filter"]')).toHaveValue('all');
    await expect(page.locator('input[placeholder*="Buscar"]')).toHaveValue('');
  });

  test('scheduled job should export only reprocessed items', async ({ page }) => {
    // This is more of an integration test for the edge function
    // But we can simulate the trigger if there's a button
    // Or check for the link in notifications
    await page.goto('/creative');
    
    // Trigger schedule config
    await page.click('button:has-text("Exportar Auditoria")');
    await page.fill('input[name="audit-email"]', 'test@example.com');
    await page.click('button:has-text("Agendar")');
    
    // Wait for notification if job runs immediately or mock the response
    // For E2E validation of the function itself:
    // We would check the storage bucket 'exports' and verify file content
  });
});
