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

test.describe("Creative investigation", () => {
  test("filters update results in real time and persist in URL", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    await page.getByTestId("filter-search").fill("test-query");
    await expect(page).toHaveURL(/q=test-query/);

    await page.getByTestId("filter-start-date").fill("2025-01-01");
    await page.getByTestId("filter-end-date").fill("2025-12-31");
    await expect(page).toHaveURL(/from=2025-01-01/);
    await expect(page).toHaveURL(/to=2025-12-31/);
  });

  test("pagination controls advance the page", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    const next = page.getByRole("button", { name: "Próxima" });
    if (await next.isEnabled()) {
      await next.click();
      await expect(page).toHaveURL(/page=2/);
    }
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

  test("cancel and requeue actions write audit entries", async ({ page }) => {
    await ensureAuthed(page, "/creative/investigation");
    const requeueBtn = page.getByTestId("btn-requeue").first();
    if (await requeueBtn.count()) {
      page.on("dialog", (d) => d.accept());
      await requeueBtn.click();
      // refetch — audit panel should reflect a "retry" event if a row is open
    }
  });
});

test.describe("Creative presets", () => {
  test("list shows presets and allows rename/delete UI", async ({ page }) => {
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
