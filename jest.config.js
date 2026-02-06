/** @type {import('jest').Config} */
const baseConfig = require('./config/jest.config.js');

module.exports = {
  ...baseConfig,
  rootDir: __dirname,
};
