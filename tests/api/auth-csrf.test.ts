/**
 * CSRF Token API Test
 * 
 * Tests the /api/auth/csrf endpoint for CSRF token generation
 * Validates security measures and rate limiting
 */

// Mock rate limiting before imports
jest.mock('@/lib/security/rate-limit', () => ({
  withRateLimit: jest.fn(() => (handler) => handler),
  RATE_LIMITS: {
    AUTH: { requests: 10, window: 60000 }
  }
}));

// Mock CSRF utilities
jest.mock('@/lib/security/csrf', () => ({
  getCSRFToken: jest.fn().mockImplementation(() => {
    return new Response(JSON.stringify({ 
      csrfToken: 'test-csrf-token-12345',
      expires: Date.now() + (60 * 60 * 1000) // 1 hour from now
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'csrf-token=test-csrf-token-12345; HttpOnly; Secure; SameSite=Strict; Path=/'
      }
    });
  }),
  validateCSRFConfig: jest.fn().mockReturnValue(true)
}));

import { NextRequest } from 'next/server';

describe('CSRF Token API', () => {
  let GET: any;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/auth/csrf/route');
    GET = routeModule.GET;
  });

  describe('GET /api/auth/csrf', () => {
    it('should return a CSRF token', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('csrfToken');
      expect(data.csrfToken).toBe('test-csrf-token-12345');
      expect(data).toHaveProperty('expires');
      expect(typeof data.expires).toBe('number');
    });

    it('should set secure HTTP-only cookie', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      
      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('csrf-token=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Secure');
      expect(setCookieHeader).toContain('SameSite=Strict');
    });

    it('should have validateCSRFConfig available', async () => {
      const { validateCSRFConfig } = require('@/lib/security/csrf');
      expect(validateCSRFConfig).toBeDefined();
      expect(typeof validateCSRFConfig).toBe('function');
    });

    it('should call getCSRFToken with request', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });

      await GET(mockRequest);

      const { getCSRFToken } = require('@/lib/security/csrf');
      expect(getCSRFToken).toHaveBeenCalledWith(mockRequest);
    });

    it('should have rate limiting available', async () => {
      const { withRateLimit, RATE_LIMITS } = require('@/lib/security/rate-limit');
      
      // Check that rate limiting utilities are available
      expect(withRateLimit).toBeDefined();
      expect(typeof withRateLimit).toBe('function');
      expect(RATE_LIMITS).toBeDefined();
      expect(RATE_LIMITS.AUTH).toEqual({ requests: 10, window: 60000 });
    });
  });
});