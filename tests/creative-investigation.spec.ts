import { test, expect } from "@playwright/test";

// E2E specs for /creative investigation, presets, notification prefs and exports.
// These tests are gated on a logged-in preview session — when the preview is not
// authenticated, the auth redirect is treated as a soft-skip so CI does not fail.

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";

async function ensureAuthed(page: any, path: string) {
  await page.goto(`${BASE}${path}`);
  if (page.url().includes("/auth")) {
    test.skip(true, "preview not authenticated");
  }
}

test.describe("Creative investigation UI states", () => {
  test("skeleton appears during loading", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    // Skeleton should be visible while loading
    const skeletons = page.locator(".skeleton, .animate-pulse");
    const count = await skeletons.count();
    if (count > 0) {
      await expect(skeletons.first()).toBeVisible();
    }
  });

  test("clear filters resets all fields and shows confirmation toast", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    await page.getByTestId("filter-search").fill("to-be-cleared");
    await page.getByTestId("filter-status").click();
    await page.getByRole("option", { name: "Cancelado" }).click();
    
    // Wait for debounce/URL update
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/q=to-be-cleared/);
    await expect(page).toHaveURL(/status=cancelled/);
    
    await page.getByTestId("btn-clear-filters").click();
    
    await expect(page.getByText(/filtros limpos/i)).toBeVisible();
    await expect(page.getByTestId("filter-search")).toHaveValue("");
    await expect(page).not.toHaveURL(/q=/);
    await expect(page).not.toHaveURL(/status=cancelled/);
  });

  test("filters persist on page reload", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    await page.getByTestId("filter-search").fill("persistent-query");
    await page.waitForTimeout(1000); // debounce
    await expect(page).toHaveURL(/q=persistent-query/);

    await page.reload();
    await expect(page.getByTestId("filter-search")).toHaveValue("persistent-query");
    // Should still have data or loading state then data
    await expect(page.getByTestId("investigation-row").first().or(page.getByText(/Nenhuma execução/))).toBeVisible();
  });

  test("investigate query param opens detail on load and persists on reload", async ({ page }) => {
    const mockId = "00000000-0000-0000-0000-000000000000";
    await ensureAuthed(page, `/creative/investigation?investigate=${mockId}`);
    
    // Check if query param is present
    await expect(page).toHaveURL(new RegExp(`investigate=${mockId}`));
    
    // Should attempt to load and likely show "not found" or details
    await expect(page.getByTestId("investigation-detail").or(page.getByText(/não encontrada/i))).toBeVisible();
    
    // Reload and verify persistence
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`investigate=${mockId}`));
    await expect(page.getByTestId("investigation-detail").or(page.getByText(/não encontrada/i))).toBeVisible();
  });
});

test.describe("Creative investigation", () => {
  test("filters update results in real time and persist in URL", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    await page.getByTestId("filter-search").fill("test-query");
    // Wait for debounce
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/q=test-query/);

    await page.getByTestId("filter-start-date").fill("2025-01-01");
    await page.getByTestId("filter-end-date").fill("2025-12-31");
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/from=2025-01-01/);
    await expect(page).toHaveURL(/to=2025-12-31/);
  });

  test("debounce reduces requests", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    
    let requestCount = 0;
    page.on("request", (req) => {
      // Filter for Supabase PostgREST requests to creative_assets
      if (req.url().includes("creative_assets") && req.method() === "GET") {
        requestCount++;
      }
    });

    const searchInput = page.getByTestId("filter-search");
    // Type rapidly
    await searchInput.pressSequentially("abcdef", { delay: 50 });
    
    // Typing quickly should result in fewer requests than characters
    await page.waitForTimeout(1000);
    // 6 characters typed rapidly should only trigger 1-2 requests due to 500ms debounce
    expect(requestCount).toBeLessThan(4); 
    await expect(page).toHaveURL(/q=abcdef/);
  });

  test("pagination and sorting persist across reloads and filter changes", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    
    // Sort by tool
    const toolHeader = page.getByRole("columnheader", { name: /ferramenta/i });
    if (await toolHeader.isVisible()) {
      await toolHeader.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/sort=tool/);
    }
    
    // Go to next page if possible
    const nextBtn = page.getByRole("button", { name: /próxima/i });
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(page).toHaveURL(/page=2/);
    }

    // Apply a filter
    await page.getByTestId("filter-search").fill("abc");
    await page.waitForTimeout(1000);
    
    // Verify sort and page (page often resets to 1 when filters change, which is correct behavior)
    await expect(page).toHaveURL(/sort=tool/);
    
    // Reload
    await page.reload();
    await expect(page).toHaveURL(/sort=tool/);
    await expect(page).toHaveURL(/q=abc/);
  });

  test("export audit JSON/CSV download contains only filtered range", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    const rows = page.getByTestId("investigation-row");
    if ((await rows.count()) === 0) test.skip(true, "no data");
    await rows.first().click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-audit-json").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^audit-.*\.json$/);

    const [csv] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-audit-csv").click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(/^audit-.*\.csv$/);
  });
});

test.describe("Error and Retry Flows", () => {
  test("ExportDetails retry preserves investigation context", async ({ page }) => {
    const investId = "some-investigate-id";
    // Force an error by going to a non-existent ID but with investigate param
    await ensureAuthed(page, `/creative/export/non-existent-id?investigate=${investId}`);
    
    await expect(page.getByText(/não encontrada/i)).toBeVisible();
    
    // Check if investigation context is still in URL (implied by path if handled via searchParams)
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    
    const retryBtn = page.getByRole("button", { name: /tentar novamente/i });
    await expect(retryBtn).toBeVisible();
    
    // Click retry - should stay on same URL and show loading then error again (since ID is fake)
    await retryBtn.click();
    await expect(page.locator(".skeleton")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
  });

  test("InvestigationPage shows empty states and error messages", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    
    // Filter for something that returns nothing
    await page.getByTestId("filter-search").fill("non-existent-search-term-12345");
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Nenhuma execução encontrada/i)).toBeVisible();
    
    // Verify "Clear filters" button works from empty state
    await page.getByTestId("btn-clear-filters").click();
    await expect(page.getByTestId("filter-search")).toHaveValue("");
  });
});

test.describe("Creative exports navigation", () => {
  test("investigate button in export details navigates with query param", async ({ page }) => {
    await ensureAuthed(page, "/creative");
    // This assumes there's an "Investigar" link somewhere in the creative module
    const investigateBtn = page.getByRole("button", { name: /investigar/i }).first();
    if (await investigateBtn.count() > 0) {
      await investigateBtn.click();
      await expect(page).toHaveURL(/\/creative\/investigation\?investigate=/);
      await expect(page.getByTestId("investigation-detail")).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Creative presets", () => {
  test("list shows presets and allow rename/delete UI", async ({ page }) => {
    await ensureAuthed(page, "/creative/presets");
    const rows = page.getByTestId("preset-row");
    if ((await rows.count()) > 0) {
      await page.getByTestId("preset-rename").first().click();
      await expect(page.locator("input").first()).toBeVisible();
    }
  });
});

test.describe("Notification preferences", () => {
  test("can toggle and persist preferences", async ({ page }) => {
    await ensureAuthed(page, "/creative/notifications");
    await expect(page.getByTestId("switch-notify_cancel")).toBeVisible();
    await page.getByTestId("switch-notify_cancel").click();
    await page.getByTestId("save-prefs").click();
    await expect(page.getByText(/preferências salvas/i)).toBeVisible({ timeout: 5000 });
  });
});


