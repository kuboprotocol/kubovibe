import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist/assets');
const MAX_CHUNK_SIZE_MB = 4.0; 
const TOTAL_BUNDLE_LIMIT_MB = 15.0;
const jsonReportPath = join(process.cwd(), 'bundle-size-report.json');
const htmlReportPath = join(process.cwd(), 'bundle-size-report.html');
const ciMarkdownPath = join(process.cwd(), 'ci-summary.md');

console.log('--- Quality Audit & Bundle Size Report ---');

if (!existsSync(distDir)) {
  console.warn('⚠️ dist/assets directory not found! Skipping bundle size checks.');
}

const files = existsSync(distDir) ? readdirSync(distDir) : [];
let totalSize = 0;
let exceeded = false;
const largeFiles: string[] = [];
const fileData: Record<string, number> = {};

files.forEach(file => {
  const filePath = join(distDir, file);
  const stats = statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  totalSize += sizeMB;
  fileData[file] = sizeMB;

  if (sizeMB > MAX_CHUNK_SIZE_MB) {
    largeFiles.push(`${file} (${sizeMB.toFixed(2)} MB)`);
    exceeded = true;
  }
});

// Evidence structure for CI comments
const evidence = {
  screenshots: [
    { name: 'PNG Fallback', path: 'test-results/fallback-png.png', exists: existsSync('test-results/fallback-png.png') },
    { name: 'SVG Fallback', path: 'test-results/fallback-svg.png', exists: existsSync('test-results/fallback-svg.png') },
    { name: 'Font Fallback', path: 'test-results/fallback-font.png', exists: existsSync('test-results/fallback-font.png') }
  ],
  videos: [
    { name: 'PWA Fallback Video', path: 'test-results/pwa-fallback.mp4', exists: existsSync('test-results/pwa-fallback.mp4') }
  ]
};

const report = {
  totalSizeMB: totalSize,
  exceeded,
  largeFiles,
  timestamp: new Date().toISOString(),
  files: fileData,
  evidence
};

writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

// Generate CI Markdown Comment
let ciMarkdown = `### 🚀 Kubo Vibe - PWA Quality Report\n\n`;
ciMarkdown += `**Build Status:** ${exceeded ? '❌ FAILED' : '✅ PASSED'}\n`;
ciMarkdown += `**Total Bundle Size:** ${totalSize.toFixed(2)} MB / ${TOTAL_BUNDLE_LIMIT_MB} MB\n\n`;

if (exceeded) {
  ciMarkdown += `#### ⚠️ Alerta: Arquivos que excederam o limite (${MAX_CHUNK_SIZE_MB}MB):\n`;
  largeFiles.forEach(f => ciMarkdown += `- ${f}\n`);
  ciMarkdown += `\n`;
}

ciMarkdown += `#### 📸 E2E Offline Fallback Evidence\n`;
ciMarkdown += `Em caso de falha nos testes, confira as evidências geradas:\n\n`;

evidence.screenshots.forEach(s => {
  if (s.exists) {
    ciMarkdown += `- **${s.name}**: [Visualizar Screenshot](./${s.path})\n`;
  } else {
    ciMarkdown += `- **${s.name}**: (Não gerado nesta execução)\n`;
  }
});

evidence.videos.forEach(v => {
  if (v.exists) {
    ciMarkdown += `- **${v.name}**: [Baixar Vídeo](./${v.path})\n`;
  }
});

ciMarkdown += `\n#### 📊 Telemetria PWA\n`;
ciMarkdown += `O endpoint de telemetria está disponível em: \`/api/pwa/telemetry\`\n`;
ciMarkdown += `Dashboard: \`/pwa/telemetry\`\n\n`;
ciMarkdown += `*Relatório completo disponível nos artefatos do job: bundle-size-report.html*\n`;

writeFileSync(ciMarkdownPath, ciMarkdown);
console.log(`CI Markdown Summary saved to ${ciMarkdownPath}`);

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Kubo Vibe - Quality Audit</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; background: #f8fafc; color: #334155; }
    .container { max-width: 1000px; margin: 0 auto; }
    .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-bottom: 24px; border: 1px solid #e2e8f0; }
    h1 { color: #1e293b; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; display: inline-block; }
    h2 { font-size: 1.25rem; color: #1e293b; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f1f5f9; text-align: left; padding: 12px; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
    tr.error { background-color: #fef2f2; color: #991b1b; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .stat-box { padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; }
    .stat-label { font-size: 0.875rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .status-ok { background: #dcfce7; color: #166534; }
    .status-fail { background: #fee2e2; color: #991b1b; }
    .evidence-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-top: 16px; }
    .evidence-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; }
    .evidence-card img { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 8px; }
    .evidence-card span { font-size: 0.875rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Kubo Vibe - Quality Audit</h1>
    
    <div class="summary-grid">
      <div class="stat-box">
        <div class="stat-label">Total Bundle Size</div>
        <div class="stat-value">${totalSize.toFixed(2)} MB</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">PWA Telemetry</div>
        <div class="stat-value" style="font-size: 1rem;">/api/pwa/telemetry</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Build Status</div>
        <div>
          <span class="status-badge ${exceeded ? 'status-fail' : 'status-ok'}">
            ${exceeded ? 'FAILED' : 'PASSED'}
          </span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Offline Fallback Evidence</h2>
      <div class="evidence-grid">
        ${evidence.screenshots.map(s => `
          <div class="evidence-card">
            ${s.exists ? `<img src="${s.path}" alt="${s.name}">` : `<div style="background: #f1f5f9; height: 150px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; color: #64748b; font-size: 12px;">[Arquivo não encontrado]</div>`}
            <span>${s.name}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Detailed Asset Sizes</h2>
      <table>
        <thead>
          <tr><th>File Name</th><th>Size (MB)</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${Object.entries(fileData).sort((a,b) => b[1] - a[1]).map(([name, size]) => `
            <tr class="${size > MAX_CHUNK_SIZE_MB ? 'error' : ''}">
              <td><code>${name}</code></td>
              <td>${size.toFixed(2)} MB</td>
              <td>${size > MAX_CHUNK_SIZE_MB ? '❌ TOO LARGE' : '✅ OK'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

writeFileSync(htmlReportPath, htmlContent);
console.log(`HTML Report saved to ${htmlReportPath}`);

if (exceeded) {
  process.exit(1);
}
