import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist/assets');
const MAX_CHUNK_SIZE_MB = 4.0; 
const TOTAL_BUNDLE_LIMIT_MB = 15.0;
const reportPath = join(process.cwd(), 'bundle-size-report.json');

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

writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Report saved to ${reportPath}`);

console.log('--------------------------');
console.log(`Total Bundle Size: ${totalSize.toFixed(2)} MB`);
console.log('--------------------------');

if (exceeded) {
  console.error('❌ FAIL: The following chunks exceed the ${MAX_CHUNK_SIZE_MB}MB limit:');
  largeFiles.forEach(f => console.error(`   - ${f}`));
  console.error('\nAction required: Implement further code splitting or optimize dependencies.');
  process.exit(1);
}

if (totalSize > TOTAL_BUNDLE_LIMIT_MB) {
  console.error(`❌ FAIL: Total bundle size (${totalSize.toFixed(2)}MB) exceeds the ${TOTAL_BUNDLE_LIMIT_MB}MB limit!`);
  process.exit(1);
}

console.log('✅ Bundle size validation successful!');
