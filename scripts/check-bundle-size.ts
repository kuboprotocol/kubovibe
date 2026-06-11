import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist/assets');
const MAX_CHUNK_SIZE_MB = 4.5; // Slightly above our largest vendor chunk

console.log('Validating bundle sizes...');

if (!existsSync(distDir)) {
  console.error('❌ dist/assets directory not found!');
  process.exit(1);
}

const files = readdirSync(distDir);
let totalSize = 0;
let exceeded = false;

files.forEach(file => {
  const filePath = join(distDir, file);
  const stats = statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  totalSize += sizeMB;

  if (sizeMB > MAX_CHUNK_SIZE_MB) {
    console.error(`❌ File ${file} exceeds maximum chunk size: ${sizeMB.toFixed(2)}MB > ${MAX_CHUNK_SIZE_MB}MB`);
    exceeded = true;
  }
});

console.log(`Total bundle size: ${totalSize.toFixed(2)}MB`);

if (exceeded) {
  process.exit(1);
}

console.log('✅ Bundle size validation successful!');
