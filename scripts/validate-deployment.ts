import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist');
const indexFile = join(distDir, 'index.html');

console.log('Validating deployment artifacts...');

if (!existsSync(distDir)) {
  console.error('❌ dist directory not found. Run the production build first.');
  process.exit(1);
}

if (!existsSync(indexFile)) {
  console.error('❌ index.html not found in dist directory.');
  process.exit(1);
}

const indexHtml = readFileSync(indexFile, 'utf-8');

const requiredMarkers = [
  { label: 'app root', pattern: /<div\s+id=["']root["']/i },
  { label: 'responsive viewport', pattern: /<meta\s+name=["']viewport["']/i },
  { label: 'document title', pattern: /<title>.*<\/title>/i },
];

const missingMarkers = requiredMarkers.filter(({ pattern }) => !pattern.test(indexHtml));

if (missingMarkers.length > 0) {
  console.error(
    `❌ Deployment validation failed. Missing: ${missingMarkers.map(({ label }) => label).join(', ')}`,
  );
  process.exit(1);
}

console.log('✅ Deployment validation successful!');