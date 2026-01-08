/**
 * Unit tests for CSP Report API Route
 * Tests Content Security Policy violation reporting
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/security/csp-report/route';

// Helper function to create a mock NextRequest
function createMockRequest(url: string, body: any): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
      'x-forwarded-for': '192.168.1.100'
    },
    body: JSON.stringify(body)
  });
}

describe('/api/security/csp-report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/security/csp-report', () => {
    const validCSPReport = {
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'referrer': '',
        'violated-directive': 'script-src',
        'effective-directive': 'script-src',
        'original-policy': "default-src 'self'",
        'blocked-uri': 'https://evil.com/script.js',
        'line-number': 10,
        'column-number': 5,
        'source-file': 'https://example.com/app.js',
        'status-code': 200
      }
    };

    it('should accept and record valid CSP violation reports', async () => {
      const request = createMockRequest('http://localhost:3000/api/security/csp-report', validCSPReport);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('recorded');
    });

    it('should reject reports without csp-report object', async () => {
      const invalidReport = {
        'violated-directive': 'script-src'
        // Missing 'csp-report' wrapper
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', invalidReport);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('missing csp-report object');
    });

    it('should reject reports exceeding 10KB', async () => {
      const largeReport = {
        'csp-report': {
          'document-uri': 'a'.repeat(15000), // Exceeds 10KB limit
          'violated-directive': 'script-src'
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', largeReport);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toContain('exceeds 10KB limit');
    });

    it('should truncate long field values', async () => {
      const reportWithLongValues = {
        'csp-report': {
          'document-uri': 'a'.repeat(1000), // Will be truncated
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js'
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', reportWithLongValues);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('recorded');
    });

    it('should extract client IP from x-forwarded-for', async () => {
      const request = new NextRequest('http://localhost:3000/api/security/csp-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1, 198.51.100.1'
        },
        body: JSON.stringify(validCSPReport)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should extract client IP from x-real-ip as fallback', async () => {
      const request = new NextRequest('http://localhost:3000/api/security/csp-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '203.0.113.1'
        },
        body: JSON.stringify(validCSPReport)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle Cloudflare IP header', async () => {
      const request = new NextRequest('http://localhost:3000/api/security/csp-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.1'
        },
        body: JSON.stringify(validCSPReport)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/security/csp-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: 'invalid json {'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Failed to process report');
    });

    it('should validate CSP report structure', async () => {
      const reportWithInvalidTypes = {
        'csp-report': {
          'document-uri': 123, // Should be string
          'line-number': 'not a number' // Should be number
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', reportWithInvalidTypes);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid CSP report format');
      expect(data.details).toBeDefined();
    });

    it('should allow optional fields', async () => {
      const minimalReport = {
        'csp-report': {
          'violated-directive': 'script-src'
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', minimalReport);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('recorded');
    });

    it('should handle script-src violations', async () => {
      const scriptSrcViolation = {
        'csp-report': {
          'violated-directive': 'script-src',
          'blocked-uri': 'https://malicious.com/script.js'
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', scriptSrcViolation);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle style-src violations', async () => {
      const styleSrcViolation = {
        'csp-report': {
          'violated-directive': 'style-src',
          'blocked-uri': 'inline'
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', styleSrcViolation);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should handle img-src violations', async () => {
      const imgSrcViolation = {
        'csp-report': {
          'violated-directive': 'img-src',
          'blocked-uri': 'https://tracker.com/pixel.png'
        }
      };

      const request = createMockRequest('http://localhost:3000/api/security/csp-report', imgSrcViolation);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });
});
