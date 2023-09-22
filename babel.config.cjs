module.exports = {
  presets: [
    '@babel/typescript',
    [
      '@babel/preset-react',
      {
        runtime: 'automatic' // defaults to classic
      }
    ]
  ],
  env: {
    test: {
      presets: [
        ['@linaria'],
        // ['@babel/env', {targets: {node: true}, modules: 'commonjs'}],
        ['@babel/env', {targets: {node: true}, modules: false}],
        '@babel/typescript',
        [
          '@babel/preset-react',
          {
            runtime: 'automatic' // defaults to classic
          }
        ]
      ],
      plugins: [
        [
          'module-resolver',
          {
            alias: {
              '@native-router/react': `${__dirname}/src/index.tsx`,
              // '@native-router/core': `@native-router/core/dist/index.mjs`,
              // '@native-router/core/util': `@native-router/core/dist/util.mjs`,
              '^@@/(.*)': `${__dirname}/src/\\1`,
              '^@/(.*)': `${__dirname}/demos/\\1`
            },
            extensions: ['.ts', '.tsx', '.js', '.jsx']
          }
        ]
      ]
    },
    production: {
      presets: [
        ['@babel/env', {modules: false}],
        '@babel/typescript',
        [
          '@babel/preset-react',
          {
            runtime: 'automatic' // defaults to classic
          }
        ]
      ]
    }
  }
};
