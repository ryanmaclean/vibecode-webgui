import { hashPassword, isValidBcryptHash, verifyPassword } from '@/lib/auth/password'

describe('auth password utilities', () => {
  const bcryptPattern = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/
  const testPassword = 'SecureTest123!'

  it('hashPassword returns a bcrypt hash with the default rounds', async () => {
    const hash = await hashPassword(testPassword)

    expect(hash).toMatch(bcryptPattern)
    expect(isValidBcryptHash(hash)).toBe(true)
  })

  it('verifyPassword resolves true when hash matches the plaintext', async () => {
    const hash = await hashPassword(testPassword)

    await expect(verifyPassword(testPassword, hash)).resolves.toBe(true)
  })

  it('verifyPassword resolves false when the password is wrong', async () => {
    const hash = await hashPassword(testPassword)

    await expect(verifyPassword('WrongPassword123!', hash)).resolves.toBe(false)
  })

  it('verifyPassword rejects when the hash is not a bcrypt hash', async () => {
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash'))
      .rejects.toThrow('Invalid bcrypt hash format')
  })

  it('isValidBcryptHash accurately validates hashes', async () => {
    const validHash = await hashPassword(testPassword, 12)

    expect(isValidBcryptHash(validHash)).toBe(true)
    expect(isValidBcryptHash('')).toBe(false)
    expect(isValidBcryptHash('$2b$03$tooLowRoundsxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(false)
    expect(isValidBcryptHash('$2y$12$short')).toBe(false)
    expect(isValidBcryptHash('plain-text-password')).toBe(false)
  })

  it('hashPassword throws for invalid inputs', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string')
    await expect(hashPassword('ValidPass123!', 2)).rejects.toThrow('Salt rounds must be an integer between')
  })
})
