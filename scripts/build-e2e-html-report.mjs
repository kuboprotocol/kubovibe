#!/usr/bin/env node
/**
 * Agregador HTML dos relatórios JSON gravados pelos specs Web3 em test-results/*.json
 *
 * Uso:
 *   node scripts/build-e2e-html-report.mjs
 *
 * Saída: test-results/e2e-connectors-report.html
 *
 * Pensado para CI (GitHub Actions / GitLab / Jenkins): sem dependências externas,
 * HTML autocontido (CSS inline), leve, navegável e exportável como artifact.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('test-results')
const OUT = path.join(DIR, 'e2e-connectors-report.html')

if (!existsSync(DIR)) {
  mkdirSync(DIR, { recursive: true })
}

const files = readdirSync(DIR).filter((f) => f.endsWith('-report.json'))
const reports = files.map((f) => {
  try {
    return { file: f, data: JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) }
  } catch (e) {
    return { file: f, data: { success: false, parseError: String(e), steps: [] } }
  }
})

const total = reports.length
const success = reports.filter((r) => r.data?.success === true).length
const failed = total - success
const rate = total ? Math.round((success / total) * 100) : 0

const fmt = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 19) : '—')
const dur = (a, b) => (a && b ? `${((new Date(b) - new Date(a)) / 1000).toFixed(2)}s` : '—')

const rows = reports
  .map((r) => {
    const d = r.data ?? {}
    const ok = d.success === true
    const stepsCount = Array.isArray(d.steps) ? d.steps.length : 0
    return `
    <tr class="${ok ? 'ok' : 'fail'}">
      <td><code>${r.file}</code></td>
      <td>${ok ? '✅ pass' : '❌ fail'}</td>
      <td>${fmt(d.startedAt)}</td>
      <td>${dur(d.startedAt, d.endedAt)}</td>
      <td>${stepsCount}</td>
      <td>${d.deleteCalls ?? '—'}</td>
      <td>${Array.isArray(d.toastStates) ? d.toastStates.join(', ') : '—'}</td>
    </tr>`
  })
  .join('')

const stepBlocks = reports
  .map((r) => {
    const d = r.data ?? {}
    const steps = Array.isArray(d.steps) ? d.steps : []
    const items = steps
      .map((s) => `<li><span class="ts">${fmt(s.at)}</span> <strong>${s.step}</strong> <code>${JSON.stringify({ ...s, step: undefined, at: undefined })}</code></li>`)
      .join('')
    return `
    <details ${d.success ? '' : 'open'}>
      <summary>${r.file} — ${d.success ? '✅' : '❌'}</summary>
      <ol class="steps">${items || '<li><em>no steps</em></li>'}</ol>
    </details>`
  })
  .join('')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Kubo Vibe — E2E Connectors Report</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; --ok:#16a34a; --fail:#dc2626; --bg:#0b0d10; --fg:#e6e8eb; --mut:#9aa3ad; --card:#11141a; --border:#1f242c; }
  *{box-sizing:border-box} body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg);padding:24px}
  header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:24px}
  h1{margin:0;font-size:20px;letter-spacing:.3px} h2{margin:32px 0 12px;font-size:16px;color:var(--mut);text-transform:uppercase;letter-spacing:.08em}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px}
  .card .v{font-size:24px;font-weight:600} .card .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  .bar{height:8px;border-radius:999px;background:#1a1f27;overflow:hidden;margin-top:10px}
  .bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--ok),#22c55e)}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
  th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}
  th{background:#0e1218;color:var(--mut);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
  tr.ok td:nth-child(2){color:var(--ok)} tr.fail td:nth-child(2){color:var(--fail);font-weight:600}
  code{font:12px ui-monospace,Menlo,Consolas,monospace;background:#0d1117;padding:1px 6px;border-radius:6px;border:1px solid var(--border);color:#cbd5e1}
  details{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin:10px 0}
  details>summary{cursor:pointer;font-weight:600}
  ol.steps{margin:10px 0 0;padding-left:18px} .steps li{margin:4px 0} .ts{color:var(--mut);font-variant-numeric:tabular-nums;margin-right:6px}
  footer{margin-top:32px;color:var(--mut);font-size:12px}
</style>
</head>
<body>
<header>
  <div>
    <h1>Kubo Vibe — Connectors E2E Report</h1>
    <div style="color:var(--mut);font-size:12px">Generated ${new Date().toISOString()}</div>
  </div>
</header>

<section class="cards">
  <div class="card"><div class="l">Total specs</div><div class="v">${total}</div></div>
  <div class="card"><div class="l">Passed</div><div class="v" style="color:var(--ok)">${success}</div></div>
  <div class="card"><div class="l">Failed</div><div class="v" style="color:var(--fail)">${failed}</div></div>
  <div class="card"><div class="l">Success rate</div><div class="v">${rate}%</div><div class="bar"><i style="width:${rate}%"></i></div></div>
</section>

<h2>Summary</h2>
<table>
  <thead><tr><th>Report</th><th>Status</th><th>Started</th><th>Duration</th><th>Steps</th><th>deleteCalls</th><th>toastStates</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7"><em>No reports found in test-results/</em></td></tr>'}</tbody>
</table>

<h2>Step timelines</h2>
${stepBlocks || '<p><em>No timelines.</em></p>'}

<footer>
  Companion to Playwright's HTML reporter — focuses on JSON forensic traces written by Web3 connector specs.
  For traces/videos/screenshots, see <code>playwright-report/</code>.
</footer>
</body></html>`

writeFileSync(OUT, html, 'utf8')
console.log(`✓ wrote ${OUT} (${total} reports, ${success} ok, ${failed} fail)`)
