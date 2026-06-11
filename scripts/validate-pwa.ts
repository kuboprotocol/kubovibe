import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist');
const swFile = join(distDir, 'sw.js');
const manifestFile = join(distDir, 'manifest.webmanifest');

console.log('Validating PWA assets...');

if (!existsSync(swFile)) {
  console.error('❌ Service Worker (sw.js) not found in dist directory!');
  process.exit(1);
}

if (!existsSync(manifestFile)) {
  console.error('❌ Web Manifest not found in dist directory!');
  process.exit(1);
}

const swContent = readFileSync(swFile, 'utf-8');
if (swContent.length < 100) {
  console.error('❌ Service Worker seems too small or empty!');
  process.exit(1);
}

// Check for precache manifest in sw.js (standard Workbox pattern)
if (!swContent.includes('self.__WB_MANIFEST') && !swContent.includes('precacheAndRoute')) {
  console.warn('⚠️ Service Worker might not be correctly configured for precaching.');
}

console.log('✅ PWA validation successful!');
