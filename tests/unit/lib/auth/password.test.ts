/**
 * Unit Tests for Password Hashing and Validation
 * Tests hashPassword, verifyPassword, validatePasswordStrength,
 * generateSecurePassword, needsRehash, and isValidBcryptHash
 */

import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  getPasswordRequirements,
  needsRehash,
  generateSecurePassword,
  isValidBcryptHash,
} from '@/lib/auth/password'

describe('Password Module', () => {
  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const result = validatePasswordStrength('MyStr0ng!Pass')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty password', () => {
      const result = validatePasswordStrength('')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must be a non-empty string')
    })

    it('should reject password shorter than minimum length', () => {
      const result = validatePasswordStrength('Ab1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('at least 8 characters')])
      )
    })

    it('should reject password exceeding maximum length', () => {
      const longPassword = 'A1!' + 'a'.repeat(130)
      const result = validatePasswordStrength(longPassword)
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('not exceed 128 characters')])
      )
    })

    it('should reject password without uppercase letter', () => {
      const result = validatePasswordStrength('mystrongpassword1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('uppercase')])
      )
    })

    it('should reject password without lowercase letter', () => {
      const result = validatePasswordStrength('MYSTRONGPASSWORD1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('lowercase')])
      )
    })

    it('should reject password without number', () => {
      const result = validatePasswordStrength('MyStrongPassword!')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('number')])
      )
    })

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('MyStrongPassword1')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('special character')])
      )
    })

    it('should detect common weak patterns - repeated chars', () => {
      const result = validatePasswordStrength('aaaaaaaaaa')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('common weak patterns')])
      )
    })

    it('should accept custom requirements', () => {
      const result = validatePasswordStrength('simplepass', {
        minLength: 6,
        maxLength: 20,
        requireUppercase: false,
        requireLowercase: true,
        requireNumber: false,
        requireSpecial: false,
      })
      expect(result.valid).toBe(true)
    })

    it('should return multiple errors for very weak password', () => {
      const result = validatePasswordStrength('abc')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const hash = await hashPassword('MyStr0ng!Pass')
      expect(hash).toBeDefined()
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
      expect(hash.length).toBe(60)
    })

    it('should produce different hashes for the same password', async () => {
      const hash1 = await hashPassword('MyStr0ng!Pass')
      const hash2 = await hashPassword('MyStr0ng!Pass')
      expect(hash1).not.toBe(hash2)
    })

    it('should reject empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('non-empty string')
    })

    it('should reject weak password', async () => {
      await expect(hashPassword('weak')).rejects.toThrow('Password validation failed')
    })

    it('should accept custom salt rounds', async () => {
      const hash = await hashPassword('MyStr0ng!Pass', 4)
      expect(hash).toMatch(/^\$2[aby]\$04\$/)
    }, 10000)

    it('should reject invalid salt rounds', async () => {
      await expect(hashPassword('MyStr0ng!Pass', 3)).rejects.toThrow('Salt rounds')
      await expect(hashPassword('MyStr0ng!Pass', 32)).rejects.toThrow('Salt rounds')
      await expect(hashPassword('MyStr0ng!Pass', 5.5)).rejects.toThrow('Salt rounds')
    })
  })

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const hash = await hashPassword('MyStr0ng!Pass')
      const isValid = await verifyPassword('MyStr0ng!Pass', hash)
      expect(isValid).toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const hash = await hashPassword('MyStr0ng!Pass')
      const isValid = await verifyPassword('WrongPassword1!', hash)
      expect(isValid).toBe(false)
    })

    it('should return false for empty password', async () => {
      const isValid = await verifyPassword('', '$2a$12$validhashformat')
      expect(isValid).toBe(false)
    })

    it('should return false for empty hash', async () => {
      const isValid = await verifyPassword('MyStr0ng!Pass', '')
      expect(isValid).toBe(false)
    })

    it('should return false for invalid hash format', async () => {
      const isValid = await verifyPassword('MyStr0ng!Pass', 'not-a-valid-hash')
      expect(isValid).toBe(false)
    })

    it('should return false for null-like inputs', async () => {
      const isValid1 = await verifyPassword(null as any, 'hash')
      const isValid2 = await verifyPassword('pass', null as any)
      expect(isValid1).toBe(false)
      expect(isValid2).toBe(false)
    })
  })

  describe('getPasswordRequirements', () => {
    it('should return default requirements', () => {
      const reqs = getPasswordRequirements()
      expect(reqs.minLength).toBe(8)
      expect(reqs.maxLength).toBe(128)
      expect(reqs.requireUppercase).toBe(true)
      expect(reqs.requireLowercase).toBe(true)
      expect(reqs.requireNumber).toBe(true)
      expect(reqs.requireSpecial).toBe(true)
    })
  })

  describe('needsRehash', () => {
    it('should return true for hash with low rounds', () => {
      // bcrypt hash with 4 rounds (below default 12)
      const lowRoundsHash = '$2a$04$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      expect(needsRehash(lowRoundsHash)).toBe(true)
    })

    it('should return false for hash with current rounds', () => {
      const currentRoundsHash = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      expect(needsRehash(currentRoundsHash)).toBe(false)
    })

    it('should return false for hash with higher rounds', () => {
      const highRoundsHash = '$2a$14$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      expect(needsRehash(highRoundsHash)).toBe(false)
    })

    it('should return false for invalid hash', () => {
      expect(needsRehash('not-a-hash')).toBe(false)
      expect(needsRehash('')).toBe(false)
      expect(needsRehash(null as any)).toBe(false)
    })
  })

  describe('generateSecurePassword', () => {
    it('should generate password of default length', () => {
      const password = generateSecurePassword()
      expect(password.length).toBe(16)
    })

    it('should generate password of custom length', () => {
      const password = generateSecurePassword(20)
      expect(password.length).toBe(20)
    })

    it('should include required character types', () => {
      const password = generateSecurePassword(20)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    })

    it('should generate unique passwords', () => {
      const passwords = new Set<string>()
      for (let i = 0; i < 10; i++) {
        passwords.add(generateSecurePassword())
      }
      expect(passwords.size).toBe(10)
    })

    it('should reject length below minimum', () => {
      expect(() => generateSecurePassword(4)).toThrow('at least')
    })

    it('should reject length above maximum', () => {
      expect(() => generateSecurePassword(200)).toThrow('not exceed')
    })

    it('should generate passwords that pass validation', () => {
      for (let i = 0; i < 5; i++) {
        const password = generateSecurePassword(16)
        const result = validatePasswordStrength(password)
        expect(result.valid).toBe(true)
      }
    })
  })

  describe('isValidBcryptHash', () => {
    it('should accept valid bcrypt hash with $2a$', () => {
      expect(isValidBcryptHash('$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true)
    })

    it('should accept valid bcrypt hash with $2b$', () => {
      expect(isValidBcryptHash('$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true)
    })

    it('should accept valid bcrypt hash with $2y$', () => {
      expect(isValidBcryptHash('$2y$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true)
    })

    it('should reject invalid formats', () => {
      expect(isValidBcryptHash('not-a-hash')).toBe(false)
      expect(isValidBcryptHash('')).toBe(false)
      expect(isValidBcryptHash(null)).toBe(false)
      expect(isValidBcryptHash(undefined)).toBe(false)
      expect(isValidBcryptHash(123)).toBe(false)
    })

    it('should reject hash with wrong length', () => {
      expect(isValidBcryptHash('$2a$12$tooshort')).toBe(false)
    })

    it('should reject hash with invalid variant', () => {
      expect(isValidBcryptHash('$2c$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false)
    })

    it('should reject hash with invalid rounds', () => {
      expect(isValidBcryptHash('$2a$03$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false)
      expect(isValidBcryptHash('$2a$32$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false)
    })
  })
})
