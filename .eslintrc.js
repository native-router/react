module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  globals: {
    __DEV__: true
  },
  plugins: ['prettier'],
  extends: ['airbnb', 'airbnb-typescript', 'plugin:compat/recommended', 'eslint-config-prettier'],
  rules: {
    'prettier/prettier': 'error',
    'react/jsx-props-no-spreading': 'off',
    'no-return-assign': ['error', 'except-parens'],
    'no-shadow': 'off',
    'no-plusplus': 'off',
    'no-param-reassign': 'off',
    'react/require-default-props': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-use-before-define': ['error', {functions: false}],
    "import/no-extraneous-dependencies": ["error", {"devDependencies": ["{demos,test}/**/*"]}],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  },
  settings: {
    'import/resolver': 'eslint-import-resolver-typescript',
    'polyfills': [
      // App which dependence this lib should pollyfill these methods:
      'Promise',
    ]
  },
  parserOptions: {
    project: './tsconfig.json'
  }
};
