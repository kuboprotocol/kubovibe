import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      enabled: true,
      provider: 'istanbul', // Using istanbul for better compatibility if v8 fails
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/bullets',
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      include: ['src/test/markdown-bullets.test.ts'],
    },
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/bullets-results.json',
    },
  },
});

