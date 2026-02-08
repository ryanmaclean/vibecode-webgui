/**
 * Tests for src/lib/auth/jwt-utils.ts
 * Token extraction and AuthenticationError class (pure functions)
 * JWT verification tests use controlled mocking
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { extractToken, AuthenticationError } from '@/lib/auth/jwt-utils';

describe('JWT Utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('AuthenticationError', () => {
    it('should create error with code and details', () => {
      const err = new AuthenticationError('test msg', 'TEST_CODE', { foo: 'bar' });
      expect(err.message).toBe('test msg');
      expect(err.code).toBe('TEST_CODE');
      expect(err.details).toEqual({ foo: 'bar' });
      expect(err.name).toBe('AuthenticationError');
      expect(err).toBeInstanceOf(Error);
    });

    it('should create error without details', () => {
      const err = new AuthenticationError('no details', 'NO_DETAILS');
      expect(err.details).toBeUndefined();
    });

    it('should be catchable as Error', () => {
      try {
        throw new AuthenticationError('fail', 'FAIL');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(AuthenticationError);
      }
    });

    it('should preserve stack trace', () => {
      const err = new AuthenticationError('test', 'TEST');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AuthenticationError');
    });
  });

  describe('extractToken', () => {
    it('should return env token when VIBECODE_TOKEN is set', () => {
      process.env.VIBECODE_TOKEN = 'env-token-value';
      expect(extractToken()).toBe('env-token-value');
    });

    it('should trim whitespace from env token', () => {
      process.env.VIBECODE_TOKEN = '  env-token  ';
      expect(extractToken()).toBe('env-token');
    });

    it('should return null when no token available', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken()).toBeNull();
    });

    it('should return null for empty env token', () => {
      process.env.VIBECODE_TOKEN = '   ';
      expect(extractToken()).toBeNull();
    });

    it('should return token from params.token', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken({ token: 'param-token' })).toBe('param-token');
    });

    it('should return token from params.authToken', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken({ authToken: 'auth-param-token' })).toBe('auth-param-token');
    });

    it('should prefer env token over params', () => {
      process.env.VIBECODE_TOKEN = 'env-token';
      expect(extractToken({ token: 'param-token' })).toBe('env-token');
    });

    it('should return null when params token is empty string', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken({ token: '' })).toBeNull();
    });

    it('should return null when params token is not a string', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken({ token: 123 })).toBeNull();
    });

    it('should return null when params is undefined', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken(undefined)).toBeNull();
    });

    it('should return null when params has no token keys', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken({ other: 'value' })).toBeNull();
    });

    it('should trim param token value', () => {
      delete process.env.VIBECODE_TOKEN;
      expect(extractToken({ token: '  my-token  ' })).toBe('my-token');
    });

    it('should handle params with both token and authToken (prefers token)', () => {
      delete process.env.VIBECODE_TOKEN;
      // The || operator means token is preferred when both truthy
      const result = extractToken({ token: 'token-a', authToken: 'token-b' });
      expect(result).toBe('token-a');
    });

    it('should fall back to authToken when token is falsy', () => {
      delete process.env.VIBECODE_TOKEN;
      const result = extractToken({ token: '', authToken: 'fallback' });
      expect(result).toBe('fallback');
    });
  });

  describe('verifyJwtToken', () => {
    it('should throw when no secret is configured', async () => {
      delete process.env.NEXTAUTH_SECRET;
      const { verifyJwtToken } = await import('@/lib/auth/jwt-utils');
      await expect(verifyJwtToken('some-token')).rejects.toThrow('JWT secret not configured');
    });

    it('should throw when token is empty', async () => {
      process.env.NEXTAUTH_SECRET = 'a-secret-that-is-at-least-32-characters-long';
      const { verifyJwtToken } = await import('@/lib/auth/jwt-utils');
      await expect(verifyJwtToken('')).rejects.toThrow('Authentication token is required');
    });

    it('should throw when token is not a string', async () => {
      process.env.NEXTAUTH_SECRET = 'a-secret-that-is-at-least-32-characters-long';
      const { verifyJwtToken } = await import('@/lib/auth/jwt-utils');
      await expect(verifyJwtToken(null as any)).rejects.toThrow('Authentication token is required');
    });

    it('should throw when token is undefined', async () => {
      process.env.NEXTAUTH_SECRET = 'a-secret-that-is-at-least-32-characters-long';
      const { verifyJwtToken } = await import('@/lib/auth/jwt-utils');
      await expect(verifyJwtToken(undefined as any)).rejects.toThrow('Authentication token is required');
    });
  });

  describe('authenticateRequest', () => {
    it('should throw AUTH_REQUIRED when no token is found', async () => {
      delete process.env.VIBECODE_TOKEN;
      const { authenticateRequest } = await import('@/lib/auth/jwt-utils');
      try {
        await authenticateRequest();
        expect(true).toBe(false); // should not reach
      } catch (err: any) {
        expect(err.code).toBe('AUTH_REQUIRED');
        expect(err.message).toContain('Authentication required');
      }
    });

    it('should throw AUTH_REQUIRED with empty params', async () => {
      delete process.env.VIBECODE_TOKEN;
      const { authenticateRequest } = await import('@/lib/auth/jwt-utils');
      try {
        await authenticateRequest({});
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe('AUTH_REQUIRED');
      }
    });

    it('should throw AUTH_REQUIRED with hint in message', async () => {
      delete process.env.VIBECODE_TOKEN;
      const { authenticateRequest } = await import('@/lib/auth/jwt-utils');
      try {
        await authenticateRequest();
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.details.hint).toContain('VIBECODE_TOKEN');
        expect(err.details.sources).toBeInstanceOf(Array);
        expect(err.details.sources.length).toBe(3);
      }
    });
  });
});
