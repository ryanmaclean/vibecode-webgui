/**
 * Manual mock for Node.js crypto module
 * Used in SAML authentication tests
 */

// Import the actual crypto module for functions we don't need to mock
const actualCrypto = jest.requireActual('crypto')

// Mock randomBytes to return deterministic values for testing
const randomBytes = (size) => {
  const buf = Buffer.alloc(size)
  // Use deterministic values for testing (not cryptographically secure!)
  for (let i = 0; i < size; i++) {
    buf[i] = (i * 37 + 42) % 256 // Deterministic but looks random
  }
  return buf
}

module.exports = {
  ...actualCrypto,
  randomBytes
}
