import {existsSync} from 'fs';
import path from 'path';
import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// CI checks out this package alone, so the sibling core repo is absent there.
// Probe for it before aliasing: when present (local monorepo) tests exercise
// the latest core source; when absent, imports fall back to the registry
// package in node_modules instead of failing on a nonexistent path.
const hasCoreSource = existsSync(path.resolve(dirname, '../core/src/index.ts'));

// Guard tests intentionally let anchor clicks keep the browser default, which
// makes jsdom attempt a real navigation and spams stderr with "Not implemented:
// navigation (except hash changes)". Passing a VirtualConsole through
// `environmentOptions.jsdom` is not an option: vitest structured-clones the
// test config to its worker pool and EventEmitter instances are not cloneable
// (every pool then dies with "could not be cloned"). Vitest relays worker
// stderr into this process' stderr instead, so filtering at that relay is the
// only single-file, dependency-free interception point.
const relayStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((
  chunk: string | Uint8Array,
  encoding?: BufferEncoding,
  callback?: (error?: Error | null) => void
) => {
  const text =
    typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  // Drop only the known-benign jsdom navigation error; forward everything else.
  if (text.includes('Not implemented: navigation')) {
    callback?.();
    return true;
  }
  return relayStderrWrite(chunk, encoding, callback);
}) as typeof process.stderr.write;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', 'test/ssr.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30
      }
    }
  },
  resolve: {
    alias: {
      // Resolve core to its source in the sibling repo so integration tests
      // always exercise the latest core code instead of a stale dist build.
      // The 'util' key must stay before the bare package name: alias matching
      // follows insertion order.
      ...(hasCoreSource
        ? {
            '@native-router/core/util': path.resolve(
              dirname,
              '../core/src/util.ts'
            ),
            '@native-router/core': path.resolve(dirname, '../core/src/index.ts')
          }
        : {}),
      '@native-router/react/server': path.resolve(dirname, './src/server.tsx'),
      '@native-router/react': path.resolve(dirname, './src/index.tsx'),
      '@@': path.resolve(dirname, './src'),
      '@': path.resolve(dirname, './demos')
    }
  }
});
