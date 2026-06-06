#!/usr/bin/env node
/**
 * Production health check.
 *
 * Probes the public surfaces of the deployed app and reports each as
 * pass/fail with status code + latency.
 *
 * Endpoints (override via env vars):
 *   PROD_APP_URL       — main app URL              (default: https://kubovibe.dev)
 *   PROD_PREVIEW_URL   — Lovable preview URL       (default: https://kubovibe.lovable.app)
 *   PROD_SUPABASE_URL  — Lovable Cloud REST root   (default: $VITE_SUPABASE_URL)
 *   PROD_SUPABASE_KEY  — anon/publishable key      (default: $VITE_SUPABASE_PUBLISHABLE_KEY)
 *
 * Exit codes:
 *   0  all checks pass
 *   1  one or more checks failed
 *   2  invalid configuration
 *
 * Emits GitHub Actions annotations when GITHUB_ACTIONS=true.
 */
import { readFileSync, existsSync } from "node:fs";

// Hydrate process.env from .env if not already set (useful for local runs).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
}

const APP = process.env.PROD_APP_URL ?? "https://kubovibe.dev";
const PREVIEW = process.env.PROD_PREVIEW_URL ?? "https://kubovibe.lovable.app";
const SB_URL = process.env.PROD_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SB_KEY = process.env.PROD_SUPABASE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const ci = process.env.GITHUB_ACTIONS === "true";
const annotate = (level, msg) => ci && process.stdout.write(`::${level}::${msg.replace(/\n/g, "%0A")}\n`);

const checks = [
  { name: "app (custom domain)", url: APP, expect: [200, 301, 302, 304] },
  { name: "app (lovable preview)", url: PREVIEW, expect: [200, 301, 302, 304] },
];

if (SB_URL) {
  checks.push({
    name: "lovable cloud REST",
    url: `${SB_URL.replace(/\/$/, "")}/rest/v1/`,
    headers: SB_KEY ? { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } : {},
    expect: [200, 404], // 404 on empty root = reachable
  });
  checks.push({
    name: "lovable cloud auth",
    url: `${SB_URL.replace(/\/$/, "")}/auth/v1/health`,
    headers: SB_KEY ? { apikey: SB_KEY } : {},
    expect: [200],
  });
} else {
  console.warn("⚠ PROD_SUPABASE_URL / VITE_SUPABASE_URL not set — skipping backend checks");
}

async function probe(c) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(c.url, { method: "GET", redirect: "manual", headers: c.headers ?? {}, signal: ctrl.signal });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const ok = c.expect.includes(res.status);
    return { ...c, status: res.status, ms, ok };
  } catch (e) {
    return { ...c, status: 0, ms: Date.now() - t0, ok: false, error: e.message };
  }
}

const results = await Promise.all(checks.map(probe));

let failed = 0;
console.log("\nProd health check");
console.log("─".repeat(60));
for (const r of results) {
  const tag = r.ok ? "✓" : "✗";
  const line = `${tag} ${r.name.padEnd(26)} ${String(r.status).padStart(3)}  ${String(r.ms).padStart(4)}ms  ${r.url}${r.error ? `  (${r.error})` : ""}`;
  console.log(line);
  if (!r.ok) {
    failed++;
    annotate("error", `prod-health: ${r.name} failed — status=${r.status} url=${r.url}${r.error ? ` error=${r.error}` : ""}`);
  }
}
console.log("─".repeat(60));
console.log(`${results.length - failed}/${results.length} passing`);

process.exit(failed === 0 ? 0 : 1);
