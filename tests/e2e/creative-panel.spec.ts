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

  test('error logging, retry and detailed modal', async ({ page }) => {
    await page.goto('/creative');
    await page.getByRole('button', { name: /Kubo Chat/i }).click();
    
    // Force invalid request to trigger error alert
    const generateBtn = page.getByRole('button', { name: /Gerar Agora/i });
    await generateBtn.click();
    
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Erro na Configuração/i);
    
    // Open details modal
    await page.getByRole('button', { name: /Ver Detalhes/i }).click();
    await expect(page.getByText(/Detalhes do Erro Técnicos/i)).toBeVisible();
    await page.keyboard.press('Escape');

    // Simulate recovery on retry
    await page.getByPlaceholder(/Escreva um artigo/i).fill('Teste de retry sucesso');
    const retryBtn = page.getByRole('button', { name: /Tentar Novamente/i });
    await retryBtn.click();
    
    await expect(page.getByText(/Solicitação enviada/i)).toBeVisible();
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
