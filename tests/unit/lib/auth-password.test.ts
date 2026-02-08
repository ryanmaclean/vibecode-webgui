/**
 * Tests for src/lib/auth/password.ts
 * Password validation, hash format checking, and utilities
 * Tests pure functions without mocking bcryptjs
 */

import { describe, it, expect } from '@jest/globals';
import {
  validatePasswordStrength,
  getPasswordRequirements,
  needsRehash,
  generateSecurePassword,
  isValidBcryptHash,
} from '@/lib/auth/password';

describe('Password Utils', () => {
  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const result = validatePasswordStrength('MyStr0ng!Pass');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty password', () => {
      const result = validatePasswordStrength('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject null password', () => {
      const result = validatePasswordStrength(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be a non-empty string');
    });

    it('should reject undefined password', () => {
      const result = validatePasswordStrength(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be a non-empty string');
    });

    it('should reject short password', () => {
      const result = validatePasswordStrength('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('at least 8'))).toBe(true);
    });

    it('should reject password exceeding max length', () => {
      const longPassword = 'Aa1!' + 'x'.repeat(130);
      const result = validatePasswordStrength(longPassword);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('exceed'))).toBe(true);
    });

    it('should reject password at exactly max length + 1', () => {
      const password = 'Aa1!' + 'x'.repeat(125); // 129 chars > 128 max
      const result = validatePasswordStrength(password);
      expect(result.valid).toBe(false);
    });

    it('should accept password at exactly max length', () => {
      const password = 'Aa1!' + 'x'.repeat(124); // 128 chars = 128 max
      const result = validatePasswordStrength(password);
      expect(result.valid).toBe(true);
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('mystro0ng!pass');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('MYSTRO0NG!PASS');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('lowercase'))).toBe(true);
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('MyStrong!Pass');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('number'))).toBe(true);
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('MyStr0ngPass');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('special'))).toBe(true);
    });

    it('should detect common weak patterns (all same char)', () => {
      const result = validatePasswordStrength('aaaaaaaa');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('weak patterns'))).toBe(true);
    });

    it('should detect sequential number patterns', () => {
      // Pattern matches groups of 3 sequential digits: 012, 123, 234, etc.
      const result = validatePasswordStrength('012345678');
      expect(result.valid).toBe(false);
      // 012345678 matches 012+345+678 - three sequential groups
      expect(result.errors.some((e: string) => e.includes('weak patterns'))).toBe(true);
    });

    it('should detect sequential letter patterns', () => {
      // Pattern matches groups of 3 sequential letters: abc, bcd, cde, etc.
      const result = validatePasswordStrength('abcdefghi');
      expect(result.valid).toBe(false);
      // abcdefghi = abc+def+ghi
      expect(result.errors.some((e: string) => e.includes('weak patterns'))).toBe(true);
    });

    it('should allow custom requirements - no uppercase', () => {
      const result = validatePasswordStrength('simplepass1!', {
        requireUppercase: false,
      });
      expect(result.valid).toBe(true);
    });

    it('should allow custom requirements - no number', () => {
      const result = validatePasswordStrength('SimplePass!x', {
        requireNumber: false,
      });
      expect(result.valid).toBe(true);
    });

    it('should allow custom requirements - no special', () => {
      const result = validatePasswordStrength('SimplePass1x', {
        requireSpecial: false,
      });
      expect(result.valid).toBe(true);
    });

    it('should allow custom min length', () => {
      const result = validatePasswordStrength('Ab1!', {
        minLength: 4,
      });
      expect(result.valid).toBe(true);
    });

    it('should allow custom max length', () => {
      const result = validatePasswordStrength('Ab1!xyzxyz', {
        maxLength: 10,
      });
      expect(result.valid).toBe(true);
    });

    it('should report multiple errors at once', () => {
      const result = validatePasswordStrength('ab');
      expect(result.valid).toBe(false);
      // Should report: too short, missing uppercase, missing number, missing special
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should accept password with all required char types', () => {
      const result = validatePasswordStrength('aA1!xxxx');
      expect(result.valid).toBe(true);
    });

    it('should handle password with all special characters', () => {
      const result = validatePasswordStrength('aA1!@#$%^');
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidBcryptHash', () => {
    it('should validate correct $2a$ bcrypt hash', () => {
      expect(isValidBcryptHash('$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should validate $2b$ variant', () => {
      expect(isValidBcryptHash('$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should validate $2y$ variant', () => {
      expect(isValidBcryptHash('$2y$10$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should validate hash with low cost factor (04)', () => {
      expect(isValidBcryptHash('$2a$04$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should validate hash with high cost factor (31)', () => {
      expect(isValidBcryptHash('$2a$31$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should reject non-string input', () => {
      expect(isValidBcryptHash(123)).toBe(false);
      expect(isValidBcryptHash(null)).toBe(false);
      expect(isValidBcryptHash(undefined)).toBe(false);
      expect(isValidBcryptHash({})).toBe(false);
      expect(isValidBcryptHash([])).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidBcryptHash('')).toBe(false);
    });

    it('should reject random string', () => {
      expect(isValidBcryptHash('not-a-hash')).toBe(false);
    });

    it('should reject hash with wrong length', () => {
      expect(isValidBcryptHash('$2a$12$short')).toBe(false);
    });

    it('should reject too-low round number (03)', () => {
      expect(isValidBcryptHash('$2a$03$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false);
    });

    it('should reject too-high round number (32)', () => {
      expect(isValidBcryptHash('$2a$32$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false);
    });

    it('should reject invalid variant ($2c$)', () => {
      expect(isValidBcryptHash('$2c$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false);
    });

    it('should reject hash with invalid characters', () => {
      expect(isValidBcryptHash('$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUg!2t0jWMUW')).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('should return true for low-cost hash (08)', () => {
      expect(needsRehash('$2a$08$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should return true for cost 10 (below 12)', () => {
      expect(needsRehash('$2a$10$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(true);
    });

    it('should return false for current-cost hash (12)', () => {
      expect(needsRehash('$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false);
    });

    it('should return false for higher-cost hash (14)', () => {
      expect(needsRehash('$2a$14$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(needsRehash('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(needsRehash(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(needsRehash(undefined as any)).toBe(false);
    });

    it('should return false for invalid hash format', () => {
      expect(needsRehash('not-a-hash')).toBe(false);
    });

    it('should return false for non-bcrypt hash', () => {
      expect(needsRehash('sha256:abcdef1234567890')).toBe(false);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = generateSecurePassword(16);
      expect(password.length).toBe(16);
    });

    it('should generate password of default length (16)', () => {
      const password = generateSecurePassword();
      expect(password.length).toBe(16);
    });

    it('should generate password of minimum length (8)', () => {
      const password = generateSecurePassword(8);
      expect(password.length).toBe(8);
    });

    it('should throw for length below minimum', () => {
      expect(() => generateSecurePassword(4)).toThrow('at least');
    });

    it('should throw for length of 7', () => {
      expect(() => generateSecurePassword(7)).toThrow('at least');
    });

    it('should throw for length above maximum', () => {
      expect(() => generateSecurePassword(200)).toThrow('exceed');
    });

    it('should generate unique passwords', () => {
      const passwords = new Set(Array.from({ length: 10 }, () => generateSecurePassword(20)));
      expect(passwords.size).toBe(10);
    });

    it('should contain at least one uppercase letter', () => {
      // Test multiple times due to randomness
      for (let i = 0; i < 10; i++) {
        const password = generateSecurePassword(20);
        expect(/[A-Z]/.test(password)).toBe(true);
      }
    });

    it('should contain at least one lowercase letter', () => {
      for (let i = 0; i < 10; i++) {
        const password = generateSecurePassword(20);
        expect(/[a-z]/.test(password)).toBe(true);
      }
    });

    it('should contain at least one number', () => {
      for (let i = 0; i < 10; i++) {
        const password = generateSecurePassword(20);
        expect(/[0-9]/.test(password)).toBe(true);
      }
    });

    it('should contain at least one special character', () => {
      for (let i = 0; i < 10; i++) {
        const password = generateSecurePassword(20);
        expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true);
      }
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return current requirements', () => {
      const req = getPasswordRequirements();
      expect(req.minLength).toBe(8);
      expect(req.maxLength).toBe(128);
      expect(req.requireUppercase).toBe(true);
      expect(req.requireLowercase).toBe(true);
      expect(req.requireNumber).toBe(true);
      expect(req.requireSpecial).toBe(true);
    });

    it('should return consistent results on multiple calls', () => {
      const req1 = getPasswordRequirements();
      const req2 = getPasswordRequirements();
      expect(req1).toEqual(req2);
    });
  });
});
