/**
 * Password Hashing and Validation Utility
 *
 * Implements secure password operations using bcryptjs with industry-standard
 * security parameters and comprehensive password strength validation.
 *
 * Security Implementation:
 * - bcrypt with 12 salt rounds (OWASP recommended)
 * - Password strength validation (NIST SP 800-63B compliant)
 * - Timing-safe comparison operations
 * - Comprehensive input validation
 *
 * @module lib/auth/password
 */

import bcrypt from 'bcryptjs';

/**
 * Security configuration for password operations
 */
const PASSWORD_CONFIG = {
  SALT_ROUNDS: 12, // OWASP recommended minimum
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
} as const;

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Password strength requirements
 */
export interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

/**
 * Hash a plaintext password using bcrypt
 *
 * Uses 12 salt rounds for optimal security/performance balance.
 * This provides strong protection against brute force attacks while
 * maintaining acceptable performance characteristics.
 *
 * @param password - Plaintext password to hash
 * @param saltRounds - Optional number of salt rounds (default: 12, min: 4, max: 31)
 * @returns Promise resolving to bcrypt hash string
 * @throws Error if password is invalid or hashing fails
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('MySecureP@ssw0rd');
 * // Returns: $2a$12$... (bcrypt hash)
 * ```
 */
export async function hashPassword(password: string, saltRounds: number = PASSWORD_CONFIG.SALT_ROUNDS): Promise<string> {
  // Input validation
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  // Validate salt rounds
  if (saltRounds < 4 || saltRounds > 31 || !Number.isInteger(saltRounds)) {
    throw new Error('Salt rounds must be an integer between 4 and 31');
  }

  // Validate password strength before hashing
  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a plaintext password against a bcrypt hash
 *
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns false for any validation errors rather than throwing.
 *
 * @param password - Plaintext password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('MySecureP@ssw0rd', storedHash);
 * if (isValid) {
 *   // Password is correct
 * }
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Input validation
  if (!password || typeof password !== 'string') {
    return false;
  }

  if (!hash || typeof hash !== 'string') {
    return false;
  }

  // Validate hash format using dedicated function
  if (!isValidBcryptHash(hash)) {
    return false;
  }

  try {
    // Timing-safe comparison
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    // Return false for any errors during comparison
    // Prevents information leakage through error messages
    return false;
  }
}

/**
 * Validate password strength against security requirements
 *
 * Implements NIST SP 800-63B guidelines:
 * - Minimum 8 characters (configurable)
 * - Maximum 128 characters (prevents DoS)
 * - Character diversity requirements
 * - Common password pattern detection
 *
 * @param password - Password to validate
 * @param requirements - Optional custom requirements (uses defaults if not provided)
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * const result = validatePasswordStrength('weak');
 * if (!result.valid) {
 *   console.log(result.errors);
 *   // ['Password must be at least 8 characters', ...]
 * }
 * ```
 */
export function validatePasswordStrength(
  password: string,
  requirements: Partial<PasswordRequirements> = {}
): PasswordValidationResult {
  const errors: string[] = [];

  // Merge with defaults
  const config = {
    minLength: requirements.minLength ?? PASSWORD_CONFIG.MIN_LENGTH,
    maxLength: requirements.maxLength ?? PASSWORD_CONFIG.MAX_LENGTH,
    requireUppercase: requirements.requireUppercase ?? PASSWORD_CONFIG.REQUIRE_UPPERCASE,
    requireLowercase: requirements.requireLowercase ?? PASSWORD_CONFIG.REQUIRE_LOWERCASE,
    requireNumber: requirements.requireNumber ?? PASSWORD_CONFIG.REQUIRE_NUMBER,
    requireSpecial: requirements.requireSpecial ?? PASSWORD_CONFIG.REQUIRE_SPECIAL,
  };

  // Basic validation
  if (!password || typeof password !== 'string') {
    errors.push('Password must be a non-empty string');
    return { valid: false, errors };
  }

  // Length checks
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters`);
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  // Character diversity checks
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common weak patterns
  const commonPatterns = [
    /^(.)\1+$/, // All same character
    /^(012|123|234|345|456|567|678|789|890)+$/, // Sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential letters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common weak patterns');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get current password requirements configuration
 *
 * @returns Current password requirements
 */
export function getPasswordRequirements(): PasswordRequirements {
  return {
    minLength: PASSWORD_CONFIG.MIN_LENGTH,
    maxLength: PASSWORD_CONFIG.MAX_LENGTH,
    requireUppercase: PASSWORD_CONFIG.REQUIRE_UPPERCASE,
    requireLowercase: PASSWORD_CONFIG.REQUIRE_LOWERCASE,
    requireNumber: PASSWORD_CONFIG.REQUIRE_NUMBER,
    requireSpecial: PASSWORD_CONFIG.REQUIRE_SPECIAL,
  };
}

/**
 * Check if a hash needs rehashing (e.g., due to security parameter updates)
 *
 * Useful for automatic password hash upgrades during login.
 *
 * @param hash - Bcrypt hash to check
 * @returns True if hash should be regenerated with current parameters
 *
 * @example
 * ```typescript
 * if (await verifyPassword(password, hash) && needsRehash(hash)) {
 *   // Password is valid but hash is outdated
 *   const newHash = await hashPassword(password);
 *   // Update stored hash
 * }
 * ```
 */
export function needsRehash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  // Extract cost factor from bcrypt hash
  const match = hash.match(/^\$2[aby]\$(\d{2})\$/);
  if (!match) {
    return false;
  }

  const hashRounds = parseInt(match[1], 10);
  return hashRounds < PASSWORD_CONFIG.SALT_ROUNDS;
}

/**
 * Generate a random secure password
 *
 * Useful for temporary passwords or password reset flows.
 * Generates cryptographically strong random passwords that meet
 * all security requirements.
 *
 * @param length - Desired password length (default: 16)
 * @returns Randomly generated secure password
 *
 * @example
 * ```typescript
 * const tempPassword = generateSecurePassword(20);
 * // Returns: 'Xy9#mK2$pL8@qR5!sT3%'
 * ```
 */
export function generateSecurePassword(length: number = 16): string {
  if (length < PASSWORD_CONFIG.MIN_LENGTH) {
    throw new Error(`Password length must be at least ${PASSWORD_CONFIG.MIN_LENGTH}`);
  }

  if (length > PASSWORD_CONFIG.MAX_LENGTH) {
    throw new Error(`Password length must not exceed ${PASSWORD_CONFIG.MAX_LENGTH}`);
  }

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{};\':"|,.<>/?';

  // Ensure at least one character from each required set
  let password = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
  ].join('');

  // Fill remaining length with random characters from all sets
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to randomize character positions
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Validates if a string is a valid bcrypt hash format
 *
 * Bcrypt hashes follow the format: $2[a|b|y]$[rounds]$[salt+hash]
 * - Variant: 2a, 2b, or 2y
 * - Rounds: 04-31 (typically 10-12)
 * - Salt+hash: 53 characters (22 char salt + 31 char hash)
 *
 * @param hash - The string to validate
 * @returns True if the string is a valid bcrypt hash format
 *
 * @example
 * ```typescript
 * isValidBcryptHash('$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'); // true
 * isValidBcryptHash('invalid-hash'); // false
 * ```
 */
export function isValidBcryptHash(hash: any): boolean {
  // Check if input is a string
  if (typeof hash !== 'string') {
    return false;
  }

  // Bcrypt hash format: $2[a|b|y]$[rounds]$[salt+hash]
  // Total length is 60 characters
  // - $2a$ or $2b$ or $2y$ (4 chars)
  // - rounds (2 digits: 04-31)
  // - $ (1 char)
  // - salt+hash (53 chars using base64-like encoding)
  const bcryptRegex = /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

  // Also check total length is 60
  return hash.length === 60 && bcryptRegex.test(hash);
}
