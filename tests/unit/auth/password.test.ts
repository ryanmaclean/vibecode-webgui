import { hashPassword, verifyPassword, isValidBcryptHash } from '@/lib/auth/password'

describe('auth/password utilities', () => {
  describe('hashPassword', () => {
    it('produces a bcrypt hash that verifies with the original password', async () => {
      const password = 'Str0ng-P@ssword!'
      const hash = await hashPassword(password)

      expect(hash).toMatch(/^\$2[aby]\$12\$/)
      await expect(verifyPassword(password, hash)).resolves.toBe(true)
    })

    it('rejects empty password input', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string')
    })
  })

  describe('verifyPassword', () => {
    it('returns false when the password does not match', async () => {
      const hash = await hashPassword('OriginalP@ssw0rd')
      await expect(verifyPassword('DifferentP@ssw0rd', hash)).resolves.toBe(false)
    })

    it('returns false for an invalid hash input without throwing', async () => {
      await expect(verifyPassword('some-password', 'not-a-bcrypt-hash')).resolves.toBe(false)
    })

    it('trims incoming hashes before validation', async () => {
      const password = 'TrimTest#123'
      const hash = await hashPassword(password)
      await expect(verifyPassword(password, `  ${hash}\n`)).resolves.toBe(true)
    })
  })

  describe('isValidBcryptHash', () => {
    it('identifies valid bcrypt hashes', async () => {
      const hash = await hashPassword('AnotherP@ssw0rd')
      expect(isValidBcryptHash(hash)).toBe(true)
    })

    it('returns false for malformed hashes', () => {
      const invalidSamples = ['not-a-hash', '$2a$03$toolowroundsrestofhash', '']
      invalidSamples.forEach((sample) => {
        expect(isValidBcryptHash(sample)).toBe(false)
      })
    })

    it('treats hashes with surrounding whitespace as valid after trimming', async () => {
      const hash = await hashPassword('Whitespace#456')
      expect(isValidBcryptHash(`\n${hash}  `)).toBe(true)
    })
  })
})
