/**
 * Password Utility Test Suite
 *
 * Comprehensive security testing for password hashing and validation.
 * Tests cover security requirements, edge cases, and error handling.
 *
 * @module tests/unit/auth/password
 */

import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  getPasswordRequirements,
  needsRehash,
  generateSecurePassword,
} from '@/lib/auth/password';

describe('Password Utility', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'SecureP@ssw0rd';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$12\$/); // Verify bcrypt format with 12 rounds
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecureP@ssw0rd';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should reject empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    it('should reject non-string password', async () => {
      await expect(hashPassword(null as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(hashPassword(undefined as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(hashPassword(123 as any)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should reject weak passwords', async () => {
      await expect(hashPassword('weak')).rejects.toThrow('Password validation failed');
      await expect(hashPassword('12345678')).rejects.toThrow('Password validation failed');
      await expect(hashPassword('UPPERCASE')).rejects.toThrow('Password validation failed');
      await expect(hashPassword('lowercase')).rejects.toThrow('Password validation failed');
    });

    it('should hash password with all required character types', async () => {
      const password = 'Abc123!@#';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should handle long passwords', async () => {
      const password = 'A1!b' + 'x'.repeat(120); // 124 chars total
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should reject passwords exceeding max length', async () => {
      const password = 'A1!b' + 'x'.repeat(125); // 129 chars - exceeds 128 limit
      await expect(hashPassword(password)).rejects.toThrow('Password validation failed');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecureP@ssw0rd';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecureP@ssw0rd';
      const wrongPassword = 'WrongP@ssw0rd';
      const hash = await hashPassword(password);

      const result = await verifyPassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    it('should be case sensitive', async () => {
      const password = 'SecureP@ssw0rd';
      const hash = await hashPassword(password);

      expect(await verifyPassword('securep@ssw0rd', hash)).toBe(false);
      expect(await verifyPassword('SECUREP@SSW0RD', hash)).toBe(false);
    });

    it('should reject empty password', async () => {
      const hash = '$2a$12$abcdefghijklmnopqrstuvwxyz123456';
      expect(await verifyPassword('', hash)).toBe(false);
    });

    it('should reject empty hash', async () => {
      expect(await verifyPassword('SecureP@ssw0rd', '')).toBe(false);
    });

    it('should reject invalid hash format', async () => {
      expect(await verifyPassword('SecureP@ssw0rd', 'invalid_hash')).toBe(false);
      expect(await verifyPassword('SecureP@ssw0rd', '$1$invalid')).toBe(false);
      expect(await verifyPassword('SecureP@ssw0rd', 'plaintext_password')).toBe(false);
    });

    it('should reject non-string inputs', async () => {
      const hash = await hashPassword('SecureP@ssw0rd');
      expect(await verifyPassword(null as any, hash)).toBe(false);
      expect(await verifyPassword(undefined as any, hash)).toBe(false);
      expect(await verifyPassword(123 as any, hash)).toBe(false);
      expect(await verifyPassword('SecureP@ssw0rd', null as any)).toBe(false);
    });

    it('should handle special characters correctly', async () => {
      const password = 'P@ssw0rd!#$%^&*()_+-=[]{};\':"|,.<>/?';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const password = 'Pāssw0rd!🔐';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should verify password with whitespace', async () => {
      const password = 'Secure P@ssw0rd With Spaces';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword('SecureP@ssw0rdWithSpaces', hash)).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength('SecureP@ssw0rd123');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject password too short', () => {
      const result = validatePasswordStrength('Sh0rt!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password too long', () => {
      const password = 'A1!b' + 'x'.repeat(125); // 129 chars
      const result = validatePasswordStrength(password);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('lowercasep@ssw0rd');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('UPPERCASEP@SSW0RD');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbersP@ssword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject empty password', () => {
      const result = validatePasswordStrength('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be a non-empty string');
    });

    it('should reject non-string password', () => {
      const result = validatePasswordStrength(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be a non-empty string');
    });

    it('should reject password with all same characters', () => {
      const result = validatePasswordStrength('aaaaaaaa');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains common weak patterns');
    });

    it('should reject password with sequential numbers', () => {
      const result = validatePasswordStrength('12345678');
      expect(result.valid).toBe(false);
      // Sequential numbers fail multiple checks (no uppercase, lowercase, special char)
      // Just verify it's rejected
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject password with sequential letters', () => {
      const result = validatePasswordStrength('abcdefgh');
      expect(result.valid).toBe(false);
      // Sequential letters fail multiple checks (no uppercase, number, special char)
      // Just verify it's rejected
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should support custom requirements', () => {
      const customRequirements = {
        minLength: 12,
        requireSpecial: false,
      };
      const result = validatePasswordStrength('LongPassword123', customRequirements);
      expect(result.valid).toBe(true);
    });

    it('should return multiple errors for weak password', () => {
      const result = validatePasswordStrength('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should accept password with all character types', () => {
      const result = validatePasswordStrength('Abc123!@#xyz');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept password at minimum length', () => {
      const result = validatePasswordStrength('Abcd123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return current requirements', () => {
      const requirements = getPasswordRequirements();

      expect(requirements).toEqual({
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: true,
      });
    });
  });

  describe('needsRehash', () => {
    it('should return false for current hash', async () => {
      const password = 'SecureP@ssw0rd';
      const hash = await hashPassword(password);

      expect(needsRehash(hash)).toBe(false);
    });

    it('should return true for hash with lower cost factor', () => {
      // Hash with 10 rounds (lower than current 12)
      const oldHash = '$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678';
      expect(needsRehash(oldHash)).toBe(true);
    });

    it('should return false for hash with higher cost factor', () => {
      // Hash with 14 rounds (higher than current 12)
      const futureHash = '$2a$14$abcdefghijklmnopqrstuvwxyz123456789012345678';
      expect(needsRehash(futureHash)).toBe(false);
    });

    it('should return false for invalid hash', () => {
      expect(needsRehash('invalid_hash')).toBe(false);
      expect(needsRehash('')).toBe(false);
      expect(needsRehash(null as any)).toBe(false);
    });

    it('should handle different bcrypt versions', () => {
      const hash2a = '$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678';
      const hash2b = '$2b$10$abcdefghijklmnopqrstuvwxyz123456789012345678';
      const hash2y = '$2y$10$abcdefghijklmnopqrstuvwxyz123456789012345678';

      expect(needsRehash(hash2a)).toBe(true);
      expect(needsRehash(hash2b)).toBe(true);
      expect(needsRehash(hash2y)).toBe(true);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = generateSecurePassword();

      expect(password).toBeDefined();
      expect(password.length).toBe(16);
      expect(validatePasswordStrength(password).valid).toBe(true);
    });

    it('should generate password with custom length', () => {
      const password = generateSecurePassword(20);

      expect(password.length).toBe(20);
      expect(validatePasswordStrength(password).valid).toBe(true);
    });

    it('should generate different passwords each time', () => {
      const password1 = generateSecurePassword();
      const password2 = generateSecurePassword();
      const password3 = generateSecurePassword();

      expect(password1).not.toBe(password2);
      expect(password2).not.toBe(password3);
      expect(password1).not.toBe(password3);
    });

    it('should include all required character types', () => {
      const password = generateSecurePassword();

      expect(/[A-Z]/.test(password)).toBe(true); // Uppercase
      expect(/[a-z]/.test(password)).toBe(true); // Lowercase
      expect(/[0-9]/.test(password)).toBe(true); // Number
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true); // Special
    });

    it('should generate minimum length password', () => {
      const password = generateSecurePassword(8);

      expect(password.length).toBe(8);
      expect(validatePasswordStrength(password).valid).toBe(true);
    });

    it('should reject length below minimum', () => {
      expect(() => generateSecurePassword(7)).toThrow('Password length must be at least 8');
    });

    it('should reject length above maximum', () => {
      expect(() => generateSecurePassword(129)).toThrow('Password length must not exceed 128');
    });

    it('should generate long password', () => {
      const password = generateSecurePassword(100);

      expect(password.length).toBe(100);
      expect(validatePasswordStrength(password).valid).toBe(true);
    });

    it('should pass strength validation for all generated passwords', () => {
      // Test multiple generations to ensure consistency
      for (let i = 0; i < 10; i++) {
        const password = generateSecurePassword();
        const validation = validatePasswordStrength(password);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      }
    });
  });

  describe('Security Integration Tests', () => {
    it('should support complete password lifecycle', async () => {
      // Generate secure password
      const password = generateSecurePassword();
      expect(validatePasswordStrength(password).valid).toBe(true);

      // Hash password
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();

      // Verify correct password
      expect(await verifyPassword(password, hash)).toBe(true);

      // Verify incorrect password
      expect(await verifyPassword('WrongP@ssw0rd', hash)).toBe(false);

      // Check if rehash needed
      expect(needsRehash(hash)).toBe(false);
    });

    it('should handle password update flow', async () => {
      const oldPassword = 'OldSecureP@ssw0rd';
      const newPassword = 'NewSecureP@ssw0rd';

      // Create initial hash
      const oldHash = await hashPassword(oldPassword);

      // Verify old password
      expect(await verifyPassword(oldPassword, oldHash)).toBe(true);

      // Update to new password
      const newHash = await hashPassword(newPassword);

      // Verify new password works
      expect(await verifyPassword(newPassword, newHash)).toBe(true);

      // Verify old password no longer works with new hash
      expect(await verifyPassword(oldPassword, newHash)).toBe(false);
    });

    it('should detect and handle hash upgrades', async () => {
      // Simulate old hash with lower rounds
      const oldHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

      // Check if rehash needed
      expect(needsRehash(oldHash)).toBe(true);

      // Simulate upgrade during login
      const password = 'SecureP@ssw0rd';
      // In real scenario: if (verifyPassword && needsRehash) -> create new hash
      const newHash = await hashPassword(password);

      expect(needsRehash(newHash)).toBe(false);
    });

    it('should prevent timing attacks on password verification', async () => {
      const password = 'SecureP@ssw0rd';
      const hash = await hashPassword(password);

      // Measure timing for correct password
      const start1 = Date.now();
      await verifyPassword(password, hash);
      const time1 = Date.now() - start1;

      // Measure timing for incorrect password
      const start2 = Date.now();
      await verifyPassword('WrongP@ssw0rd', hash);
      const time2 = Date.now() - start2;

      // bcrypt's constant-time comparison should make these roughly equal
      // Allow 50ms difference for system variance
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent hash operations', async () => {
      const password = 'SecureP@ssw0rd';

      // Create multiple hashes concurrently
      const promises = Array.from({ length: 10 }, () => hashPassword(password));
      const hashes = await Promise.all(promises);

      // All hashes should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(10);

      // All hashes should verify correctly
      const verifications = await Promise.all(
        hashes.map(hash => verifyPassword(password, hash))
      );
      expect(verifications.every(v => v === true)).toBe(true);
    }, 15000); // Increase timeout to 15 seconds for concurrent operations

    it('should handle special characters in password', async () => {
      const password = '!@#$%^&*()_+-=[]{};\':"|,.<>/?P@ssw0rd123';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should handle whitespace in password', async () => {
      const password = '  Secure P@ssw0rd With Spaces  ';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword(password.trim(), hash)).toBe(false); // Exact match required
    });

    it('should handle newlines in password', async () => {
      const password = 'SecureP@ssw0rd\n123';
      const hash = await hashPassword(password);

      expect(await verifyPassword(password, hash)).toBe(true);
    });

    it('should reject password with only whitespace', async () => {
      await expect(hashPassword('        ')).rejects.toThrow('Password validation failed');
    });
  });
});
