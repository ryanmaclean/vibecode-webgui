/**
 * @jest-environment node
 */

/**
 * Unit tests for CSRF Token API Route
 * Tests CSRF token generation and validation
 */

import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/auth/csrf/route';

// Mock CSRF protection utilities
jest.mock('@/lib/security/csrf-protection', () => ({
  generateCSRFToken: jest.fn(),
  getSessionId: jest.fn()
}));

// Helper function to create a mock NextRequest
function createMockRequest(url: string = 'http://localhost:3000/api/auth/csrf'): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'user-agent': 'test-agent',
    },
  });
}

describe('/api/auth/csrf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getSessionId, generateCSRFToken } = require('@/lib/security/csrf-protection');
    getSessionId.mockReturnValue('session-123');
    generateCSRFToken.mockReturnValue('csrf-token-abc123');
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/auth/csrf', () => {
    it('should generate CSRF token successfully', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.csrfToken).toBe('csrf-token-abc123');
      expect(data.expires).toBeDefined();
      expect(typeof data.expires).toBe('number');
    });

    it('should call getSessionId with request', async () => {
      const { getSessionId } = require('@/lib/security/csrf-protection');
      const request = createMockRequest();
      await GET(request);

      expect(getSessionId).toHaveBeenCalledWith(request);
    });

    it('should call generateCSRFToken with session ID', async () => {
      const { generateCSRFToken } = require('@/lib/security/csrf-protection');
      const request = createMockRequest();
      await GET(request);

      expect(generateCSRFToken).toHaveBeenCalledWith('session-123');
    });

    it('should set expires to 1 hour from now', async () => {
      const beforeTime = Date.now();
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();
      const afterTime = Date.now();

      const oneHour = 60 * 60 * 1000;
      expect(data.expires).toBeGreaterThanOrEqual(beforeTime + oneHour);
      expect(data.expires).toBeLessThanOrEqual(afterTime + oneHour + 100); // Small buffer
    });

    it('should set CSRF token cookie with httpOnly flag', async () => {
      const request = createMockRequest();
      const response = await GET(request);

      // Check Set-Cookie header
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('csrf-token=');
      expect(setCookie).toContain('HttpOnly');
    });

    it('should set secure flag in production', async () => {
      process.env.NODE_ENV = 'production';

      const request = createMockRequest();
      const response = await GET(request);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toContain('Secure');
    });

    it('should set SameSite=Strict', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toContain('SameSite=Strict');
    });

    it('should set cookie path to /', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toContain('Path=/');
    });

    it('should set Max-Age to 1 hour', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toContain('Max-Age=3600');
    });

    it('should handle CSRF token generation errors', async () => {
      const { generateCSRFToken } = require('@/lib/security/csrf-protection');
      generateCSRFToken.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate CSRF token');
    });

    it('should handle session ID retrieval errors', async () => {
      const { getSessionId } = require('@/lib/security/csrf-protection');
      getSessionId.mockImplementation(() => {
        throw new Error('Session ID retrieval failed');
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate CSRF token');
    });

    it('should return JSON content type', async () => {
      const request = createMockRequest();
      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('OPTIONS /api/auth/csrf', () => {
    it('should handle CORS preflight', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
    });

    it('should set CORS headers', async () => {
      const response = await OPTIONS();

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should return null body for OPTIONS', async () => {
      const response = await OPTIONS();
      const body = await response.text();

      // NextResponse with null body returns string "null" when calling .text()
      expect(body).toBe('null');
    });
  });
});
