/**
 * Partial mock for Node.js 'url' module
 * Provides URL parsing utilities for tests
 */

// Import the actual url module
const actualUrl = jest.requireActual('url');

// Re-export everything from the actual module
// URL parsing should work identically in tests
module.exports = {
  ...actualUrl,

  // All url functions (parse, format, resolve, URL, URLSearchParams, etc.)
  // are preserved from the actual module
};
