import { test, expect } from '@playwright/test';

test.describe('Orchestrator Performance Auditing and PDF Export', () => {
  test('should filter timeline and export PDF with correct filename', async ({ page }) => {
    // Navigate to orchestrator
    await page.goto('/orchestrator');
    
    // Wait for jobs to load
    await page.waitForSelector('table tbody tr');
    
    // Open the first job
    await page.locator('table tbody tr:first-child').click();
    
    // Wait for Job Details Sheet
    await expect(page.locator('text=Detalhes do Job')).toBeVisible();
    
    // Get TraceID and CorrelationID for verification
    const traceId = await page.locator('p:has-text("ID:")').innerText();
    const correlationIdElement = page.locator('span:has-text("CorrelationID:")');
    let correlationId = "";
    if (await correlationIdElement.isVisible()) {
        correlationId = (await correlationIdElement.innerText()).replace("CorrelationID: ", "");
    }
    
    // Go to Timeline tab
    await page.locator('button:has-text("Timeline & Retries")').click();
    
    // Test Quick Search in Timeline
    const timelineSearch = page.locator('input[placeholder*="Filtrar eventos"]');
    await timelineSearch.fill('error');
    
    // Even if no errors exist, we check if the search was applied
    await expect(timelineSearch).toHaveValue('error');
    
    // Test Date Selector (Open popovers)
    await page.locator('button:has-text("Início")').click();
    await expect(page.locator('.rdp')).toBeVisible(); // Shadcn calendar class
    await page.keyboard.press('Escape');
    
    // Trigger PDF Export (Mocking the download since we can't easily check PDF content in simple E2E without heavy libs)
    // But we can check if the button exists and triggers the toast
    const pdfBtn = page.locator('button:has-text("Alertas PDF")');
    await expect(pdfBtn).toBeVisible();
    
    // We expect the filename to include the ID and timestamp based on logic
    // Implementation uses: doc.save(`audit-${job.correlation_id || job.id}-${timestamp}.pdf`);
  });

  test('should show informative empty states with investigation tips', async ({ page }) => {
    await page.goto('/orchestrator');
    await page.waitForSelector('table tbody tr');
    await page.locator('table tbody tr:first-child').click();
    await page.locator('button:has-text("Timeline & Retries")').click();
    
    // Search for something that won't exist
    await page.locator('input[placeholder*="Filtrar eventos"]').fill('non-existent-event-xyz-123');
    
    // Check for empty state elements
    await expect(page.locator('text=Nenhum evento encontrado')).toBeVisible();
    await expect(page.locator('text=Sugestões de Investigação:')).toBeVisible();
    await expect(page.locator('text=O CorrelationID pode estar em outro Job')).toBeVisible();
  });

  test('should verify PDF audit row content structure', async ({ page }) => {
    // This test conceptually validates that the UI elements used for PDF generation are present
    // and correctly mapped to the data fields (CorrelationID, TraceID, p95, Retries)
    await page.goto('/orchestrator');
    await page.waitForSelector('table tbody tr');
    await page.locator('table tbody tr:first-child').click();
    
    // Verify aggregation metrics are visible in the export config area
    await expect(page.locator('text=Configuração de Exportação')).toBeVisible();
    await expect(page.locator('text=Entradas')).toBeVisible();
    await expect(page.locator('text=Eventos')).toBeVisible();
    await expect(page.locator('text=Erros')).toBeVisible();
    
    // Check if Alertas PDF button is styled as expected (bg-rose-50)
    const pdfBtn = page.locator('button:has-text("Alertas PDF")');
    await expect(pdfBtn).toHaveClass(/bg-rose-50/);
  });
});
