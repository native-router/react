import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', 'test/ssr.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 30,
      functions: 30,
      branches: 30,
      statements: 30
    }
  },
  resolve: {
    alias: {
      '@native-router/react/server': path.resolve(
        __dirname,
        './src/server.tsx'
      ),
      '@native-router/react': path.resolve(__dirname, './src/index.tsx'),
      '@@': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './demos')
    }
  }
});
