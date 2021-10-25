module.exports = {
  extension: ['js', 'ts', 'tsx'],
  recursive: true,
  exclude: ['mock', 'typings', 'fixtures'],
  require: ['global-jsdom/register', 'should', 'should-sinon', 'test/babel-register.js']
}
