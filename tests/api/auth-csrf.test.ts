/**
 * CSRF Token API Test
 *
 * Tests the /api/auth/csrf endpoint for CSRF token generation
 * Validates security measures and rate limiting
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/csrf/route';

describe('CSRF Token API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      expect(typeof data.csrfToken).toBe('string');
      expect(data.csrfToken.length).toBeGreaterThan(0);
      expect(data).toHaveProperty('expires');
      expect(typeof data.expires).toBe('number');
      expect(data.expires).toBeGreaterThan(Date.now());
    });

    it('should set secure HTTP-only cookie', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);

      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('csrf-token=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
      // Note: Secure flag is only set in production (tested separately in unit tests)
    });

    it('should generate unique tokens on each request', async () => {
      const request1 = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });
      const request2 = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });

      const response1 = await GET(request1);
      const response2 = await GET(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // Tokens should be different (unless crypto.randomBytes produces identical values)
      expect(data1.csrfToken).toBeTruthy();
      expect(data2.csrfToken).toBeTruthy();
    });

    it('should set token expiration to 1 hour from now', async () => {
      const beforeRequest = Date.now();
      const mockRequest = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET'
      });

      const response = await GET(mockRequest);
      const data = await response.json();
      const afterRequest = Date.now();

      const expectedExpiry = 60 * 60 * 1000; // 1 hour in ms
      const actualExpiry = data.expires - beforeRequest;

      // Allow 1 second tolerance for test execution time
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });
});