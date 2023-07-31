/* eslint-disable import/no-extraneous-dependencies */

import * as path from 'path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import linaria from '@linaria/vite';
import type {Plugin} from 'vite';

const buildDemo = process.env.BUILD_DEMO === 'true';
const isSSR = process.env.SSR === 'true';
const base = buildDemo ? '/native-router-react/demos/' : '/demos/';

export default defineConfig({
  base: isSSR ? '/' : base,
  resolve: {
    alias: [
      {
        find: 'native-router-react/server',
        replacement: `${path.join(__dirname, 'src/server.tsx')}`
      },
      {
        find: 'native-router-react',
        replacement: `${path.join(__dirname, 'src/index.tsx')}`
      },
      {
        find: /^@\/(.*)/,
        replacement: `${path.join(__dirname, 'demos/$1')}`
      },
      {
        find: /^@@\/(.*)/,
        replacement: `${path.join(__dirname, 'src/$1')}`
      }
    ]
  },
  define: {
    'process.env.BASE_URL': JSON.stringify(base)
  },
  esbuild: false,
  build: buildDemo
    ? {
        outDir: 'dist/demos'
      }
    : {
        target: false, // skip vite:esbuild-transpile
        minify: 'terser',
        sourcemap: true,
        lib: {
          name: 'native-router-react',
          formats: ['es'],
          entry: {
            index: 'src/index.tsx',
            server: 'src/server.tsx'
          }
        },
        rollupOptions: {
          external: (id) =>
            !(
              id.startsWith('.') ||
              id.startsWith('@@/') ||
              id.startsWith(`${__dirname}/src`)
            )
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
      exclude: ['node_modules/**'],
      babel: {
        configFile: true,
        babelrc: true
      }
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
          server
            .ssrLoadModule('/demos/ssr/server-entry.tsx')
            .then((module) =>
              module.default({pathname: req.url}, {baseUrl: '/demos'})
            )
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
            });
          return;
        }
        next();
      });
    }
  };
}
