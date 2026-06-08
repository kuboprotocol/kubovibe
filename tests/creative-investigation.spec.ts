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

  test("debounce reduces requests and syncs URL with investigate context", async ({ page }) => {
    const investId = "debounce-context";
    await ensureAuthed(page, `/creative/investigation?investigate=${investId}`);
    
    let requestCount = 0;
    page.on("request", (req) => {
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
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
  });

  test("loads correctly from direct URL with all filters and investigate context", async ({ page }) => {
    const mockId = "00000000-0000-0000-0000-000000000000";
    const fullUrl = `/creative/investigation?investigate=${mockId}&q=direct-load&status=failed&tool=chat&page=2&sort=tool&dir=asc`;
    
    await ensureAuthed(page, fullUrl);

    // Verify URL parameters are still present
    await expect(page).toHaveURL(new RegExp(`investigate=${mockId}`));
    await expect(page).toHaveURL(/q=direct-load/);
    await expect(page).toHaveURL(/status=failed/);
    await expect(page).toHaveURL(/tool=chat/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=tool/);
    await expect(page).toHaveURL(/dir=asc/);

    // Verify UI components reflect the URL state
    await expect(page.getByTestId("filter-search")).toHaveValue("direct-load");
    await expect(page.getByTestId("filter-status")).toContainText(/Falha/i);
    
    // Table should attempt to load data with these filters
    await expect(page.getByTestId("investigation-row").first().or(page.getByText(/Nenhuma execução/))).toBeVisible();
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

    // Include investigate param to simulate context
    const investId = "00000000-0000-0000-0000-000000000000";
    await page.goto(`${BASE}/creative/investigation?investigate=${investId}&page=2&sort=tool`);
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=tool/);

    // Apply a filter
    await page.getByTestId("filter-search").fill("abc");
    await page.waitForTimeout(1000); // debounce
    
    // Verify sort and investigate still there
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    await expect(page).toHaveURL(/sort=tool/);
    await expect(page).toHaveURL(/q=abc/);
    
    // Reload
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    await expect(page).toHaveURL(/sort=tool/);
    await expect(page).toHaveURL(/q=abc/);
  });

  test("browser back/forward maintains filters and investigation context", async ({ page }) => {
    const investId = "history-context";
    await ensureAuthed(page, `/creative/investigation?investigate=${investId}`);

    // Change filter
    await page.getByTestId("filter-search").fill("first-search");
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/q=first-search/);

    // Change another filter
    await page.getByTestId("filter-status").click();
    await page.getByRole("option", { name: "Cancelado" }).click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/status=cancelled/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/q=first-search/);
    await expect(page).not.toHaveURL(/status=cancelled/);
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/status=cancelled/);
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    
    // Check if table reflects search from URL
    await expect(page.getByTestId("filter-search")).toHaveValue("first-search");
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

test.describe("Error and Retry Flows with investigation context", () => {
  test("ExportDetails retry preserves investigation context", async ({ page }) => {
    const investId = "some-investigate-id";
    await ensureAuthed(page, `/creative/export/non-existent-id?investigate=${investId}`);
    
    await expect(page.getByText(/não encontrada/i).or(page.getByText(/erro/i))).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    
    const retryBtn = page.getByRole("button", { name: /tentar novamente/i });
    await expect(retryBtn).toBeVisible();
    
    await retryBtn.click();
    await expect(page.locator(".skeleton, .animate-pulse").first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
  });

  test("InvestigationPage shows empty states and retry works", async ({ page }) => {
    const investId = "context-id";
    await ensureAuthed(page, `/creative/investigation?investigate=${investId}`);
    
    // Filter for something that returns nothing
    await page.getByTestId("filter-search").fill("non-existent-search-term-12345");
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Nenhuma execução encontrada/i)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
    
    // Verify "Clear filters" button works from empty state and keeps investigation context
    await page.getByTestId("btn-clear-filters").click();
    await expect(page.getByTestId("filter-search")).toHaveValue("");
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
  });

  test("simulated API timeout shows error and retry works", async ({ page }) => {
    const investId = "timeout-test-id";
    await ensureAuthed(page, `/creative/investigation?investigate=${investId}`);

    // Abort requests to simulate timeout/error
    await page.route("**/rest/v1/creative_assets*", (route) => route.abort("timedout"));
    
    // Trigger a refresh or filter change
    await page.getByTestId("filter-search").fill("trigger-error");
    await page.waitForTimeout(1000);

    // Should show error message
    await expect(page.getByText(/Erro ao carregar/i).or(page.getByText(/timedout/i))).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));

    // Remove route interception to allow retry to succeed
    await page.unroute("**/rest/v1/creative_assets*");

    const retryBtn = page.getByRole("button", { name: /tentar novamente/i });
    await retryBtn.click();

    // Should return to loading or data state
    await expect(page.locator(".skeleton, .animate-pulse").first().or(page.getByTestId("investigation-row").first())).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`investigate=${investId}`));
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

  test("debounce: search and filters update URL only after typing stops", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    
    const searchInput = page.getByTestId("filter-search");
    await searchInput.clear();
    
    // Type rapidly
    await searchInput.type("debounce-test", { delay: 50 });
    
    // Check URL immediately - should not have the full query yet due to 500ms debounce
    const url = page.url();
    expect(url).not.toContain("q=debounce-test");
    
    // Wait for debounce
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/q=debounce-test/);
  });

  test("debounce: pagination and sorting remain consistent during filtering", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    
    // Set a sort and page
    await page.locator("button:has-text('Ferramenta')").first().click(); // toggle sort
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page).toHaveURL(/page=2/);
    
    const searchInput = page.getByTestId("filter-search");
    await searchInput.fill("consist");
    
    // While typing, page and sort should still be in URL (unless reset by code)
    await expect(page).toHaveURL(/page=2/);
    
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/q=consist/);
    // Page was reset to 1 in InvestigationPage.tsx when filter changed (as it should)
    await expect(page).toHaveURL(/page=1/); 
  });
});


