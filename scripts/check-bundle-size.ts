import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist/assets');
const MAX_CHUNK_SIZE_MB = 4.0; 
const TOTAL_BUNDLE_LIMIT_MB = 15.0;
const jsonReportPath = join(process.cwd(), 'bundle-size-report.json');
const htmlReportPath = join(process.cwd(), 'bundle-size-report.html');

console.log('--- Bundle Size Report ---');

if (!existsSync(distDir)) {
  console.error('❌ dist/assets directory not found!');
  process.exit(1);
}

const files = readdirSync(distDir);
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

  console.log(`  ${file.padEnd(40)} | ${sizeMB.toFixed(2)} MB`);

  if (sizeMB > MAX_CHUNK_SIZE_MB) {
    largeFiles.push(`${file} (${sizeMB.toFixed(2)} MB)`);
    exceeded = true;
  }
});

const report = {
  totalSizeMB: totalSize,
  exceeded,
  largeFiles,
  timestamp: new Date().toISOString(),
  files: fileData
};

writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Bundle Size Report</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f4f7f6; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    tr.error { background-color: #fee; color: #c00; }
    .summary { font-size: 1.2em; margin-bottom: 20px; font-weight: bold; }
    .status-ok { color: green; }
    .status-fail { color: red; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Bundle Size Report</h1>
    <div class="summary">
      Total Size: ${totalSize.toFixed(2)} MB / ${TOTAL_BUNDLE_LIMIT_MB} MB
      <span class="${totalSize > TOTAL_BUNDLE_LIMIT_MB ? 'status-fail' : 'status-ok'}">
        (${totalSize > TOTAL_BUNDLE_LIMIT_MB ? 'EXCEEDED' : 'OK'})
      </span>
    </div>
    <table>
      <thead>
        <tr><th>File</th><th>Size (MB)</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${Object.entries(fileData).sort((a,b) => b[1] - a[1]).map(([name, size]) => `
          <tr class="${size > MAX_CHUNK_SIZE_MB ? 'error' : ''}">
            <td>${name}</td>
            <td>${size.toFixed(2)}</td>
            <td>${size > MAX_CHUNK_SIZE_MB ? '❌ TOO LARGE' : '✅ OK'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

writeFileSync(htmlReportPath, htmlContent);
console.log(`HTML Report saved to ${htmlReportPath}`);

if (exceeded) {
  process.exit(1);
}
