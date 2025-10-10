import bcrypt from 'bcryptjs'

const BCRYPT_HASH_REGEX = /^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/
const DEFAULT_SALT_ROUNDS = 12
const MIN_SALT_ROUNDS = 4
const MAX_SALT_ROUNDS = 31

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const normalizeHash = (hash: string): string => hash.trim()

const assertValidSaltRounds = (value: number): void => {
  if (!Number.isInteger(value) || value < MIN_SALT_ROUNDS || value > MAX_SALT_ROUNDS) {
    throw new Error(`Salt rounds must be an integer between ${MIN_SALT_ROUNDS} and ${MAX_SALT_ROUNDS}`)
  }
}

export const isValidBcryptHash = (hash: string): boolean => {
  if (typeof hash !== 'string') {
    return false
  }

  const candidate = normalizeHash(hash)
  return BCRYPT_HASH_REGEX.test(candidate)
}

export const hashPassword = async (plain: string, saltRounds: number = DEFAULT_SALT_ROUNDS): Promise<string> => {
  if (!isNonEmptyString(plain)) {
    throw new Error('Password must be a non-empty string')
  }

  assertValidSaltRounds(saltRounds)

  return bcrypt.hash(plain, saltRounds)
}

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  if (!isNonEmptyString(plain) || !isNonEmptyString(hash)) {
    return false
  }

  const normalizedHash = normalizeHash(hash)

  if (!isValidBcryptHash(normalizedHash)) {
    return false
  }

  try {
    return await bcrypt.compare(plain, normalizedHash)
  } catch {
    return false
  }
}

export { DEFAULT_SALT_ROUNDS as PASSWORD_HASH_ROUNDS }
export default verifyPassword
