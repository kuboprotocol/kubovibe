#!/usr/bin/env node
/**
 * Post-build smoke test.
 *
 * Serves the freshly built `dist/` over a local HTTP server, loads it in a
 * headless Chromium via Playwright, and fails the build if:
 *   - the page emits any uncaught error or unhandled rejection
 *   - the React root never mounts (white screen)
 *   - any critical entry script fails to load (HTTP != 2xx)
 *
 * Use SMOKE_URL=https://kubovibe.dev to point at a deployed URL instead of
 * the local dist. Set SKIP_SMOKE=1 to bypass (CI escape hatch).
 *
 * Exit codes: 0 ok, 1 smoke failed, 2 setup failed.
 */
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

if (process.env.SKIP_SMOKE === "1") {
  console.log("⏭️  SKIP_SMOKE=1 — skipping smoke test");
  process.exit(0);
}

const TARGET_URL = process.env.SMOKE_URL || null;
const DIST = join(process.cwd(), "dist");

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.warn("⚠️  playwright not installed — skipping browser smoke test (install with `bun add -d playwright` to enable)");
  process.exit(0);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

async function startStaticServer() {
  if (!existsSync(DIST)) {
    console.error("❌ dist/ not found — run `bun run build` first");
    process.exit(2);
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (!rel) rel = "index.html";
      let file = normalize(join(DIST, rel));
      if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
      try {
        const s = await stat(file);
        if (s.isDirectory()) file = join(file, "index.html");
      } catch {
        // SPA fallback
        file = join(DIST, "index.html");
      }
      const buf = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(buf);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  return { server, url: `http://localhost:${port}` };
}

async function run() {
  let baseUrl = TARGET_URL;
  let server = null;
  if (!baseUrl) {
    const s = await startStaticServer();
    server = s.server;
    baseUrl = s.url;
    console.log(`🛰  serving dist on ${baseUrl}`);
  } else {
    console.log(`🌐 smoking ${baseUrl}`);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req) => {
    const url = req.url();
    // Ignore optional sw / pwa best-effort asset fallbacks
    if (/\/placeholders\//.test(url)) return;
    failedRequests.push(`${req.method()} ${url} — ${req.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (res.status() >= 400 && /\.(js|mjs|css)(\?|$)/.test(url)) {
      failedRequests.push(`${res.status()} ${url} (${ct})`);
    }
  });

  let mounted = false;
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Wait for React to populate #root
    await page.waitForFunction(
      () => !!document.querySelector("#root")?.firstChild,
      null,
      { timeout: 15_000 },
    );
    mounted = true;
  } catch (e) {
    console.error(`❌ root never mounted: ${e.message}`);
  }

  // Settle a beat for late errors
  await page.waitForTimeout(1500);

  await browser.close();
  if (server) server.close();

  const problems = [];
  if (!mounted) problems.push("React root did not mount (white screen)");
  if (pageErrors.length) problems.push(`${pageErrors.length} uncaught error(s):\n  - ${pageErrors.join("\n  - ")}`);
  if (failedRequests.length) problems.push(`${failedRequests.length} critical asset failure(s):\n  - ${failedRequests.join("\n  - ")}`);

  if (problems.length) {
    console.error("\n❌ SMOKE TEST FAILED\n");
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log("✅ smoke test passed");
}

try {
  await run();
} catch (e) {
  console.error("❌ smoke test crashed:", e);
  process.exit(2);
}
