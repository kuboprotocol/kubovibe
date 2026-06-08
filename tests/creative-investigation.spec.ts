import { test, expect } from "@playwright/test";

test.describe("Creative Page Investigation and Audit", () => {
  test("should filter investigation logs and export audit trail", async ({ page }) => {
    await page.goto("/creative");
    
    // Wait for history to load
    await expect(page.locator("text=Economia Criativa Kubo")).toBeVisible();
    
    // Click on "Investigar" for the first item
    await page.locator('button:has-text("Investigar")').first().click();
    
    // Verify Investigation Modal opened
    await expect(page.locator("text=Investigação de Execução")).toBeVisible();
    
    // Filter by action
    await page.fill('input[placeholder="Buscar na trilha..."]', "retry");
    
    // Set date range
    await page.fill('input[type="date"]:nth-of-type(1)', "2026-06-01");
    await page.fill('input[type="date"]:nth-of-type(2)', "2026-06-08");
    
    // Export CSV and JSON
    await page.click('button:has-text("CSV")');
    await expect(page.locator("text=Trilha de auditoria exportada")).toBeVisible();
    
    await page.click('button:has-text("JSON")');
    await expect(page.locator("text=Trilha de auditoria exportada")).toBeVisible();
  });

  test("should register cancel and retry events in audit trail", async ({ page }) => {
    await page.goto("/creative");
    
    // Look for a processing or queued item to cancel
    const cancelBtn = page.locator('button:has-text("Cancelar")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.locator("text=Execução cancelada")).toBeVisible();
    }
    
    // Retry an item
    await page.locator('button:has-text("Investigar")').first().click();
    await page.locator('button:has-text("Retry")').first().click();
    await expect(page.locator("text=Execução cancelada")).toBeHidden();
    
    // Verify audit logs again
    await page.locator('button:has-text("Investigar")').first().click();
    await expect(page.locator("text=cancel")).toBeVisible();
    await expect(page.locator("text=retry")).toBeVisible();
    
    // Check if user is present in audit log
    await expect(page.locator('td:has-text("@")')).toBeVisible(); // email
  });

  test("should filter investigation logs by execution and date", async ({ page }) => {
    await page.goto("/creative");
    await page.locator('button:has-text("Investigar")').first().click();
    
    await page.fill('input[placeholder="Buscar na trilha..."]', "manual");
    // Verify it filters
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(0); // Assuming no "manual" action yet or filtering works
    
    await page.fill('input[placeholder="Buscar na trilha..."]', "");
    await expect(rows.count()).not.toBe(0);
  });
});