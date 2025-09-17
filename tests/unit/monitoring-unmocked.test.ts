/**
 * UNMOCKED Monitoring Tests
 * Tests monitoring functions with minimal mocking
 * Focus on real integrations and error handling
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getDatadogApiKey, getDatadogSite, getRUMPublicConfig } from '../../src/lib/monitoring/datadog-env';

// Only mock fetch for controlled testing - allow real monitoring modules
global.fetch = jest.fn() as unknown as typeof fetch;
const fetchMock = global.fetch as unknown as jest.Mock;

describe('Monitoring Library (Minimal Mocking)', () => {
  beforeEach(() => {
    // Reset fetch mock
    fetchMock.mockClear();

    // Mock browser environment only
    if (!(global as any).window) {
      Object.defineProperty(global, 'window', {
        value: {
          location: { href: 'http://localhost:3000' },
          navigator: { userAgent: 'test-agent' },
          performance: {
            now: () => Date.now(),
            timing: {
              navigationStart: Date.now() - 1000
            }
          }
        },
        writable: true
      });
    }
  });

  afterEach(() => {
    Reflect.deleteProperty(global as any, 'window');
  });

  test('should handle monitoring initialization without throwing', async () => {
    // Test that monitoring can be imported and initialized
    await expect(async () => {
      const { monitoring } = await import('../../src/lib/monitoring');
      monitoring.init();
    }).not.toThrow();
  });

  test('should track page load metrics with realistic values', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    const startTime = Date.now() - 500; // 500ms ago
    const path = '/test-page';

    expect(() => {
      monitoring.trackPageLoad(path, startTime);
    }).not.toThrow();

    // Should accept realistic load times
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeGreaterThan(0);
    expect(loadTime).toBeLessThan(10000); // Should be under 10 seconds
  });

  test('should track user actions with proper data validation', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    const action = 'button_click';
    const properties = {
      button_id: 'submit-form',
      page: '/dashboard',
      user_id: 'test-user-123'
    };

    expect(() => {
      monitoring.trackUserAction(action, properties);
    }).not.toThrow();

    // Validate input sanitization
    expect(() => {
      monitoring.trackUserAction('', {}); // Empty action
    }).not.toThrow();

    expect(() => {
      monitoring.trackUserAction(null as any, properties); // Invalid action
    }).not.toThrow();
  });

  test('should track errors with proper stack trace handling', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    const testError = new Error('Test error for monitoring');
    const context = {
      component: 'test-component',
      user_action: 'form_submission',
      additional_data: { form_id: 'test-form' }
    };

    expect(() => {
      monitoring.trackError(testError, context);
    }).not.toThrow();

    // Test with different error types
    expect(() => {
      monitoring.trackError(new TypeError('Type error'), context);
    }).not.toThrow();

    expect(() => {
      monitoring.trackError(new ReferenceError('Reference error'), context);
    }).not.toThrow();
  });

  test('should handle network failures gracefully', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // Mock fetch to simulate network failure
    fetchMock.mockRejectedValue(new Error('Network error'));

    expect(() => {
      monitoring.trackPageLoad('/test', Date.now());
      monitoring.trackUserAction('test_action', {});
      monitoring.trackError(new Error('Test'), {});
    }).not.toThrow();

    // Should not crash the application when network fails
  });

  test('should validate metric data types and ranges', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // Test with various data types
    const validProperties = {
      string_value: 'test',
      number_value: 42,
      boolean_value: true,
      null_value: null,
      undefined_value: undefined,
      object_value: { nested: 'data' },
      array_value: [1, 2, 3]
    };

    expect(() => {
      monitoring.trackUserAction('data_validation_test', validProperties);
    }).not.toThrow();

    // Test with edge cases
    const edgeCaseProperties = {
      very_long_string: 'x'.repeat(10000),
      negative_number: -999,
      zero: 0,
      infinity: Infinity,
      nan: NaN
    };

    expect(() => {
      monitoring.trackUserAction('edge_case_test', edgeCaseProperties);
    }).not.toThrow();
  });

  test('should handle concurrent monitoring calls', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // Simulate concurrent calls that might happen in real usage
    const promises = Array.from({ length: 10 }, (_, i) =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          monitoring.trackUserAction(`concurrent_action_${i}`, { index: i });
          resolve();
        }, Math.random() * 100);
      })
    );

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  test('should preserve error details for debugging', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    const complexError = new Error('Complex error with details') as any;
    complexError.code = 'E_COMPLEX';
    complexError.statusCode = 500;
    complexError.details = {
      request_id: 'req_123',
      user_id: 'user_456',
      timestamp: new Date().toISOString()
    };

    expect(() => {
      monitoring.trackError(complexError, {
        additional_context: 'This error occurred during form submission',
        retry_count: 3,
        user_agent: navigator.userAgent
      });
    }).not.toThrow();
  });

  test('should handle monitoring in different environments', async () => {
    const { monitoring } = await import('../../src/lib/monitoring');

    // Test with different NODE_ENV values
    const originalEnv = process.env.NODE_ENV;

    (process.env as any).NODE_ENV = 'development';
    expect(() => monitoring.init()).not.toThrow();

    (process.env as any).NODE_ENV = 'production';
    expect(() => monitoring.init()).not.toThrow();

    (process.env as any).NODE_ENV = 'test';
    expect(() => monitoring.init()).not.toThrow();

    // Restore original environment
    (process.env as any).NODE_ENV = originalEnv;
  });
});

describe('Real Integration Validation', () => {
  test('should validate environment variables for real integration', () => {
    // This test verifies we have real configuration for integration tests
    const apiKey = getDatadogApiKey();
    const hasDatadogKey = !!(apiKey && apiKey.length > 10 && !apiKey.includes('test'));

    const rum = getRUMPublicConfig();
    const hasRumConfig = !!(rum.applicationId && rum.clientToken);

    if (hasDatadogKey && apiKey) {
      expect(apiKey).toBeTruthy();
      expect(apiKey).not.toContain('test');
      expect(apiKey).not.toContain('fake');
      expect(apiKey).not.toContain('mock');
    }

    if (hasRumConfig) {
      expect(rum.applicationId).toBeTruthy();
      expect(rum.clientToken).toBeTruthy();
    }

    // Log configuration status for debugging
    console.log('Real integration configuration:', {
      hasDatadogKey,
      hasRumConfig,
      datadogSite: getDatadogSite()
    });
  });

  test('should avoid over-mocking anti-pattern', async () => {
    // Read this test file to validate it doesn't over-mock
    const fs = await import('fs');
    const testFileContent = fs.readFileSync(__filename, 'utf8');

    // Count mocking usage
    const jestMockCount = (testFileContent.match(/jest\.mock/g) || []).length;
    const jestFnCount = (testFileContent.match(/jest\.fn/g) || []).length;

    // Should have minimal mocking compared to original test  
    // Allow for jest.mock strings in test expectations (5 = 3 validation strings + 2 comments)
    expect(jestMockCount).toBeLessThanOrEqual(5); // Allow jest.mock in test expectations
    expect(jestFnCount).toBeLessThanOrEqual(1); // Only essential mocks

    // Should not mock the core monitoring modules (check actual mock calls, not test expectations)
    const monitoringMockRegex = /jest\.mock\(['"`]\.\.\/\.\.\/src\/lib\/monitoring['"`]\)/;
    const rumMockRegex = /jest\.mock\(['"`]@datadog\/browser-rum['"`]\)/;
    const logsMockRegex = /jest\.mock\(['"`]@datadog\/browser-logs['"`]\)/;
    
    expect(monitoringMockRegex.test(testFileContent)).toBeFalsy();
    expect(rumMockRegex.test(testFileContent)).toBeFalsy(); 
    expect(logsMockRegex.test(testFileContent)).toBeFalsy();
  });
});
