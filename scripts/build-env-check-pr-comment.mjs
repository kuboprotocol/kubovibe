#!/usr/bin/env node
/**
 * Build a Markdown PR comment summarising the env-check run.
 *
 * Inputs (env vars):
 *   REPORT_JSON_PATH  path to env-check.json (default: reports/env-check.json)
 *   ARTIFACT_URL      direct link to the uploaded artifact (from upload-artifact@v4 output)
 *   RUN_URL           link to the GitHub Actions run (job summary fallback)
 *   COMMIT_SHA        short commit hash to stamp in the comment
 *   OUT_PATH          where to write the comment body (default: reports/pr-comment.md)
 *
 * Output: writes the rendered Markdown to OUT_PATH and prints it to stdout.
 *
 * The body starts with a stable marker `<!-- kubo:env-check -->` so the
 * follow-up step can find & replace the previous comment instead of stacking
 * new ones on every push.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPORT = process.env.REPORT_JSON_PATH ?? "reports/env-check.json";
const ARTIFACT_URL = process.env.ARTIFACT_URL ?? "";
const RUN_URL = process.env.RUN_URL ?? "";
const SHA = (process.env.COMMIT_SHA ?? "").slice(0, 7);
const OUT = process.env.OUT_PATH ?? "reports/pr-comment.md";

const MARKER = "<!-- kubo:env-check -->";

function emoji(status) {
  return { ok: "✅", placeholder: "⚠️", missing: "❌", missing_file: "🚫" }[status] ?? "•";
}

if (!existsSync(REPORT)) {
  const body =
`${MARKER}
### env-check — no report

\`reports/env-check.json\` was not produced. Check the workflow logs${RUN_URL ? ` ([run](${RUN_URL}))` : ""}.
`;
  mkdirSync(dirname(resolve(OUT)), { recursive: true });
  writeFileSync(OUT, body);
  process.stdout.write(body);
  process.exit(0);
}

const j = JSON.parse(readFileSync(REPORT, "utf8"));
const passed = j.status === "pass";
const total = j.entries.length;
const failed = j.entries.filter((e) => e.status !== "ok").length;

const byScope = j.entries.reduce((acc, e) => {
  (acc[e.scope] ??= []).push(e);
  return acc;
}, {});

const lines = [];
lines.push(MARKER);
lines.push(`### env-check — ${passed ? "✅ pass" : "❌ fail"}  \`${total - failed}/${total}\` ok`);
lines.push("");
lines.push(`| Metric | Value |`);
lines.push(`|--------|-------|`);
lines.push(`| Status | ${passed ? "✅ pass" : `❌ fail (${j.failures} issue${j.failures === 1 ? "" : "s"})`} |`);
lines.push(`| Generated | \`${j.generated_at}\` |`);
if (SHA) lines.push(`| Commit | \`${SHA}\` |`);
lines.push(`| Frontend env | \`${j.frontend_env}\` |`);
lines.push(`| Functions env | \`${j.functions_env}\` |`);
lines.push("");

for (const [scope, entries] of Object.entries(byScope)) {
  const scopeFail = entries.filter((e) => e.status !== "ok").length;
  lines.push(`<details${scopeFail ? " open" : ""}><summary><b>${scope}</b> — ${entries.length - scopeFail}/${entries.length} ok</summary>`);
  lines.push("");
  lines.push(`| Status | Variable | Detail |`);
  lines.push(`|--------|----------|--------|`);
  for (const e of entries) {
    const v = e.variable ? `\`${e.variable}\`` : "_file_";
    lines.push(`| ${emoji(e.status)} ${e.status} | ${v} | ${e.detail.replace(/\|/g, "\\|")} |`);
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");
}

lines.push("**Artifacts**");
if (ARTIFACT_URL) lines.push(`- 📦 [env-check-report](${ARTIFACT_URL}) — \`env-check.md\`, \`env-check.json\`, \`env-check.schema.json\``);
else lines.push(`- 📦 Download \`env-check-report\` from the run page${RUN_URL ? ` ([open](${RUN_URL}))` : ""}.`);
if (RUN_URL) lines.push(`- 🔁 [Workflow run](${RUN_URL})`);
lines.push("");
lines.push(`_Reproduce locally:_ \`bun run setup:env:report:json && bun run setup:env:schema\``);

const body = lines.join("\n") + "\n";
mkdirSync(dirname(resolve(OUT)), { recursive: true });
writeFileSync(OUT, body);
process.stdout.write(body);
