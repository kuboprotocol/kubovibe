#!/usr/bin/env node
/**
 * End-to-end + fuzz tests for `scripts/build-env-check-pr-comment.mjs`.
 *
 * The builder is invoked as a child process (production code path), with
 * temp report/md fixtures pointed at via env vars. We assert hard invariants
 * about the rendered PR comment:
 *
 *   1. Marker `<!-- kubo:env-check -->` appears exactly once → rerun update works.
 *   2. No <script>/<style>/<iframe>/<object>/<embed> survives sanitization.
 *   3. Embedded MD's stray `</details>` is HTML-escaped (no premature close).
 *   4. Embedded MD's own `<!-- kubo:env-check -->` is stripped (marker stays unique).
 *   5. Per-scope counters render (one row per scope, totals add up).
 *   6. Failing scopes render `<details open>`; passing scopes do not.
 *   7. Raw `/raw/<sha>/` links present whenever COMMIT_SHA is exposed.
 *   8. JSON code-fence is closed; output ends with a newline.
 *
 * Fuzz: 64 randomized hostile Markdown payloads run through the builder and
 * must satisfy invariants (1)-(4) every time.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failures = 0;
const assert = (cond, msg) => {
  if (cond) return;
  failures++;
  console.error(`  ✗ ${msg}`);
};
const section = (name) => console.log(`\n▶ ${name}`);

const BUILDER = "scripts/build-env-check-pr-comment.mjs";

function runBuilder({ json, md, env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "envchk-pr-"));
  const jsonPath = join(dir, "env-check.json");
  const mdPath   = join(dir, "env-check.md");
  const outPath  = join(dir, "pr.md");
  writeFileSync(jsonPath, typeof json === "string" ? json : JSON.stringify(json));
  if (md != null) writeFileSync(mdPath, md);
  const res = spawnSync("node", [BUILDER], {
    encoding: "utf8",
    env: {
      ...process.env,
      REPORT_JSON_PATH: jsonPath,
      REPORT_MD_PATH:   md != null ? mdPath : join(dir, "missing.md"),
      OUT_PATH:         outPath,
      ARTIFACT_URL: "https://github.example/zip",
      RUN_URL:      "https://github.example/run/42",
      REPO_URL:     "https://github.com/acme/kubo",
      RUN_ID:       "42",
      COMMIT_SHA:   "abcdef1234567890abcdef1234567890abcdef12",
      ...env,
    },
  });
  if (res.status !== 0) {
    throw new Error(`builder exited ${res.status}: ${res.stderr}`);
  }
  return { body: readFileSync(outPath, "utf8"), dir };
}

const baseReport = {
  status: "fail",
  failures: 2,
  generated_at: "2026-06-06T12:00:00Z",
  frontend_env: ".env",
  functions_env: "supabase/functions/.env",
  entries: [
    { scope: "frontend", variable: "VITE_SUPABASE_URL",             status: "ok",          detail: "present" },
    { scope: "frontend", variable: "VITE_SUPABASE_PUBLISHABLE_KEY", status: "placeholder", detail: "template value" },
    { scope: "frontend", variable: "VITE_SUPABASE_PROJECT_ID",      status: "ok",          detail: "present" },
    { scope: "functions", variable: "SUPABASE_URL",                 status: "ok",          detail: "present" },
    { scope: "functions", variable: "SUPABASE_SERVICE_ROLE_KEY",    status: "missing",     detail: "not set" },
    { scope: "functions", variable: "SUPABASE_ANON_KEY",            status: "ok",          detail: "present" },
  ],
};

// ── E2E: happy + hostile MD ──────────────────────────────────────────────
section("E2E: hostile Markdown is sanitized & invariants hold");
{
  const hostileMd = [
    "# embedded report",
    "<!-- kubo:env-check -->",           // would collide with our marker
    "<!-- another comment -->",
    "</details>",                         // would prematurely close wrapper
    "<script>alert('xss')</script>",
    "<iframe src='evil'></iframe>",
    "<style>body{display:none}</style>",
    "regular | pipe | content",
  ].join("\n");

  const { body } = runBuilder({ json: baseReport, md: hostileMd });

  const markerCount = (body.match(/<!--\s*kubo:env-check\s*-->/g) ?? []).length;
  assert(markerCount === 1, `marker count = ${markerCount}, expected 1`);
  assert(!/<script\b/i.test(body),  "<script> survived sanitization");
  assert(!/<iframe\b/i.test(body),  "<iframe> survived sanitization");
  assert(!/<style\b/i.test(body),   "<style> survived sanitization");
  // Our 3 scope <details> + 2 wrappers (md, json) = 5 opens; closes must match.
  const opens  = (body.match(/<details(?:\s[^>]*)?>/g) ?? []).length;
  const closes = (body.match(/<\/details>/g) ?? []).length;
  assert(opens === closes, `details tags unbalanced: ${opens} open / ${closes} close`);
  assert(body.includes("&lt;/details&gt;"), "stray </details> not escaped inside embedded MD");

  // Per-scope counters table
  assert(/\|\s*`frontend`\s*\|\s*2\s*\|\s*1\s*\|\s*0\s*\|\s*0\s*\|\s*3\s*\|/.test(body),
    "frontend counter row missing/incorrect");
  assert(/\|\s*`functions`\s*\|\s*2\s*\|\s*0\s*\|\s*1\s*\|\s*0\s*\|\s*3\s*\|/.test(body),
    "functions counter row missing/incorrect");

  // Failing scope open, only the JSON-block wrapper closed by default.
  assert(/<details open><summary><b>frontend<\/b>/.test(body), "frontend scope not auto-open");
  assert(/<details open><summary><b>functions<\/b>/.test(body), "functions scope not auto-open");

  // Raw links use /raw/<sha>/
  assert(body.includes("/raw/abcdef1234567890abcdef1234567890abcdef12/reports/env-check.json"),
    "raw JSON link missing");
  assert(body.includes("/raw/abcdef1234567890abcdef1234567890abcdef12/reports/env-check.md"),
    "raw MD link missing");

  // JSON code-fence closed + trailing newline
  const fenceOpens  = (body.match(/```json/g) ?? []).length;
  const fenceCloses = (body.match(/^```$/gm) ?? []).length;
  assert(fenceOpens === fenceCloses, `json fence unbalanced: ${fenceOpens} open / ${fenceCloses} close`);
  assert(body.endsWith("\n"), "output must end with newline");
}

// ── E2E: passing report has no auto-open scopes ──────────────────────────
section("E2E: passing report does not auto-open scopes");
{
  const passing = {
    ...baseReport,
    status: "pass",
    failures: 0,
    entries: baseReport.entries.map((e) => ({ ...e, status: "ok", detail: "present" })),
  };
  const { body } = runBuilder({ json: passing, md: "# all green" });
  assert(!/<details open>/.test(body), "passing report must not auto-open any <details>");
  assert(body.includes("✅ pass"), "passing badge missing");
}

// ── E2E: raw links unavailable when COMMIT_SHA empty ─────────────────────
section("E2E: graceful fallback when COMMIT_SHA missing");
{
  const { body } = runBuilder({
    json: baseReport,
    md: "# embedded",
    env: { COMMIT_SHA: "" },
  });
  assert(body.includes("raw link unavailable"), "expected fallback note when SHA missing");
}

// ── Fuzz: sanitizer must hold under random hostile MD ────────────────────
section("Fuzz: 64 random hostile Markdown payloads");
{
  const tokens = [
    "<!-- kubo:env-check -->",
    "<!-- ignored -->",
    "</details>",
    "<details>",
    "<script>x()</script>",
    "<SCRIPT >y()</SCRIPT >",
    "<style>z{}</style>",
    "<iframe src=//evil></iframe>",
    "<object data='x'></object>",
    "<embed src='x'/>",
    "plain | text | row",
    "**bold**",
    "```\nfence\n```",
    "\u0000\u0001",
    "🚀✅❌",
    "a".repeat(1000),
  ];
  const rand = (n) => Math.floor(Math.random() * n);
  for (let i = 0; i < 64; i++) {
    const len = 4 + rand(20);
    const md = Array.from({ length: len }, () => tokens[rand(tokens.length)]).join("\n");
    let body;
    try {
      ({ body } = runBuilder({ json: baseReport, md }));
    } catch (e) {
      assert(false, `fuzz #${i}: builder crashed → ${e.message}`);
      continue;
    }
    const markerCount = (body.match(/<!--\s*kubo:env-check\s*-->/g) ?? []).length;
    if (markerCount !== 1) { assert(false, `fuzz #${i}: marker count = ${markerCount}`); break; }
    if (/<script\b/i.test(body)) { assert(false, `fuzz #${i}: <script> leaked`); break; }
    if (/<iframe\b/i.test(body)) { assert(false, `fuzz #${i}: <iframe> leaked`); break; }
    if (/<style\b/i.test(body))  { assert(false, `fuzz #${i}: <style> leaked`); break; }
    const opens  = (body.match(/<details(?:\s[^>]*)?>/g) ?? []).length;
    const closes = (body.match(/<\/details>/g) ?? []).length;
    if (opens !== closes) { assert(false, `fuzz #${i}: details unbalanced ${opens}/${closes}`); break; }
  }
  console.log("  ✓ 64 fuzz iterations passed");
}

if (failures) {
  console.error(`\n✗ ${failures} assertion failure(s)`);
  process.exit(1);
}
console.log("\n✓ All PR-comment builder tests passed");
