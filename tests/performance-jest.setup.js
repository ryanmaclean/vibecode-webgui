/**
 * Jest Setup for Performance Tests
 * 
 * Configure environment and utilities for performance testing
 */

// Increase timeout for all performance tests
jest.setTimeout(30000);

// Add custom matchers for performance assertions
expect.extend({
  toBeWithinPerformanceBudget(received, budget) {
    const pass = received <= budget;
    if (pass) {
      return {
        message: () =>
          `expected ${received}ms to exceed performance budget of ${budget}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received}ms to be within performance budget of ${budget}ms (exceeded by ${received - budget}ms)`,
        pass: false,
      };
    }
  },
  
  toHaveAcceptableSuccessRate(received, threshold = 0.95) {
    const pass = received >= threshold;
    if (pass) {
      return {
        message: () =>
          `expected success rate ${received} to be below threshold ${threshold}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected success rate ${received} to be at least ${threshold} but got ${received}`,
        pass: false,
      };
    }
  }
});

// Performance test utilities
global.performanceUtils = {
  /**
   * Measure async function execution time
   */
  async measureAsync(fn) {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  /**
   * Run concurrent requests and measure performance
   */
  async runConcurrent(fn, count) {
    const promises = Array.from({ length: count }, () => fn());
    const start = Date.now();
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - start;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return {
      total: count,
      successful,
      failed,
      successRate: successful / count,
      duration,
      avgDuration: duration / count
    };
  },

  /**
   * Calculate percentiles from array of numbers
   */
  calculatePercentiles(values) {
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      min: sorted[0],
      max: sorted[len - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / len
    };
  }
};

console.log('Performance test environment initialized');
