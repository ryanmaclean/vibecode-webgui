/**
 * API Health Response Format Validation Tests
 *
 * Validates the response format and structure of health check endpoints
 * to ensure API contract compliance and consistency.
 */

import { GET as healthHandler } from '@/app/api/health/route';
import { GET as healthzHandler } from '@/app/api/healthz/route';
import { GET as readyzHandler } from '@/app/api/readyz/route';

describe('API Health Response Format Validation', () => {
  describe('/api/health response format', () => {
    it('should match expected schema structure', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Top-level required fields
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('responseTime');
      expect(data).toHaveProperty('performance');

      // Type validation
      expect(typeof data.status).toBe('string');
      expect(typeof data.timestamp).toBe('string');
      expect(typeof data.uptime).toBe('number');
      expect(typeof data.version).toBe('string');
      expect(typeof data.environment).toBe('string');
      expect(typeof data.checks).toBe('object');
      expect(typeof data.responseTime).toBe('string');
      expect(typeof data.performance).toBe('object');
    });

    it('should have correctly structured checks object', async () => {
      const response = await healthHandler();
      const data = await response.json();

      const requiredChecks = ['memory', 'disk', 'database', 'valkey', 'ai'];

      requiredChecks.forEach(checkName => {
        expect(data.checks).toHaveProperty(checkName);
        expect(data.checks[checkName]).toHaveProperty('status');
        expect(typeof data.checks[checkName].status).toBe('string');
      });
    });

    it('should have correctly structured memory check', async () => {
      const response = await healthHandler();
      const data = await response.json();

      const memCheck = data.checks.memory;
      expect(memCheck).toHaveProperty('status');
      expect(memCheck).toHaveProperty('details');

      const details = memCheck.details;
      expect(details).toHaveProperty('used');
      expect(details).toHaveProperty('total');
      expect(details).toHaveProperty('external');
      expect(details).toHaveProperty('rss');

      // All should be numbers
      expect(typeof details.used).toBe('number');
      expect(typeof details.total).toBe('number');
      expect(typeof details.external).toBe('number');
      expect(typeof details.rss).toBe('number');
    });

    it('should have correctly structured performance object', async () => {
      const response = await healthHandler();
      const data = await response.json();

      expect(data.performance).toHaveProperty('responseTime');
      expect(data.performance).toHaveProperty('memoryUsage');

      const memUsage = data.performance.memoryUsage;
      expect(memUsage).toHaveProperty('rss');
      expect(memUsage).toHaveProperty('heapTotal');
      expect(memUsage).toHaveProperty('heapUsed');
      expect(memUsage).toHaveProperty('external');

      // All should be numbers
      expect(typeof memUsage.rss).toBe('number');
      expect(typeof memUsage.heapTotal).toBe('number');
      expect(typeof memUsage.heapUsed).toBe('number');
      expect(typeof memUsage.external).toBe('number');
    });

    it('should have response time in correct format', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Should be a string ending with 'ms'
      expect(data.responseTime).toMatch(/^\d+ms$/);

      // Should also be included as number in performance
      expect(typeof data.performance.responseTime).toBe('number');
    });

    it('should have valid status values', async () => {
      const response = await healthHandler();
      const data = await response.json();

      const validStatuses = ['healthy', 'unhealthy', 'degraded', 'warning'];
      expect(validStatuses).toContain(data.status);
    });

    it('should have valid environment values', async () => {
      const response = await healthHandler();
      const data = await response.json();

      const validEnvironments = ['development', 'test', 'production', 'staging'];
      expect(validEnvironments).toContain(data.environment);
    });
  });

  describe('/api/healthz response format', () => {
    it('should match expected minimal schema', async () => {
      const response = await healthzHandler();
      const data = await response.json();

      // Should only have these fields
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');

      // Type validation
      expect(typeof data.status).toBe('string');
      expect(typeof data.timestamp).toBe('string');

      // Should not have extra fields
      const keys = Object.keys(data);
      expect(keys.length).toBe(2);
    });

    it('should have valid status value', async () => {
      const response = await healthzHandler();
      const data = await response.json();

      expect(data.status).toBe('healthy');
    });

    it('should have ISO 8601 timestamp', async () => {
      const response = await healthzHandler();
      const data = await response.json();

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(data.timestamp).toMatch(isoRegex);
    });
  });

  describe('/api/readyz response format', () => {
    it('should match expected minimal schema', async () => {
      const response = await readyzHandler();
      const data = await response.json();

      // Should only have these fields
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');

      // Type validation
      expect(typeof data.status).toBe('string');
      expect(typeof data.timestamp).toBe('string');

      // Should not have extra fields
      const keys = Object.keys(data);
      expect(keys.length).toBe(2);
    });

    it('should have valid status value', async () => {
      const response = await readyzHandler();
      const data = await response.json();

      expect(data.status).toBe('ready');
    });

    it('should have ISO 8601 timestamp', async () => {
      const response = await readyzHandler();
      const data = await response.json();

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(data.timestamp).toMatch(isoRegex);
    });
  });

  describe('Timestamp format validation', () => {
    it('should generate RFC 3339 compliant timestamps', async () => {
      const responses = await Promise.all([
        healthHandler(),
        healthzHandler(),
        readyzHandler()
      ]);

      const timestamps = await Promise.all(
        responses.map(async r => {
          const data = await r.json();
          return data.timestamp;
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
      const response = await healthHandler();
      const data = await response.json();

      // Should include milliseconds
      expect(data.timestamp).toMatch(/\.\d{3}Z$/);
    });

    it('should use UTC timezone', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Should end with 'Z' indicating UTC
      expect(data.timestamp).toMatch(/Z$/);
    });
  });

  describe('Numeric field validation', () => {
    it('should have non-negative numeric values', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Uptime
      expect(data.uptime).toBeGreaterThanOrEqual(0);

      // Memory details
      expect(data.checks.memory.details.used).toBeGreaterThan(0);
      expect(data.checks.memory.details.total).toBeGreaterThan(0);
      expect(data.checks.memory.details.external).toBeGreaterThanOrEqual(0);
      expect(data.checks.memory.details.rss).toBeGreaterThan(0);

      // Performance metrics
      expect(data.performance.responseTime).toBeGreaterThan(0);
      expect(data.performance.memoryUsage.rss).toBeGreaterThan(0);
      expect(data.performance.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(data.performance.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(data.performance.memoryUsage.external).toBeGreaterThanOrEqual(0);
    });

    it('should have reasonable memory values', async () => {
      const response = await healthHandler();
      const data = await response.json();

      const mem = data.checks.memory.details;

      // Used should not exceed total
      expect(mem.used).toBeLessThanOrEqual(mem.total);

      // RSS should be reasonable (not terabytes)
      expect(mem.rss).toBeLessThan(100000); // Less than 100GB in MB
    });

    it('should have consistent memory reporting', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Memory should be reported in both places
      const checkMem = data.checks.memory.details;
      const perfMem = data.performance.memoryUsage;

      // Performance memory is in bytes, check memory is in MB
      // So convert and compare
      const checkMemInBytes = {
        used: checkMem.used * 1024 * 1024,
        total: checkMem.total * 1024 * 1024,
        external: checkMem.external * 1024 * 1024,
        rss: checkMem.rss * 1024 * 1024
      };

      // Should be approximately equal (within 10% due to timing and rounding)
      const withinTolerance = (a: number, b: number, tolerance = 0.1) => {
        return Math.abs(a - b) / Math.max(a, b) <= tolerance;
      };

      expect(withinTolerance(checkMemInBytes.rss, perfMem.rss)).toBe(true);
      expect(withinTolerance(checkMemInBytes.external, perfMem.external)).toBe(true);
    });
  });

  describe('String field validation', () => {
    it('should have non-empty string values', async () => {
      const response = await healthHandler();
      const data = await response.json();

      expect(data.status.length).toBeGreaterThan(0);
      expect(data.timestamp.length).toBeGreaterThan(0);
      expect(data.version.length).toBeGreaterThan(0);
      expect(data.environment.length).toBeGreaterThan(0);
      expect(data.responseTime.length).toBeGreaterThan(0);
    });

    it('should not have whitespace-only values', async () => {
      const response = await healthHandler();
      const data = await response.json();

      expect(data.status.trim().length).toBe(data.status.length);
      expect(data.version.trim().length).toBe(data.version.length);
      expect(data.environment.trim().length).toBe(data.environment.length);
    });
  });

  describe('API contract consistency', () => {
    it('should maintain consistent field order', async () => {
      const response1 = await healthHandler();
      const data1 = await response1.json();
      const keys1 = Object.keys(data1);

      const response2 = await healthHandler();
      const data2 = await response2.json();
      const keys2 = Object.keys(data2);

      expect(keys1).toEqual(keys2);
    });

    it('should not include null values where not expected', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Top-level fields should not be null
      expect(data.status).not.toBeNull();
      expect(data.timestamp).not.toBeNull();
      expect(data.uptime).not.toBeNull();
      expect(data.version).not.toBeNull();
      expect(data.environment).not.toBeNull();
      expect(data.checks).not.toBeNull();
      expect(data.responseTime).not.toBeNull();
      expect(data.performance).not.toBeNull();
    });

    it('should be backward compatible with previous versions', async () => {
      const response = await healthHandler();
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
      const response = await healthHandler();
      const contentType = response.headers.get('content-type');

      expect(contentType).toBeTruthy();
      expect(contentType).toContain('application/json');
    });

    it('should be parseable as JSON', async () => {
      const response = await healthHandler();
      const text = await response.text();

      // Should be valid JSON
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  describe('Schema validation across all endpoints', () => {
    it('should all return valid JSON objects', async () => {
      const endpoints = [
        { name: 'health', handler: healthHandler },
        { name: 'healthz', handler: healthzHandler },
        { name: 'readyz', handler: readyzHandler }
      ];

      for (const endpoint of endpoints) {
        const response = await endpoint.handler();
        const data = await response.json();

        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();
        expect(Array.isArray(data)).toBe(false);
      }
    });

    it('should all include status and timestamp fields', async () => {
      const endpoints = [healthHandler, healthzHandler, readyzHandler];

      for (const handler of endpoints) {
        const response = await handler();
        const data = await response.json();

        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('timestamp');
        expect(typeof data.status).toBe('string');
        expect(typeof data.timestamp).toBe('string');
      }
    });

    it('should have consistent timestamp formats', async () => {
      const responses = await Promise.all([
        healthHandler(),
        healthzHandler(),
        readyzHandler()
      ]);

      const timestamps = await Promise.all(
        responses.map(async r => {
          const data = await r.json();
          return data.timestamp;
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
      const response = await healthHandler();
      const data = await response.json();

      // Should be semver format (X.Y.Z)
      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
      expect(data.version).toMatch(semverRegex);
    });
  });

  describe('Memory metrics validation', () => {
    it('should report memory in consistent units', async () => {
      const response = await healthHandler();
      const data = await response.json();

      // Checks memory is in MB (rounded)
      const checkMem = data.checks.memory.details;
      expect(Number.isInteger(checkMem.used)).toBe(true);
      expect(Number.isInteger(checkMem.total)).toBe(true);
      expect(Number.isInteger(checkMem.external)).toBe(true);
      expect(Number.isInteger(checkMem.rss)).toBe(true);

      // Performance memory is in bytes
      const perfMem = data.performance.memoryUsage;
      expect(perfMem.rss).toBeGreaterThan(1000000); // More than 1MB in bytes
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
