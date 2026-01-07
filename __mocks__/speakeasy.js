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
    // Return current value without auto-reset
    // Tests should reset via __reset() in beforeEach/afterEach
    return verifyReturnValue
  },
  generate: (secret) => '123456',
  // Helper to allow tests to change return value for next call
  __setVerifyReturnValue: (value) => {
    verifyReturnValue = value
  },
  // Helper to reset to default state (for beforeEach/afterEach)
  __reset: () => {
    verifyReturnValue = { delta: 0 }
  }
}

module.exports = {
  generateSecret: (options) => secret,
  totp
}
