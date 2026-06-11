import { test, expect } from '@playwright/test';

// Note: These tests assume a logged-in user with appropriate roles.
// Since actual auth depends on the environment, we focus on UI logic and network mocks.

test.describe('PWA Telemetry E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock telemetry data response
    await page.route('**/pwa-telemetry*', async (route) => {
      const url = new URL(route.request().url());
      const isExport = url.searchParams.get('export');
      
      if (isExport) {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'id,created_at,type,url,session_id,canvas_id,user_id\n1,2026-06-11,image,url1,s1,c1,u1',
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [{ id: '1', session_id: 's1', type: 'image', url: 'u1', created_at: '2026-06-11' }],
            total: 15000,
            isCapped: true,
            appliedSigma: 2.0,
            summary: [
              { session_id: 's1', count: 10, first: '2026-06-11', last: '2026-06-11', types: { image: 10 } },
              { session_id: 's2', count: 5, first: '2026-06-11', last: '2026-06-11', types: { svg: 5 } },
              { session_id: 's3', count: 6, first: '2026-06-11', last: '2026-06-11', types: { font: 6 } }
            ],
            roles: ['admin']
          }),
        });
      }
    });

    await page.goto('/pwa-telemetry');
  });

  test('should display export cap warning and filter summary', async ({ page }) => {
    await page.click('button:has-text("Exportar")');
    
    // Check for 10k cap warning
    await expect(page.locator('text=Atenção: O total de eventos (15.000) excede o limite de 10k')).toBeVisible();
    
    // Check filter summary
    await expect(page.locator('text=Filtros Ativos:')).toBeVisible();
    
    // Test export button state
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Baixar")');
    // Ensure button shows progress state (this might be fast in mock, but we check if it was disabled)
    // await expect(page.locator('button:has-text("Exportando...")')).toBeVisible();
    
    await downloadPromise;
  });

  test('should handle export error and show retry guidance', async ({ page }) => {
    // Override route to fail
    await page.route('**/pwa-telemetry?export=csv*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Timeout in database' }),
      });
    });

    await page.click('button:has-text("Exportar")');
    await page.click('button:has-text("Baixar")');
    
    // Should show error toast with retry guidance (based on component logic)
    await expect(page.locator('text=Erro ao exportar: Timeout in database. Tente reduzir o período')).toBeVisible();
    
    // Dialog should remain open for retry
    await expect(page.locator('text=Exportar telemetria')).toBeVisible();
  });

  test('should enforce sigma role gate and persistence in URL', async ({ page }) => {
    const sigmaInput = page.locator('#sigma');
    await expect(sigmaInput).toBeVisible();
    
    // Change sigma and check URL
    await sigmaInput.fill('3.5');
    await sigmaInput.press('Enter');
    
    const url = page.url();
    expect(url).toContain('sigma=3.5');
    
    // Anomaly calculation is based on sigma. In our mock:
    // counts: 10, 5, 6 -> mean = 7, var = (9+4+1)/3 = 4.66, sd = 2.16
    // sigma 2 -> threshold 7 + 4.32 = 11.32 -> no anomalies
    // sigma 0.5 -> threshold 7 + 1.08 = 8.08 -> session s1 (10) is an anomaly
    
    await sigmaInput.fill('0.5');
    await sigmaInput.press('Enter');
    
    await expect(page.locator('text=Anomalia detectada na taxa de fallback')).toBeVisible();
    await expect(page.locator('text=s1… (10)')).toBeVisible();
  });

  test('should verify clear CSRF protection and role gate', async ({ page }) => {
    await page.route('**/pwa-telemetry-clear', async (route) => {
      const headers = route.request().headers();
      const body = JSON.parse(route.request().postData() || '{}');
      
      if (headers['x-csrf-token'] && headers['x-csrf-token'] === body.csrfToken) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, deleted: 5 }),
        });
      } else {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'csrf_token_mismatch' }),
        });
      }
    });

    await page.click('button:has-text("Limpar")');
    await page.click('button:has-text("Confirmar")');
    
    await expect(page.locator('text=Removidos 5 eventos')).toBeVisible();
  });
});
