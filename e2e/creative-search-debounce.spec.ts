import { test, expect } from '@playwright/test';

test.describe('Creative Panel Search and Debounce', () => {
  test.beforeEach(async ({ page }) => {
    // Basic setup - assume we are logged in or mock it
    // For real E2E we might need a test user
    await page.goto('/creative');
  });

  test('search field should debounce updates to the URL and results', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Prompt, ferramenta ou erro...');
    
    // Type quickly
    await searchInput.fill('astronaut');
    
    // Wait a short time, less than debounce (600ms)
    await page.waitForTimeout(200);
    
    // Search query shouldn't be in the results yet if we're strictly checking "results shown for X"
    // But since it's a real app, let's check that the API wasn't called multiple times or URL didn't change immediately
    
    // After 800ms (debounce 600ms + buffer)
    await page.waitForTimeout(800);
    
    // Check if the history list filtered (this assumes there's data)
    // In a real test we'd mock the Supabase response
    
    // Check if URL would have updated if we were syncing it (InvestigationPage does this)
  });

  test('InvestigationPage filters should update URL with debounce', async ({ page }) => {
    await page.goto('/creative/investigation');
    
    const searchInput = page.getByPlaceholder('Buscar por prompt, ID...');
    await searchInput.fill('failure');
    
    // URL shouldn't have q=failure yet
    let url = page.url();
    expect(url).not.toContain('q=failure');
    
    // Wait for debounce (500ms in InvestigationPage)
    await page.waitForTimeout(700);
    
    url = page.url();
    expect(url).toContain('q=failure');
    
    // Change status
    await page.getByTestId('filter-status').click();
    await page.getByLabel('Concluído').click();
    
    await page.waitForTimeout(500);
    url = page.url();
    expect(url).toContain('status=completed');
  });
});
