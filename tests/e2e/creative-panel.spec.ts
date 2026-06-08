import { test, expect } from '@playwright/test';

test.describe('Creative Economy Panel E2E', () => {
  test('navigation and full flow: Selection -> Configuration -> Execution', async ({ page }) => {
    await page.goto('/creative');
    
    // Stage 1: Selection (ManusLauncher)
    await expect(page.getByText(/Kubo Chat/i)).toBeVisible();
    await page.getByRole('button', { name: /Kubo Chat/i }).click();
    
    // Stage 2: Configuration (CreativeToolInterface)
    await expect(page.getByRole('heading', { name: /Kubo Chat/i })).toBeVisible();
    await expect(page.getByText(/Saldo:/i)).toBeVisible();
    await expect(page.getByText(/1 crédito/i)).toBeVisible();
    
    const promptInput = page.getByPlaceholder(/Escreva um artigo/i);
    await promptInput.fill('Teste de fluxo E2E');
    
    // Stage 3: Execution
    const generateBtn = page.getByRole('button', { name: /Gerar Agora/i });
    await generateBtn.click();
    
    // Validate feedback
    await expect(page.getByText(/Solicitação enviada/i)).toBeVisible();
    
    // Ensure state reset
    await expect(promptInput).toHaveValue('');
    await expect(generateBtn).toBeEnabled();
  });

  test('error logging and recovery in execution', async ({ page }) => {
    await page.goto('/creative');
    await page.getByRole('button', { name: /Kubo Chat/i }).click();
    
    // Simulate empty prompt error
    const generateBtn = page.getByRole('button', { name: /Gerar Agora/i });
    await generateBtn.click();
    await expect(page.getByText(/O campo de prompt\/URL é obrigatório/i)).toBeVisible();
    await expect(generateBtn).toBeEnabled();
  });

  test('navigation and state preservation', async ({ page }) => {
    await page.goto('/dashboard');
    const creativeBtn = page.getByRole('button', { name: /Economia Criativa/i });
    await expect(creativeBtn).toBeVisible();
    
    await creativeBtn.click();
    await expect(page).toHaveURL(/\/creative/);
    
    const backBtn = page.getByRole('button', { name: /Voltar/i }).or(page.locator('a[href="/dashboard"]'));
    await backBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('export filenames and timezone formatting', async ({ page }) => {
    await page.goto('/creative');
    
    // Select a specific timezone
    const tzSelect = page.locator('select').nth(1); 
    await tzSelect.selectOption('America/Sao_Paulo');
    
    // Trigger CSV export for history
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exportar/i }).first().click(); 
    
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    
    // Validate filename format: creative-history-{correlationId}-{timestamp}.csv
    expect(filename).toMatch(/^creative-history-[a-f0-9]{8}-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/);
  });
});
