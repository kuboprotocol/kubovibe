import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    // Os testes de UI/fluxo usam window, sessionStorage e React Testing
    // Library — precisam de um DOM simulado.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ e tests/ são specs do Playwright (rodam com `playwright test`,
    // não com o Vitest); kubo-agent/ tem o próprio toolchain.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'vite-plugins/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'tests/**', 'kubo-agent/**'],
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/bullets-results.json',
    },
    coverage: {
      // Desligada por padrão: o limite de 100% vale para o extrator de
      // bullets, cujo workflow (bullets-ci.yml) liga com `--coverage`.
      enabled: false,
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
