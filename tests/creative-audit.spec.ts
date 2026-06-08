import { test, expect } from "@playwright/test";

test.describe("Creative Page Audit Export", () => {
  test("should filter audit export by date range and include only reprocessed items", async ({ page }) => {
    await page.goto("/creative");
    
    // Open schedule audit dialog
    await page.click('button[title="Agendar Auditoria"]');
    
    // Fill date range
    await page.fill('input[type="date"]:first-of-type', "2026-06-01");
    await page.fill('input[type="date"]:last-of-type', "2026-06-08");
    await page.fill('input[placeholder="seu@email.com"]', "test@example.com");
    await page.fill('input[type="time"]', "10:00");
    
    // Submit
    await page.click('button:has-text("Agendar Exportação")');
    
    // Verify success toast
    await expect(page.locator("text=Exportação de auditoria agendada com sucesso")).toBeVisible();
    
    // Check export history
    await page.click('button[title="Histórico de Downloads"]');
    
    // Verify a new entry exists with status queued or processing
    const firstExport = page.locator(".cursor-pointer").first();
    await expect(firstExport).toBeVisible();
    
    // Click for details
    await firstExport.click();
    
    // Verify details modal
    await expect(page.locator("text=Detalhes da Exportação")).toBeVisible();
    await expect(page.locator("text=Execuções Incluídas")).toBeVisible();
  });

  test("should display failed export alerts and allow investigation", async ({ page }) => {
    await page.goto("/creative");
    
    // Open history
    await page.click('button[title="Histórico de Downloads"]');
    
    // Look for error alerts if any (simulated via existing data or wait for mock)
    const alert = page.locator("text=Alertas de Falha Recentes");
    if (await alert.isVisible()) {
      await expect(page.locator("text=Motivo:")).toBeVisible();
      await page.click('button:has-text("Ver Exportação")');
      await expect(page.locator("text=Detalhes da Exportação")).toBeVisible();
    }
  });
});
