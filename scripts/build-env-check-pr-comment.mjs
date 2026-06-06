#!/usr/bin/env node
/**
 * Build a Markdown PR comment summarising the env-check run.
 *
 * Inputs (env vars):
 *   REPORT_JSON_PATH  path to env-check.json (default: reports/env-check.json)
 *   REPORT_MD_PATH    path to env-check.md   (default: reports/env-check.md)
 *   ARTIFACT_URL      direct .zip link to the uploaded artifact (upload-artifact@v4)
 *   RUN_URL           link to the GitHub Actions run
 *   REPO_URL          https://github.com/<owner>/<repo>
 *   RUN_ID            workflow run id (used to deep-link the artifacts tab)
 *   COMMIT_SHA        full commit hash (first 7 chars shown)
 *   OUT_PATH          where to write the comment body (default: reports/pr-comment.md)
 *
 * The body starts with `<!-- kubo:env-check -->` so the workflow's follow-up
 * step finds & rewrites the previous comment instead of stacking new ones.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPORT      = process.env.REPORT_JSON_PATH ?? "reports/env-check.json";
const REPORT_MD   = process.env.REPORT_MD_PATH   ?? "reports/env-check.md";
const ARTIFACT_URL= process.env.ARTIFACT_URL ?? "";
const RUN_URL     = process.env.RUN_URL ?? "";
const REPO_URL    = process.env.REPO_URL ?? "";
const RUN_ID      = process.env.RUN_ID ?? "";
const SHA_FULL    = process.env.COMMIT_SHA ?? "";
const SHA         = SHA_FULL.slice(0, 7);
const OUT         = process.env.OUT_PATH ?? "reports/pr-comment.md";

const MARKER = "<!-- kubo:env-check -->";
const ARTIFACTS_PAGE = RUN_URL ? `${RUN_URL}#artifacts` : "";

// Raw file in the commit tree (lets reviewers click straight to the JSON).
// `/raw/` returns the literal bytes; `/blob/` is the rendered view.
const RAW_JSON_URL = REPO_URL && SHA_FULL
  ? `${REPO_URL}/raw/${SHA_FULL}/reports/env-check.json`
  : "";
const RAW_MD_URL = REPO_URL && SHA_FULL
  ? `${REPO_URL}/raw/${SHA_FULL}/reports/env-check.md`
  : "";
const BLOB_JSON_URL = REPO_URL && SHA_FULL
  ? `${REPO_URL}/blob/${SHA_FULL}/reports/env-check.json`
  : "";

const EMOJI = { ok: "✅", placeholder: "⚠️", missing: "❌", missing_file: "🚫" };
const emoji = (s) => EMOJI[s] ?? "•";

/**
 * Sanitize untrusted Markdown before embedding it inside the PR comment.
 * - Strips HTML comments so they can't collide with our `kubo:env-check`
 *   marker and trick the "find prior comment" step into rewriting the wrong
 *   block on re-runs.
 * - Removes <script>/<style>/<iframe> tags (GitHub already filters these,
 *   but defense in depth keeps lint clean).
 * - Neutralises stray `</details>` that would prematurely close our
 *   collapsible wrapper around the embedded report.
 * - Caps length to stay well under GitHub's 65 536-char comment limit.
 */
function sanitizeMarkdown(src, { maxLen = 40000 } = {}) {
  let s = String(src ?? "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<\/?(script|style|iframe|object|embed)\b[^>]*>/gi, "");
  // Neutralise both halves of <details> so embedded MD can't open/close ours.
  s = s.replace(/<\/details>/gi, "&lt;/details&gt;");
  s = s.replace(/<details(\s[^>]*)?>/gi, "&lt;details$1&gt;");
  if (s.length > maxLen) s = s.slice(0, maxLen) + "\n\n_…truncated…_";
  return s;
}

/** Validate the shape of the JSON we depend on below. */
function assertReportShape(j) {
  const errs = [];
  if (!j || typeof j !== "object") errs.push("report is not an object");
  if (j && !["pass", "fail"].includes(j.status)) errs.push(`bad status: ${j?.status}`);
  if (j && !Array.isArray(j.entries)) errs.push("entries is not an array");
  if (errs.length) throw new Error(`invalid env-check.json — ${errs.join("; ")}`);
}

function writeOut(body) {
  mkdirSync(dirname(resolve(OUT)), { recursive: true });
  writeFileSync(OUT, body);
  process.stdout.write(body);
}

if (!existsSync(REPORT)) {
  writeOut(
`${MARKER}
### env-check — no report

\`reports/env-check.json\` was not produced. Check the workflow logs${RUN_URL ? ` ([run](${RUN_URL}))` : ""}.
`);
  process.exit(0);
}

const j = JSON.parse(readFileSync(REPORT, "utf8"));
assertReportShape(j);
const passed = j.status === "pass";
const total  = j.entries.length;
const failingEntries = j.entries.filter((e) => e.status !== "ok");
const failed = failingEntries.length;

const byScope = j.entries.reduce((acc, e) => {
  (acc[e.scope] ??= []).push(e);
  return acc;
}, {});

const out = [];
out.push(MARKER);
out.push(`### env-check — ${passed ? "✅ pass" : "❌ fail"} · \`${total - failed}/${total}\` ok`);
out.push("");

// ── Failing variables (always visible at the top when not passing) ──
if (failed > 0) {
  out.push(`> **${failed} failing variable${failed === 1 ? "" : "s"}:**`);
  out.push(">");
  for (const e of failingEntries) {
    const v = e.variable ? `\`${e.scope}.${e.variable}\`` : `\`${e.scope}\` _(file)_`;
    out.push(`> - ${emoji(e.status)} ${v} — **${e.status}** · ${e.detail}`);
  }
  out.push("");
}

// ── Metadata ──
out.push(`| Metric | Value |`);
out.push(`|--------|-------|`);
out.push(`| Status | ${passed ? "✅ pass" : `❌ fail (${j.failures} issue${j.failures === 1 ? "" : "s"})`} |`);
out.push(`| Generated | \`${j.generated_at}\` |`);
if (SHA) out.push(`| Commit | \`${SHA}\` |`);
out.push(`| Frontend env | \`${j.frontend_env}\` |`);
out.push(`| Functions env | \`${j.functions_env}\` |`);
out.push(`| Scopes | ${Object.keys(byScope).length} |`);
out.push("");

// ── Per-scope counters (quick triage) ──
out.push(`| Scope | ✅ ok | ⚠️ placeholder | ❌ missing | 🚫 file | Total |`);
out.push(`|-------|------:|---------------:|----------:|--------:|------:|`);
for (const [scope, entries] of Object.entries(byScope)) {
  const c = { ok: 0, placeholder: 0, missing: 0, missing_file: 0 };
  for (const e of entries) c[e.status] = (c[e.status] ?? 0) + 1;
  out.push(`| \`${scope}\` | ${c.ok} | ${c.placeholder} | ${c.missing} | ${c.missing_file} | ${entries.length} |`);
}
out.push("");


// ── Per-scope collapsibles (failing scopes auto-open) ──
for (const [scope, entries] of Object.entries(byScope)) {
  const scopeFail = entries.filter((e) => e.status !== "ok").length;
  const summary = `<b>${scope}</b> — ${entries.length - scopeFail}/${entries.length} ok${scopeFail ? ` · ${scopeFail} failing` : ""}`;
  out.push(`<details${scopeFail ? " open" : ""}><summary>${summary}</summary>`);
  out.push("");
  out.push(`| Status | Variable | Detail |`);
  out.push(`|--------|----------|--------|`);
  for (const e of entries) {
    const v = e.variable ? `\`${e.variable}\`` : "_file_";
    out.push(`| ${emoji(e.status)} ${e.status} | ${v} | ${e.detail.replace(/\|/g, "\\|")} |`);
  }
  out.push("");
  out.push("</details>");
  out.push("");
}

// ── Full Markdown report (collapsed, sanitized) ──
if (existsSync(REPORT_MD)) {
  const md = sanitizeMarkdown(readFileSync(REPORT_MD, "utf8").trim());
  out.push(`<details><summary>📄 Full Markdown report (<code>reports/env-check.md</code>)</summary>`);
  out.push("");
  out.push(md);
  out.push("");
  out.push(`</details>`);
  out.push("");
}

// ── Raw JSON (collapsed) ──
out.push(`<details><summary>🧾 Raw JSON (<code>reports/env-check.json</code>)</summary>`);
out.push("");
out.push("```json");
out.push(JSON.stringify(j, null, 2));
out.push("```");
out.push("");
out.push(`</details>`);
out.push("");

// ── Artifacts & links (raw links always shown when commit is known) ──
out.push("**Artifacts & links**");
if (ARTIFACT_URL)   out.push(`- 📦 [Download \`env-check-report.zip\`](${ARTIFACT_URL}) — md + json + schema`);
if (ARTIFACTS_PAGE) out.push(`- 🗂️ [All artifacts for this run](${ARTIFACTS_PAGE})`);
if (RAW_JSON_URL)   out.push(`- 🧾 [Raw \`env-check.json\`](${RAW_JSON_URL})${BLOB_JSON_URL ? ` · [view on GitHub](${BLOB_JSON_URL})` : ""}`);
else                out.push(`- 🧾 \`reports/env-check.json\` — raw link unavailable (commit SHA not exposed to workflow).`);
if (RAW_MD_URL)     out.push(`- 📄 [Raw \`env-check.md\`](${RAW_MD_URL})`);
else                out.push(`- 📄 \`reports/env-check.md\` — raw link unavailable (commit SHA not exposed to workflow).`);
if (RUN_URL)        out.push(`- 🔁 [Workflow run](${RUN_URL})${RUN_ID ? ` \`#${RUN_ID}\`` : ""}`);
if (!ARTIFACT_URL && !ARTIFACTS_PAGE && !RUN_URL)
  out.push(`- Download \`env-check-report\` from the run page (no link captured).`);
out.push("");
out.push(`_Reproduce locally:_ \`bun run setup:env:report:json && bun run setup:env:schema\``);
out.push("");
out.push(`<sub>This comment is updated in place on every rerun (marker: \`kubo:env-check\`).</sub>`);

writeOut(out.join("\n") + "\n");
