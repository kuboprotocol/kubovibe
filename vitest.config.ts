import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/bullets-results.json',
    },
  },
});
