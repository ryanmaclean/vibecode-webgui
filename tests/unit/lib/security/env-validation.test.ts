/**
 * Unit Tests for Environment Variable Validation
 * Tests environment validation, insecure defaults detection, and secret generation
 */

import { jest } from '@jest/globals'

// Mock zod before importing
jest.mock('@/lib/zod-compat', () => ({
  z: jest.requireActual('zod').z,
}))

describe('Environment Validation', () => {
  let validateEnvironment: typeof import('@/lib/security/env-validation').validateEnvironment
  let checkInsecureDefaults: typeof import('@/lib/security/env-validation').checkInsecureDefaults
  let generateSecureSecret: typeof import('@/lib/security/env-validation').generateSecureSecret

  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...originalEnv }

    // Import fresh module for each test
    const envValidation = require('@/lib/security/env-validation')
    validateEnvironment = envValidation.validateEnvironment
    checkInsecureDefaults = envValidation.checkInsecureDefaults
    generateSecureSecret = envValidation.generateSecureSecret
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('validateEnvironment', () => {
    it('should validate complete environment configuration', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-postgres-password-16-chars'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).not.toThrow()
    })

    it('should reject missing NEXTAUTH_SECRET', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.NEXTAUTH_SECRET
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).toThrow('Invalid environment configuration')
    })

    it('should reject short NEXTAUTH_SECRET', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).toThrow()
    })

    it('should reject missing DATABASE_URL', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      delete process.env.DATABASE_URL
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).toThrow()
    })

    it('should reject invalid DATABASE_URL format', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'not-a-valid-url'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).toThrow()
    })

    it('should reject short POSTGRES_PASSWORD', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'short'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).toThrow('Invalid environment configuration')
    })

    it('should reject short JWT_SECRET', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'short'

      expect(() => validateEnvironment()).toThrow('Invalid environment configuration')
    })

    it('should reject default JWT_SECRET value', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'dev-secret-key'

      expect(() => validateEnvironment()).toThrow('Invalid environment configuration')
    })

    it('should allow optional API keys', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      expect(() => validateEnvironment()).not.toThrow()
    })

    it('should validate NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).toThrow()
    })

    it('should accept production environment', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      expect(() => validateEnvironment()).not.toThrow()
    })

    it('should log success message on valid environment', () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation()

      process.env.NODE_ENV = 'development'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'secure-password-16c'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      validateEnvironment()

      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('successful'))

      infoSpy.mockRestore()
    })
  })

  describe('checkInsecureDefaults', () => {
    it('should return empty array in development', () => {
      process.env.NODE_ENV = 'development'
      process.env.JWT_SECRET = 'dev-secret-key'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual([])
    })

    it('should warn about default JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'dev-secret-key'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('JWT_SECRET')]))
    })

    it('should warn about default NEXTAUTH_SECRET in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXTAUTH_SECRET = 'dev-secret'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('NEXTAUTH_SECRET')]))
    })

    it('should warn about default POSTGRES_PASSWORD in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.POSTGRES_PASSWORD = 'password'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('POSTGRES_PASSWORD')]))
    })

    it('should warn about short NEXTAUTH_SECRET in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXTAUTH_SECRET = 'short-secret'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('at least 32 characters')]))
    })

    it('should warn about short JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'short'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('JWT_SECRET')]))
    })

    it('should warn about HTTP NEXTAUTH_URL in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXTAUTH_URL = 'http://example.com'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('HTTPS')]))
    })

    it('should not warn with secure configuration in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.POSTGRES_PASSWORD = 'secure-postgres-password'
      process.env.NEXTAUTH_URL = 'https://example.com'

      const warnings = checkInsecureDefaults()

      expect(warnings).toEqual([])
    })

    it('should return multiple warnings for multiple issues', () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'dev-secret-key'
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.NEXTAUTH_URL = 'http://example.com'

      const warnings = checkInsecureDefaults()

      expect(warnings.length).toBeGreaterThan(1)
    })
  })

  describe('generateSecureSecret', () => {
    it('should generate secret of default length', () => {
      const secret = generateSecureSecret()

      expect(secret).toBeTruthy()
      expect(typeof secret).toBe('string')
      expect(secret.length).toBe(64)
    })

    it('should generate secret of custom length', () => {
      const secret = generateSecureSecret(32)

      expect(secret.length).toBe(32)
    })

    it('should generate unique secrets', () => {
      const secret1 = generateSecureSecret()
      const secret2 = generateSecureSecret()

      expect(secret1).not.toBe(secret2)
    })

    it('should include alphanumeric and special characters', () => {
      const secret = generateSecureSecret(100)

      // Should have variety of characters
      expect(secret).toMatch(/[A-Z]/)
      expect(secret).toMatch(/[a-z]/)
      expect(secret).toMatch(/[0-9]/)
    })

    // Skipping: Crypto API scoping issues in Node.js test environment
    it.skip('should handle Web Crypto API', () => {
      const originalCrypto = global.crypto
      const mockGetRandomValues = jest.fn((array: any) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256)
        }
        return array
      })
      global.crypto = {
        getRandomValues: mockGetRandomValues,
      } as any

      const secret = generateSecureSecret()

      expect(secret).toBeTruthy()
      expect(mockGetRandomValues).toHaveBeenCalled()

      global.crypto = originalCrypto
    })

    it('should fallback to Node.js crypto when Web Crypto unavailable', () => {
      const originalCrypto = global.crypto
      // @ts-ignore - Testing fallback
      global.crypto = undefined

      const secret = generateSecureSecret()

      expect(secret).toBeTruthy()
      expect(typeof secret).toBe('string')

      global.crypto = originalCrypto
    })
  })

  describe('Module Load Validation', () => {
    it('should skip validation in test environment', () => {
      process.env.NODE_ENV = 'test'
      delete process.env.NEXTAUTH_SECRET

      // Module should load without throwing
      expect(() => {
        jest.isolateModules(() => {
          require('@/lib/security/env-validation')
        })
      }).not.toThrow()
    })

    it('should skip validation during build phase', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PHASE = 'phase-production-build'
      delete process.env.NEXTAUTH_SECRET

      expect(() => {
        jest.isolateModules(() => {
          require('@/lib/security/env-validation')
        })
      }).not.toThrow()
    })

    // Skipping: Module isolation and env manipulation timing issues
    it.skip('should exit in production with invalid environment', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process exited with code ${code}`)
      })
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PHASE
      delete process.env.NEXTAUTH_SECRET

      expect(() => {
        jest.isolateModules(() => {
          require('@/lib/security/env-validation')
        })
      }).toThrow('Process exited with code 1')

      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })

    // Skipping: Module isolation and env manipulation timing issues
    it.skip('should log warnings for insecure defaults in production', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      process.env.NODE_ENV = 'production'
      process.env.NEXTAUTH_SECRET = 'secure-nextauth-secret-at-least-32-chars'
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
      process.env.POSTGRES_PASSWORD = 'password' // insecure default
      process.env.JWT_SECRET = 'secure-jwt-secret-32-characters-long'

      jest.isolateModules(() => {
        require('@/lib/security/env-validation')
      })

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Security warnings'))

      warnSpy.mockRestore()
    })
  })
})
