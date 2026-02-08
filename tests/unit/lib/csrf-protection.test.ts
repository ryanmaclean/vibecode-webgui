/**
 * Tests for src/lib/security/csrf.ts
 * CSRF protection, token generation, verification, and middleware
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  validateCSRFConfig,
  getCSRFToken,
  verifyCSRFTokenFromRequest,
  withCSRFProtection,
  validateCSRF,
} from '@/lib/security/csrf';
import { NextResponse } from 'next/server';

// Suppress console output
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('CSRF Protection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateCSRFConfig', () => {
    it('should not throw in development with default secret', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CSRF_SECRET;
      expect(() => validateCSRFConfig()).not.toThrow();
    });

    it('should throw in production with default secret', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CSRF_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      expect(() => validateCSRFConfig()).toThrow('CSRF_SECRET');
    });

    it('should not throw in production with custom secret', () => {
      process.env.NODE_ENV = 'production';
      process.env.CSRF_SECRET = 'a-secure-secret-that-is-at-least-32-characters-long-for-production';
      expect(() => validateCSRFConfig()).not.toThrow();
    });

    it('should warn if secret is short', () => {
      process.env.NODE_ENV = 'development';
      process.env.CSRF_SECRET = 'short';
      validateCSRFConfig();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('getCSRFToken', () => {
    it('should return response with csrfToken in body', async () => {
      const req = new NextRequest('http://localhost:3000/api/csrf');
      const response = getCSRFToken(req);
      const body = await response.json();

      expect(body.csrfToken).toBeDefined();
      expect(typeof body.csrfToken).toBe('string');
      expect(body.csrfToken.length).toBe(64); // 32 bytes in hex
    });

    it('should return response with expires timestamp', async () => {
      const req = new NextRequest('http://localhost:3000/api/csrf');
      const response = getCSRFToken(req);
      const body = await response.json();

      expect(body.expires).toBeDefined();
      expect(typeof body.expires).toBe('number');
      expect(body.expires).toBeGreaterThan(Date.now());
    });

    it('should set CSRF cookie on response', () => {
      const req = new NextRequest('http://localhost:3000/api/csrf');
      const response = getCSRFToken(req);
      // NextResponse cookies API stores cookies internally
      const cookie = response.cookies.get('__Secure-csrf-token');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeDefined();
      expect(cookie?.value).toContain('.'); // token.signature format
    });

    it('should generate unique tokens for each call', async () => {
      const req1 = new NextRequest('http://localhost:3000/api/csrf');
      const req2 = new NextRequest('http://localhost:3000/api/csrf');
      const body1 = await getCSRFToken(req1).json();
      const body2 = await getCSRFToken(req2).json();

      expect(body1.csrfToken).not.toBe(body2.csrfToken);
    });
  });

  describe('verifyCSRFTokenFromRequest', () => {
    it('should return false when header is missing', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
      });
      expect(verifyCSRFTokenFromRequest(req)).toBe(false);
    });

    it('should return false when cookie is missing', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'x-csrf-token': 'some-token' },
      });
      expect(verifyCSRFTokenFromRequest(req)).toBe(false);
    });

    it('should return false when cookie format is invalid', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'some-token',
          cookie: '__Secure-csrf-token=no-dot-separator',
        },
      });
      expect(verifyCSRFTokenFromRequest(req)).toBe(false);
    });

    it('should return false for mismatched tokens', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'aaaa',
          cookie: '__Secure-csrf-token=bbbb.cccc',
        },
      });
      expect(verifyCSRFTokenFromRequest(req)).toBe(false);
    });

    it('should return false for empty token parts', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': '',
          cookie: '__Secure-csrf-token=.signature',
        },
      });
      expect(verifyCSRFTokenFromRequest(req)).toBe(false);
    });
  });

  describe('withCSRFProtection', () => {
    it('should bypass CSRF for GET requests', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>()
        .mockResolvedValue(NextResponse.json({ ok: true }));

      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'GET' });

      const response = await protectedHandler(req);
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should bypass CSRF for HEAD requests', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>()
        .mockResolvedValue(NextResponse.json({ ok: true }));

      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'HEAD' });

      await protectedHandler(req);
      expect(handler).toHaveBeenCalled();
    });

    it('should bypass CSRF for OPTIONS requests', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>()
        .mockResolvedValue(NextResponse.json({ ok: true }));

      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'OPTIONS' });

      await protectedHandler(req);
      expect(handler).toHaveBeenCalled();
    });

    it('should reject POST without CSRF token', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>();
      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });

      const response = await protectedHandler(req);
      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });

    it('should reject PUT without CSRF token', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>();
      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'PUT' });

      const response = await protectedHandler(req);
      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });

    it('should reject DELETE without CSRF token', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>();
      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'DELETE' });

      const response = await protectedHandler(req);
      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });

    it('should reject PATCH without CSRF token', async () => {
      const handler = jest.fn<(req: NextRequest) => Promise<NextResponse>>();
      const protectedHandler = withCSRFProtection(handler);
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'PATCH' });

      const response = await protectedHandler(req);
      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });
  });

  describe('validateCSRF', () => {
    it('should return valid=false when no token', () => {
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
      const result = validateCSRF(req);

      expect(result.valid).toBe(false);
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(403);
    });

    it('should include error response with CSRF code', async () => {
      const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
      const result = validateCSRF(req);

      expect(result.valid).toBe(false);
      const body = await result.errorResponse!.json();
      expect(body.code).toBe('CSRF_VALIDATION_FAILED');
    });
  });
});
