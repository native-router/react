module.exports = {
  extension: ['js', 'ts', 'tsx'],
  recursive: true,
  exclude: ['mock', 'typings', 'fixtures'],
  'node-option': ['experimental-loader=./loader.mjs'],
  require: ['global-jsdom/register', 'should', 'should-sinon', 'test/global-polyfill.js']
}
