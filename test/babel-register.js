const register = require('@babel/register');

// eslint-disable-next-line no-underscore-dangle
global.__DEV__ = true;

// https://github.com/facebook/react/issues/20756
delete global.MessageChannel;

register({extensions: ['.jsx', '.ts', '.tsx']});
