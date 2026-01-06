// Manual mock for speakeasy - used in MFA tests
// Note: Cannot use jest.fn() here as it's not available during module factory
const secret = {
  base32: 'MOCKBASE32SECRET',
  otpauth_url: 'otpauth://totp/TestApp:user@example.com?secret=MOCKBASE32SECRET&issuer=TestApp',
  ascii: 'mock ascii secret',
  hex: 'mockhexsecret'
}

// State for verify return value - defaults to successful verification
let verifyReturnValue = { delta: 0 }

const totp = {
  verify: (options) => {
    // Return current value
    const currentValue = verifyReturnValue
    // Reset to default after each call for test isolation
    verifyReturnValue = { delta: 0 }
    return currentValue
  },
  generate: (secret) => '123456',
  // Helper to allow tests to change return value for next call
  __setVerifyReturnValue: (value) => {
    verifyReturnValue = value
  }
}

module.exports = {
  generateSecret: (options) => secret,
  totp
}
