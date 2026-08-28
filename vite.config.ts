import * as path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import linaria from '@wyw-in-js/vite';
import type {Plugin} from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const buildDemo = process.env.BUILD_DEMO === 'true';
const isSSR = process.env.SSR === 'true';
const base = buildDemo ? '/react/demos/' : '/demos/';

export default defineConfig({
  base: isSSR ? '/' : base,
  resolve: {
    alias: [
      {
        find: '@native-router/react/server',
        replacement: `${path.join(dirname, 'src/server.tsx')}`
      },
      {
        find: '@native-router/react/ssr',
        replacement: `${path.join(dirname, 'src/ssr.tsx')}`
      },
      {
        find: '@native-router/react',
        replacement: `${path.join(dirname, 'src/index.tsx')}`
      },
      {
        find: /^@\/(.*)/,
        replacement: `${path.join(dirname, 'demos/$1')}`
      },
      {
        find: /^@@\/(.*)/,
        replacement: `${path.join(dirname, 'src/$1')}`
      }
    ]
  },
  // `define` is dropped: in vite 8 it no longer applies to dev client modules.
  // The demos read the base URL from `import.meta.env.BASE_URL` instead.
  oxc: false,
  build: buildDemo
    ? {
        outDir: 'dist/demos'
      }
    : {
        target: false, // skip vite:oxc-transpile
        minify: 'terser',
        sourcemap: true,
        lib: {
          name: '@native-router/react',
          formats: ['es', 'cjs'],
          entry: {
            index: 'src/index.tsx',
            ssr: 'src/ssr.tsx',
            server: 'src/server.tsx'
          }
        },
        rollupOptions: {
          external: (id) =>
            !(
              id.startsWith('.') ||
              id.startsWith('@@/') ||
              id.startsWith(`${dirname}/src`)
            ),
          output: {
            // Preserve the source tree as one file per module instead of
            // pre-bundling into shared hash chunks. A downstream bundler can
            // then tree-shake per module(`sideEffects:false`). Without this,
            // Rollup hoists code shared by the `index`/`ssr`/`server` entries
            // into a single hashed chunk that imports everything together.
            preserveModules: true,
            preserveModulesRoot: 'src'
          }
        }
      },
  server: {
    open: '/demos/'
  },
  plugins: [
    linaria({
      sourceMap: true,
      exclude: ['node_modules/**']
    }),
    react({
      exclude: ['node_modules/**']
      // plugin-react 6 is oxc-based: the old `babel` option is gone. The
      // demo-only babel plugins(jsx-class/jsx-condition) no longer run
      // through this plugin under vite 8.
    }),
    isSSR && ssr()
  ]
});

function ssr(): Plugin {
  return {
    name: 'ssr',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (
          req.headers.accept?.includes('text/html') &&
          !req.url!.includes('?')
        ) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          // dev SSR serves the demo at vite's base ('/' when SSR=true), so the
          // router's baseUrl is the base minus its trailing slash — same rule
          // the client entry derives from import.meta.env.BASE_URL
          const baseUrl = server.config.base.slice(0, -1);
          server
            .ssrLoadModule('/demos/ssr/server-entry.tsx')
            .then((module) => module.default({pathname: req.url}, {baseUrl}))
            .then((view) => {
              const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/src/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Native Router</title>
  </head>
  <body>
    <div id="root">${view}</div>
    <script type="module" src="/demos/ssr/client-entry.tsx"></script>
  </body>
</html>
`;
              server
                .transformIndexHtml(req.url!, html)
                .then((result) => {
                  res.end(result);
                })
                .catch(next);
            })
            .catch(next);
          return;
        }
        next();
      });
    }
  };
}
