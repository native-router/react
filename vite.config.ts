/* eslint-disable import/no-extraneous-dependencies */

import * as path from 'path';
import { defineConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react'
import linaria from '@linaria/rollup';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'native-router-react',
        replacement: `${path.join(__dirname, 'src/index.tsx')}`,
      },
      {
        find: /^@\/(.*)/,
        replacement: `${path.join(__dirname, 'demos/$1')}`,
      },
      {
        find: /^@@\/(.*)/,
        replacement: `${path.join(__dirname, 'src/$1')}`,
      },
    ],
  },
  esbuild: false,
  build: {
    target: false, // skip vite:esbuild-transpile
    sourcemap: true,
    lib: {
      name: 'native-router-react',
      entry: 'src/index.tsx',
    },
    rollupOptions: {
      external: id => !(id.startsWith('.') || id.startsWith('@@/') || id.startsWith(__dirname + '/src')),
    },
  },
  server: {
    open: '/demos/'
  },
  plugins: [
    react({
      exclude: ['node_modules/**'],
      babel: {
        configFile: true,
        babelrc: true,
      }
    }),
    {
      apply: 'serve',
      ...linaria({
        sourceMap: true,
        exclude: ['node_modules/**'],
      }),
    } as PluginOption,
  ],
});
