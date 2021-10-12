module.exports = {
  presets: [
    ['@babel/env', { modules: false, useBuiltIns: 'usage', corejs: 3 }],
    '@babel/typescript',
    [
      '@babel/preset-react',
      {
        runtime: 'automatic', // defaults to classic
      },
    ],
  ],
  env: {
    test: {
      presets: [
        '@babel/typescript',
        ['@babel/env', { targets: { node: true } }],
      ],
    },
    production: {
      presets: [
        ['@babel/env', { modules: false }],
        '@babel/typescript',
        [
          '@babel/preset-react',
          {
            runtime: 'automatic', // defaults to classic
          },
        ],
      ],
    },
  },
};
