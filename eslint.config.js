import eslint from '@eslint/js';
// Drop-in replacement for eslint-plugin-react: that plugin calls ESLint
// APIs removed in v10 (context.getFilename) and has no compatible release
// yet (jsx-eslint/eslint-plugin-react#4018).
import eslintReact from '@eslint-react/eslint-plugin';
import compat from 'eslint-plugin-compat';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const production = process.env.NODE_ENV === 'production';

export default [
  {
    ignores: [
      'dist',
      // Playground code, not part of the published package.
      'demos',
      // Legacy Node ESM loader hook for the demos playground(own compact
      // style, predates the flat-config toolchain).
      'loader.mjs',
      // Legacy mocha-style files, not collected by vitest nor type-checked.
      'test/index.tsx',
      'test/util.ts'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {...globals.browser, ...globals.node, __DEV__: 'readonly'}
    },
    settings: {
      'import-x/resolver': {typescript: true},
      // Apps depending on this lib should polyfill these methods:
      polyfills: ['Promise']
    },
    rules: {
      // TypeScript itself reports undefined identifiers; the rule
      // misfires on type-only globals in .ts files.
      'no-undef': 'off',
      'no-console': production ? 'error' : 'warn',
      'no-debugger': production ? 'error' : 'off',
      'no-use-before-define': ['error', {functions: false}],
      '@typescript-eslint/no-use-before-define': ['error', {functions: false}],
      'no-return-assign': ['error', 'except-parens'],
      // Both settings below mirror the previous airbnb-based config so the
      // ESLint 10 migration does not tighten project conventions.
      'no-cond-assign': ['error', 'except-parens'],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-shadow': 'off',
      'no-plusplus': 'off',
      'no-param-reassign': 'off'
    }
  },
  // Plain JS files(test/global-polyfill.js, this config): no TS rules.
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked
  },
  importX.configs['flat/recommended'],
  reactHooks.configs.flat['recommended-latest'],
  // Turn off @eslint-react's copies of the react-hooks rules; the dedicated
  // react-hooks plugin above already reports them.
  eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
  jsxA11y.flatConfigs.recommended,
  compat.configs['flat/recommended'],
  eslintReact.configs.recommended,
  prettierRecommended,
  {
    rules: {
      // Library targets react 17-19: 'use'/'<Context>' rendering are
      // react-19-only APIs, so the modern-style suggestions do not apply.
      '@eslint-react/no-use-context': 'off',
      '@eslint-react/no-context-provider': 'off',
      // Duplicate of react-hooks/exhaustive-deps(the dedicated plugin's
      // report is the authoritative one).
      '@eslint-react/exhaustive-deps': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      'prettier/prettier': 'error',
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '{demos,test}/**/*',
            'vitest.config.ts',
            'vite.config.ts',
            'eslint.config.js'
          ]
        }
      ]
    }
  }
];
