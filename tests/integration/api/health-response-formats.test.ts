/**
 * API Health Response Format Validation Tests
 *
 * Validates the response format and structure of health check endpoints
 * to ensure API contract compliance and consistency.
 */

import { NextRequest } from 'next/server';
import { GET as healthHandler } from '@/app/api/health/route';
import { GET as healthzHandler } from '@/app/api/healthz/route';
import { GET as readyzHandler } from '@/app/api/readyz/route';

// Helper function to create a mock NextRequest
function createMockRequest(url: string = 'http://localhost:3000/api/health'): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
    },
  });
}

describe('API Health Response Format Validation', () => {
  describe('/api/health response format', () => {
    it('should match expected schema structure', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Top-level required fields
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('responseTime');

      // Type validation
      expect(typeof data.status).toBe('string');
      expect(typeof data.timestamp).toBe('string');
      expect(typeof data.uptime).toBe('number');
      expect(typeof data.version).toBe('string');
      expect(typeof data.environment).toBe('string');
      expect(typeof data.checks).toBe('object');
      expect(typeof data.responseTime).toBe('string');
    });

    it('should have correctly structured checks object', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      const requiredChecks = ['memory', 'disk', 'database', 'valkey', 'ai'];

      requiredChecks.forEach(checkName => {
        expect(data.checks).toHaveProperty(checkName);
        expect(data.checks[checkName]).toHaveProperty('status');
        expect(typeof data.checks[checkName].status).toBe('string');
      });
    });

    it('should have correctly structured memory check', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      const memCheck = data.checks.memory;
      expect(memCheck).toHaveProperty('status');
      expect(memCheck).toHaveProperty('details');

      const details = memCheck.details;
      expect(details).toHaveProperty('used');
      expect(details).toHaveProperty('total');
      expect(details).toHaveProperty('percentage');

      // All should be strings with units
      expect(typeof details.used).toBe('string');
      expect(details.used).toMatch(/^\d+MB$/);
      expect(typeof details.total).toBe('string');
      expect(details.total).toMatch(/^\d+MB$/);
      expect(typeof details.percentage).toBe('string');
      expect(details.percentage).toMatch(/^\d+%$/);
    });

    it('should have response time in correct format', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Should be a string ending with 'ms'
      expect(data.responseTime).toMatch(/^\d+ms$/);

      const responseTimeMs = parseInt(data.responseTime);
      expect(responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should have valid status values', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      const validStatuses = ['healthy', 'unhealthy', 'degraded', 'warning'];
      expect(validStatuses).toContain(data.status);
    });

    it('should have valid environment values', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      const validEnvironments = ['development', 'test', 'production', 'staging'];
      expect(validEnvironments).toContain(data.environment);
    });
  });

  describe('/api/healthz response format', () => {
    it('should match expected minimal schema', async () => {
      const response = await healthzHandler(createMockRequest('http://localhost:3000/api/healthz'));
      const data = await response.json();

      // Response is wrapped in success envelope: { success, data, meta }
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');

      // Data payload should have status
      expect(data.data).toHaveProperty('status');

      // Type validation
      expect(typeof data.data.status).toBe('string');
      expect(typeof data.meta.timestamp).toBe('string');
    });

    it('should have valid status value', async () => {
      const response = await healthzHandler(createMockRequest('http://localhost:3000/api/healthz'));
      const data = await response.json();

      // Response is wrapped in success envelope
      expect(data.data.status).toBe('healthy');
    });

    it('should have ISO 8601 timestamp', async () => {
      const response = await healthzHandler(createMockRequest('http://localhost:3000/api/healthz'));
      const data = await response.json();

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(data.meta.timestamp).toMatch(isoRegex);
    });
  });

  describe('/api/readyz response format', () => {
    it('should match expected minimal schema', async () => {
      const response = await readyzHandler(createMockRequest('http://localhost:3000/api/readyz'));
      const data = await response.json();

      // Response is wrapped in success envelope: { success, data, meta }
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');

      // Data payload should have status
      expect(data.data).toHaveProperty('status');

      // Type validation
      expect(typeof data.data.status).toBe('string');
      expect(typeof data.meta.timestamp).toBe('string');
    });

    it('should have valid status value', async () => {
      const response = await readyzHandler(createMockRequest('http://localhost:3000/api/readyz'));
      const data = await response.json();

      // Response is wrapped in success envelope
      expect(data.data.status).toBe('ready');
    });

    it('should have ISO 8601 timestamp', async () => {
      const response = await readyzHandler(createMockRequest('http://localhost:3000/api/readyz'));
      const data = await response.json();

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(data.meta.timestamp).toMatch(isoRegex);
    });
  });

  describe('Timestamp format validation', () => {
    it('should generate RFC 3339 compliant timestamps', async () => {
      const responses = await Promise.all([
        healthHandler(createMockRequest('http://localhost:3000/api/health')),
        healthzHandler(createMockRequest('http://localhost:3000/api/healthz')),
        readyzHandler(createMockRequest('http://localhost:3000/api/readyz'))
      ]);

      const timestamps = await Promise.all(
        responses.map(async r => {
          const data = await r.json();
          // /api/health returns timestamp at top level, /api/healthz and /api/readyz use meta.timestamp
          return data.timestamp || data.meta?.timestamp;
        })
      );

      timestamps.forEach(timestamp => {
        // RFC 3339 / ISO 8601 format
        const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        expect(timestamp).toMatch(rfc3339Regex);

        // Should be parseable
        const date = new Date(timestamp);
        expect(date.getTime()).toBeGreaterThan(0);
        expect(isNaN(date.getTime())).toBe(false);
      });
    });

    it('should have millisecond precision', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Should include milliseconds
      expect(data.timestamp).toMatch(/\.\d{3}Z$/);
    });

    it('should use UTC timezone', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Should end with 'Z' indicating UTC
      expect(data.timestamp).toMatch(/Z$/);
    });
  });

  describe('Numeric field validation', () => {
    it('should have non-negative numeric values', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Uptime
      expect(data.uptime).toBeGreaterThanOrEqual(0);

      // Memory details are strings with units - parse them
      const mem = data.checks.memory.details;
      const usedMB = parseInt(mem.used);
      const totalMB = parseInt(mem.total);
      const percentage = parseInt(mem.percentage);

      expect(usedMB).toBeGreaterThan(0);
      expect(totalMB).toBeGreaterThan(0);
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it('should have reasonable memory values', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      const mem = data.checks.memory.details;
      const usedMB = parseInt(mem.used);
      const totalMB = parseInt(mem.total);

      // Used should not exceed total
      expect(usedMB).toBeLessThanOrEqual(totalMB);

      // Values should be reasonable (not terabytes)
      expect(usedMB).toBeLessThan(100000); // Less than 100GB
      expect(totalMB).toBeLessThan(100000); // Less than 100GB
    });
  });

  describe('String field validation', () => {
    it('should have non-empty string values', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      expect(data.status.length).toBeGreaterThan(0);
      expect(data.timestamp.length).toBeGreaterThan(0);
      expect(data.version.length).toBeGreaterThan(0);
      expect(data.environment.length).toBeGreaterThan(0);
      expect(data.responseTime.length).toBeGreaterThan(0);
    });

    it('should not have whitespace-only values', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      expect(data.status.trim().length).toBe(data.status.length);
      expect(data.version.trim().length).toBe(data.version.length);
      expect(data.environment.trim().length).toBe(data.environment.length);
    });
  });

  describe('API contract consistency', () => {
    it('should maintain consistent field order', async () => {
      const response1 = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data1 = await response1.json();
      const keys1 = Object.keys(data1);

      const response2 = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data2 = await response2.json();
      const keys2 = Object.keys(data2);

      expect(keys1).toEqual(keys2);
    });

    it('should not include null values where not expected', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Top-level fields should not be null
      expect(data.status).not.toBeNull();
      expect(data.timestamp).not.toBeNull();
      expect(data.uptime).not.toBeNull();
      expect(data.version).not.toBeNull();
      expect(data.environment).not.toBeNull();
      expect(data.checks).not.toBeNull();
      expect(data.responseTime).not.toBeNull();
    });

    it('should be backward compatible with previous versions', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Essential fields that should always exist
      const essentialFields = [
        'status',
        'timestamp',
        'uptime',
        'version',
        'environment'
      ];

      essentialFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });
    });
  });

  describe('Content type validation', () => {
    it('should return JSON content type', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const contentType = response.headers.get('content-type');

      expect(contentType).toBeTruthy();
      expect(contentType).toContain('application/json');
    });

    it('should be parseable as JSON', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const text = await response.text();

      // Should be valid JSON
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  describe('Schema validation across all endpoints', () => {
    it('should all return valid JSON objects', async () => {
      const endpoints = [
        { name: 'health', handler: healthHandler, url: 'http://localhost:3000/api/health' },
        { name: 'healthz', handler: healthzHandler, url: 'http://localhost:3000/api/healthz' },
        { name: 'readyz', handler: readyzHandler, url: 'http://localhost:3000/api/readyz' }
      ];

      for (const endpoint of endpoints) {
        const response = await endpoint.handler(createMockRequest(endpoint.url));
        const data = await response.json();

        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();
        expect(Array.isArray(data)).toBe(false);
      }
    });

    it('should all include status and timestamp fields', async () => {
      const endpoints = [
        { handler: healthHandler, url: 'http://localhost:3000/api/health', useDirectAccess: true },
        { handler: healthzHandler, url: 'http://localhost:3000/api/healthz', useDirectAccess: false },
        { handler: readyzHandler, url: 'http://localhost:3000/api/readyz', useDirectAccess: false }
      ];

      for (const endpoint of endpoints) {
        const response = await endpoint.handler(createMockRequest(endpoint.url));
        const data = await response.json();

        // /api/health returns status/timestamp at top level
        // /api/healthz and /api/readyz use success envelope with data.status and meta.timestamp
        if (endpoint.useDirectAccess) {
          expect(data).toHaveProperty('status');
          expect(data).toHaveProperty('timestamp');
          expect(typeof data.status).toBe('string');
          expect(typeof data.timestamp).toBe('string');
        } else {
          expect(data.data).toHaveProperty('status');
          expect(data.meta).toHaveProperty('timestamp');
          expect(typeof data.data.status).toBe('string');
          expect(typeof data.meta.timestamp).toBe('string');
        }
      }
    });

    it('should have consistent timestamp formats', async () => {
      const responses = await Promise.all([
        healthHandler(createMockRequest('http://localhost:3000/api/health')),
        healthzHandler(createMockRequest('http://localhost:3000/api/healthz')),
        readyzHandler(createMockRequest('http://localhost:3000/api/readyz'))
      ]);

      const timestamps = await Promise.all(
        responses.map(async r => {
          const data = await r.json();
          // /api/health returns timestamp at top level, /api/healthz and /api/readyz use meta.timestamp
          return data.timestamp || data.meta?.timestamp;
        })
      );

      // All should match the same format
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      timestamps.forEach(timestamp => {
        expect(timestamp).toMatch(isoRegex);
      });
    });
  });

  describe('Version format validation', () => {
    it('should follow semantic versioning', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Should be semver format (X.Y.Z)
      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
      expect(data.version).toMatch(semverRegex);
    });
  });

  describe('Memory metrics validation', () => {
    it('should report memory in consistent units', async () => {
      const response = await healthHandler(createMockRequest('http://localhost:3000/api/health'));
      const data = await response.json();

      // Checks memory is returned as strings with MB suffix
      const checkMem = data.checks.memory.details;
      expect(typeof checkMem.used).toBe('string');
      expect(checkMem.used).toMatch(/^\d+MB$/);
      expect(typeof checkMem.total).toBe('string');
      expect(checkMem.total).toMatch(/^\d+MB$/);
      expect(typeof checkMem.percentage).toBe('string');
      expect(checkMem.percentage).toMatch(/^\d+%$/);

      // Parse and verify they are valid numbers
      const usedMB = parseInt(checkMem.used);
      const totalMB = parseInt(checkMem.total);
      expect(Number.isInteger(usedMB)).toBe(true);
      expect(Number.isInteger(totalMB)).toBe(true);
      expect(usedMB).toBeGreaterThan(0);
      expect(totalMB).toBeGreaterThan(0);
    });
  });
});

/**
 * Response Format Test Coverage:
 *
 * ✅ Schema validation
 *    - Correct structure for all endpoints
 *    - Required fields present
 *    - Correct data types
 *
 * ✅ Timestamp validation
 *    - RFC 3339 / ISO 8601 compliance
 *    - Millisecond precision
 *    - UTC timezone
 *
 * ✅ Numeric validation
 *    - Non-negative values
 *    - Reasonable ranges
 *    - Consistent reporting
 *
 * ✅ String validation
 *    - Non-empty values
 *    - No whitespace-only values
 *
 * ✅ API contract
 *    - Consistent field order
 *    - No unexpected nulls
 *    - Backward compatibility
 *
 * ✅ Content type
 *    - Correct JSON content type
 *    - Parseable JSON
 *
 * ✅ Cross-endpoint consistency
 *    - Common fields present
 *    - Consistent formats
 *
 * ✅ Version format
 *    - Semantic versioning
 *
 * ✅ Memory metrics
 *    - Consistent units
 *    - Reasonable values
 */
