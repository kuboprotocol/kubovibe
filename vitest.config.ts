import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/bullets-results.json',
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage/bullets',
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  },

});
