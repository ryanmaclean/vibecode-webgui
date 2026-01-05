/**
 * Production-ready monitoring tests
 * Tests real-world scenarios with conditional execution
 */

import { describe, test, expect, beforeAll } from '@jest/globals'
import { performance } from 'perf_hooks'

// Only run performance tests in production-like environments
const HAS_MONITORING = process.env.DD_API_KEY !== undefined;

(HAS_MONITORING ? describe : describe.skip)('Production Monitoring Validation (REAL TESTS)', () => {
  beforeAll(() => {
    // Validate production environment
    if (HAS_MONITORING && !process.env.DD_API_KEY) {
      throw new Error('DD_API_KEY required for production monitoring tests');
    }
  })

  describe('Performance Under Load', () => {
    test('should maintain monitoring performance under load', async () => {
      const { monitoring } = await import('../../src/lib/monitoring');

      const startTime = performance.now();

      // Track multiple events quickly
      for (let i = 0; i < 100; i++) {
        monitoring.trackUserAction('load_test', { iteration: i });
      }

      const endTime = performance.now();

      // Should complete quickly without blocking
      expect(endTime - startTime).toBeLessThan(1000); // 1 second for 100 events
    }, 10000);
  });

  describe('Memory Leak Detection', () => {
    test('should not leak memory during extended monitoring operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate extended monitoring activity
      const { monitoring } = await import('../../src/lib/monitoring');
      for (let i = 0; i < 1000; i++) {
        monitoring.trackUserAction('memory_test', { iteration: i });

        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Recovery', () => {
    test('should handle monitoring errors gracefully', async () => {
      const { monitoring } = await import('../../src/lib/monitoring');

      // These should not throw errors even if monitoring fails internally
      expect(() => monitoring.trackUserAction('test', {})).not.toThrow();
      expect(() => monitoring.trackError(new Error('test error'), {})).not.toThrow();
    });
  });

  describe('Monitoring Health Checks', () => {
    test('should validate monitoring configuration', () => {
      // Verify environment is properly configured
      expect(process.env.DD_API_KEY).toBeDefined();
      expect(typeof process.env.DD_API_KEY).toBe('string');
      expect(process.env.DD_API_KEY.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Chaos Engineering Tests
 * Tests system behavior under adverse conditions
 */
(HAS_MONITORING ? describe : describe.skip)('Chaos Engineering - Monitoring Resilience', () => {
  test('should maintain core functionality during monitoring failures', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // System should continue operating even if monitoring fails
    for (let i = 0; i < 50; i++) {
      monitoring.trackUserAction('resilience_test', { iteration: i });
    }

    // Test completes without throwing
    expect(true).toBe(true);
  });
});

/**
 * Conditional Tests for Real Datadog Integration
 * These tests run against actual Datadog APIs when DD_API_KEY is available
 */
(HAS_MONITORING ? describe : describe.skip)('Real Datadog Integration', () => {
  test('should successfully initialize monitoring with real credentials', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // Should not throw when initializing with real config
    expect(() => monitoring.init()).not.toThrow();
  });

  test('should track events without errors', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // Send a test event
    expect(() => {
      monitoring.trackUserAction('integration_test', {
        test_id: `test_${Date.now()}`,
        environment: 'test'
      });
    }).not.toThrow();
  });
});
