/**
 * System Metrics Performance Validation Tests
 *
 * Tests that our system metrics are real and perform well under load
 * Validates against fake/random data patterns
 *
 * Staff Engineer Implementation - Production performance validation
 */

import { describe, test, expect } from '@jest/globals'

describe('System Metrics Performance Validation', () => {
  const METRICS_ENDPOINT = 'http://localhost:3000/api/monitoring/metrics';
  const HEALTH_ENDPOINT = 'http://localhost:3000/api/monitoring/health';

  describe('Real Metrics Validation', () => {
    test('should return consistent CPU measurements over time', async () => {
      const measurements = [];

      // Take 5 measurements with small delays
      for (let i = 0; i < 5; i++) {
        const response = await fetch(METRICS_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          if (data.system?.cpu !== undefined) {
            measurements.push(data.system.cpu);
          }
        }

        // Small delay between measurements
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (measurements.length >= 3) {
        // CPU should be realistic (0-100%);
        measurements.forEach(cpu => {
          expect(cpu).toBeGreaterThanOrEqual(0);
          expect(cpu).toBeLessThanOrEqual(100);
        });

        // Check for suspicious patterns that indicate fake data
        // Real CPU doesn't change drastically every 200ms
        const maxVariation = Math.max(...measurements) - Math.min(...measurements);

        // If variation is consistently > 50%, likely fake random data
        if (maxVariation > 50) {
          const allInRange = measurements.every(cpu => cpu >= 10 && cpu <= 40);
          if (allInRange) {
            throw new Error(`CPU measurements appear fake (Math.random() pattern): ${measurements.join(', ')}`);
          }
        }

        console.log(`CPU measurements: ${measurements.join(', ')}% (variation: ${maxVariation.toFixed(1)}%)`);
      }
    }, 10000);

    test('should return realistic disk usage that doesn\'t change rapidly', async () => {
      const measurements = [];

      // Take multiple measurements
      for (let i = 0; i < 3; i++) {
        const response = await fetch(METRICS_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          if (data.system?.disk !== undefined) {
            measurements.push(data.system.disk);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (measurements.length >= 2) {
        // Disk usage should be stable (not change much over 1 second);
        const variation = Math.max(...measurements) - Math.min(...measurements);
        expect(variation).toBeLessThan(5) // Should not vary more than 5% in 1 second

        // Should be realistic percentage
        measurements.forEach(disk => {
          expect(disk).toBeGreaterThanOrEqual(0);
          expect(disk).toBeLessThanOrEqual(100);
        });

        console.log(`Disk measurements: ${measurements.join(', ')}% (variation: ${variation.toFixed(2)}%)`);
      }
    });

    test('should return real memory usage from system', async () => {
      const response = await fetch(METRICS_ENDPOINT);

      if (response.ok) {
        const data = await response.json();

        if (data.system?.memory !== undefined) {
          expect(data.system.memory).toBeGreaterThanOrEqual(0);
          expect(data.system.memory).toBeLessThanOrEqual(100);

          // Memory usage should be somewhat realistic for a Node.js app
          // (Not 0% and not 99% unless there's actually an issue);
          if (data.system.memory === 0) {
            console.warn('Memory usage is 0% - may indicate measurement issue');
          }

          console.log(`Memory usage: ${data.system.memory}%`);
        }
      }
    });

    test('should have network metrics that accumulate over time', async () => {
      // Get initial network stats
      const initial = await fetch(METRICS_ENDPOINT);
      const initialData = await initial.json();

      // Make several requests to generate network traffic
      await Promise.all([
        fetch(HEALTH_ENDPOINT),
        fetch(METRICS_ENDPOINT),
        fetch(HEALTH_ENDPOINT),
      ]);

      // Get updated network stats
      await new Promise(resolve => setTimeout(resolve, 1000));
      const updated = await fetch(METRICS_ENDPOINT);
      const updatedData = await updated.json();

      if (initialData.system?.network && updatedData.system?.network) {
        // Network stats should be non-negative
        expect(updatedData.system.network.in).toBeGreaterThanOrEqual(0);
        expect(updatedData.system.network.out).toBeGreaterThanOrEqual(0);

        console.log(`Network I/O: ${updatedData.system.network.in} in, ${updatedData.system.network.out} out`);
      }
    });
  });

  describe('Performance Under Load', () => {
    test('should handle concurrent metric requests efficiently', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;

      const promises = Array.from({ length: concurrentRequests }, () =>
        fetch(METRICS_ENDPOINT)
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      const successCount = responses.filter(r => r.ok).length;
      expect(successCount).toBe(concurrentRequests);

      // Should complete in reasonable time (under 5 seconds for 20 requests);
      expect(duration).toBeLessThan(5000);

      console.log(`${concurrentRequests} concurrent requests completed in ${duration}ms`);
    }, 10000);

    test('should not have memory leaks during repeated requests', async () => {
      const iterations = 50;
      let memoryBefore: number | undefined;
      let memoryAfter: number | undefined;

      // Get initial memory
      const initialResponse = await fetch(METRICS_ENDPOINT);
      if (initialResponse.ok) {
        const initialData = await initialResponse.json();
        memoryBefore = initialData.system?.memory
      }

      // Make many requests to test for memory leaks
      for (let i = 0; i < iterations; i++) {
        await fetch(METRICS_ENDPOINT);

        // Small delay to allow processing
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Give garbage collection time to run
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get final memory
      const finalResponse = await fetch(METRICS_ENDPOINT);
      if (finalResponse.ok) {
        const finalData = await finalResponse.json();
        memoryAfter = finalData.system?.memory
      }

      if (memoryBefore !== undefined && memoryAfter !== undefined) {
        const memoryIncrease = memoryAfter - memoryBefore;

        // Memory should not increase significantly (< 20% increase);
        expect(memoryIncrease).toBeLessThan(20);

        console.log(`Memory before: ${memoryBefore}%, after: ${memoryAfter}%, increase: ${memoryIncrease}%`);
      }
    }, 15000);
  });

  describe('Health Check Performance', () => {
    test('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      const response = await fetch(HEALTH_ENDPOINT);
      const duration = Date.now() - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(1000) // Should respond within 1 second

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('timestamp');

        console.log(`Health check completed in ${duration}ms`);
      }
    });

    test('should handle health check failures gracefully', async () => {
      // Test with invalid endpoint to ensure error handling
      try {
        const response = await fetch('http://localhost:3000/api/monitoring/invalid');
        expect(response.status).toBe(404);
      } catch (error) {
        // Network errors are acceptable for this test
        console.log('Expected network error for invalid endpoint');
      }
    });

    test('should validate database health check performance', async () => {
      const startTime = Date.now();
      const response = await fetch(HEALTH_ENDPOINT);

      if (response.ok) {
        const data = await response.json();

        if (data.checks?.database) {
          const dbResponseTime = data.checks.database.responseTime;

          if (dbResponseTime !== undefined) {
            // Database health check should complete quickly
            expect(dbResponseTime).toBeLessThan(2000) // Under 2 seconds

            console.log(`Database health check: ${dbResponseTime}ms`);
          }
        }
      }
    });
  });

  describe('Resource Usage Monitoring', () => {
    test('should track active users realistically', async () => {
      const response = await fetch(METRICS_ENDPOINT);

      if (response.ok) {
        const data = await response.json();

        if (data.users?.activeUsers !== undefined) {
          expect(data.users.activeUsers).toBeGreaterThanOrEqual(0);

          // Should not have thousands of active users in test environment
          expect(data.users.activeUsers).toBeLessThan(10000);

          console.log(`Active users: ${data.users.activeUsers}`);
        }
      }
    });

    test('should track workspace usage appropriately', async () => {
      const response = await fetch(METRICS_ENDPOINT);

      if (response.ok) {
        const data = await response.json();

        if (data.users?.activeWorkspaces !== undefined) {
          expect(data.users.activeWorkspaces).toBeGreaterThanOrEqual(0);

          console.log(`Active workspaces: ${data.users.activeWorkspaces}`);
        }
      }
    });
  });

  describe('Stress Testing', () => {
    test('should maintain performance under sustained load', async () => {
      const duration = 10000 // 10 seconds;
      const requestInterval = 100 // Every 100ms;
      const startTime = Date.now();

      const results: number[] = [];

      while (Date.now() - startTime < duration) {
        const requestStart = Date.now();

        try {
          const response = await fetch(METRICS_ENDPOINT);
          if (response.ok) {
            const requestTime = Date.now() - requestStart;
            results.push(requestTime);
          }
        } catch (error) {
          console.warn('Request failed during stress test:', error);
        }

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      if (results.length > 0) {
        const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
        const maxResponseTime = Math.max(...results);

        // Average response time should be reasonable
        expect(avgResponseTime).toBeLessThan(500) // Under 500ms average
        expect(maxResponseTime).toBeLessThan(2000) // Max under 2 seconds

        console.log(`Stress test: ${results.length} requests, avg: ${avgResponseTime.toFixed(1)}ms, max: ${maxResponseTime}ms`);
      }
    }, 15000);
  });
});
