import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup/polyfills.ts'],
    globals: true,
    // keep other defaults; this file only ensures the polyfills run before tests
  },
});
