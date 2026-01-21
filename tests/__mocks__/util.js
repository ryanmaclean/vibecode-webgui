/**
 * Partial mock for Node.js 'util' module
 * Provides test-friendly utilities while preserving most functionality
 */

// Import the actual util module
const actualUtil = jest.requireActual('util');

// Re-export everything from the actual module
// This ensures all util functions work as normal unless explicitly overridden
module.exports = {
  ...actualUtil,

  // util functions are generally safe to use as-is
  // We're not overriding anything here, but the mock exists
  // in case specific tests need to override behaviors via jest.spyOn()
};
