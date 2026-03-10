import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 30,
      functions: 30,
      branches: 30,
      statements: 30,
    },
  },
  resolve: {
    alias: {
      '@@': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './demos'),
    },
  },
});
