/**
 * Datadog Error Tracking Integration Test Suite
 *
 * This tests the Datadog Error Tracking integration to ensure
 * errors are properly captured and sent to Datadog.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { logger } from '@/lib/logger';
import { trackError, trackApiError, trackDatabaseError, trackAuthError, trackValidationError, trackPerformanceIssue } from '@/lib/monitoring/error-tracking';
import { createComponentErrorTracker, DatabaseErrorTracker, AuthErrorTracker, FileErrorTracker, AIErrorTracker } from '@/lib/monitoring/error-tracking-utils';

// Test configuration
const TEST_CONFIG = {
  enabled: process.env.DD_ERROR_TRACKING_TEST_MODE === 'true' || process.env.NODE_ENV === 'test',
  service: 'vibecode-webgui-test',
  environment: 'test',
  version: '1.0.0-test'
};

describe('Datadog Error Tracking Integration', () => {
  beforeAll(() => {
    logger.info('Starting Datadog Error Tracking Test Suite', { module: 'error-tracking-test', config: TEST_CONFIG });
  });

  describe('Basic Error Tracking', () => {
    test('should track basic errors', () => {
      logger.info('Testing basic error tracking', { test: 'basic', module: 'error-tracking-test' });

      const testError = new Error('Test error for Datadog Error Tracking');

      expect(() => {
        trackError(testError, {
          component: 'error-tracking-test',
          action: 'basic-test',
          metadata: {
            test_type: 'basic',
            timestamp: new Date().toISOString()
          }
        });
      }).not.toThrow();

      logger.info('Basic error tracking test completed', { test: 'basic', status: 'success' });
    });
  });

  describe('API Error Tracking', () => {
    test('should track API errors', () => {
      logger.info('Testing API error tracking', { test: 'api', module: 'error-tracking-test' });

      const apiError = new Error('API request failed');

      expect(() => {
        trackApiError('/api/test', 500, apiError, {
          method: 'POST',
          userAgent: 'test-agent',
          requestId: 'test-request-123'
        });
      }).not.toThrow();

      logger.info('API error tracking test completed', { test: 'api', status: 'success' });
    });
  });

  describe('Database Error Tracking', () => {
    test('should track database connection errors', () => {
      logger.info('Testing database error tracking', { test: 'database', module: 'error-tracking-test' });

      const dbError = new Error('Database connection failed');

      expect(() => {
        DatabaseErrorTracker.trackConnectionError(dbError, {
          component: 'database-test',
          database: 'postgresql',
          host: 'localhost'
        });
      }).not.toThrow();
    });

    test('should track database query errors', () => {
      const queryError = new Error('Query execution failed');

      expect(() => {
        DatabaseErrorTracker.trackQueryError('SELECT * FROM users', queryError, {
          component: 'database-test',
          query_type: 'SELECT'
        });
      }).not.toThrow();

      logger.info('Database error tracking test completed', { test: 'database', status: 'success' });
    });
  });

  describe('Authentication Error Tracking', () => {
    test('should track login errors', () => {
      logger.info('Testing authentication error tracking', { test: 'auth', module: 'error-tracking-test' });

      const authError = new Error('Invalid credentials');

      expect(() => {
        AuthErrorTracker.trackLoginError(authError, {
          component: 'auth-test',
          userId: 'test-user-123',
          provider: 'github'
        });
      }).not.toThrow();
    });

    test('should track token errors', () => {
      const tokenError = new Error('Token validation failed');

      expect(() => {
        AuthErrorTracker.trackTokenError(tokenError, {
          component: 'auth-test',
          tokenType: 'access_token'
        });
      }).not.toThrow();

      logger.info('Authentication error tracking test completed', { test: 'auth', status: 'success' });
    });
  });

  describe('File Operation Error Tracking', () => {
    test('should track upload errors', () => {
      logger.info('Testing file operation error tracking', { test: 'file', module: 'error-tracking-test' });

      const uploadError = new Error('File upload failed');

      expect(() => {
        FileErrorTracker.trackUploadError(uploadError, 'test-file.txt', {
          component: 'file-test',
          fileSize: 1024,
          mimeType: 'text/plain'
        });
      }).not.toThrow();
    });

    test('should track processing errors', () => {
      const processingError = new Error('File processing failed');

      expect(() => {
        FileErrorTracker.trackProcessingError(processingError, 'test-file.txt', {
          component: 'file-test',
          operation: 'parse'
        });
      }).not.toThrow();

      logger.info('File operation error tracking test completed', { test: 'file', status: 'success' });
    });
  });

  describe('AI Operation Error Tracking', () => {
    test('should track AI model errors', () => {
      logger.info('Testing AI operation error tracking', { test: 'ai', module: 'error-tracking-test' });

      const modelError = new Error('AI model inference failed');

      expect(() => {
        AIErrorTracker.trackModelError('claude-3-5-sonnet', modelError, {
          component: 'ai-test',
          promptLength: 100,
          modelVersion: '20241022'
        });
      }).not.toThrow();
    });

    test('should track prompt errors', () => {
      const promptError = new Error('Prompt processing failed');

      expect(() => {
        AIErrorTracker.trackPromptError('test-prompt-123', promptError, {
          component: 'ai-test',
          promptType: 'code-generation'
        });
      }).not.toThrow();

      logger.info('AI operation error tracking test completed', { test: 'ai', status: 'success' });
    });
  });

  describe('Performance Issue Tracking', () => {
    test('should track performance issues', () => {
      logger.info('Testing performance issue tracking', { test: 'performance', module: 'error-tracking-test' });

      expect(() => {
        trackPerformanceIssue('Slow database query', {
          duration: 5000,
          threshold: 1000,
          queryComplexityScore: 3
        }, {
          component: 'performance-test',
          operation: 'database-query'
        });
      }).not.toThrow();

      logger.info('Performance issue tracking test completed', { test: 'performance', status: 'success' });
    });
  });

  describe('Component Error Tracking', () => {
    test('should track component errors', () => {
      logger.info('Testing component error tracking', { test: 'component', module: 'error-tracking-test' });

      const componentTracker = createComponentErrorTracker('test-component');
      const componentError = new Error('Component rendering failed');

      expect(() => {
        componentTracker.trackError(componentError, {
          component: 'test-component',
          action: 'render',
          props: { testProp: 'test-value' }
        });
      }).not.toThrow();
    });

    test('should track component warnings', () => {
      const componentTracker = createComponentErrorTracker('test-component');

      expect(() => {
        componentTracker.trackWarning('Component performance warning', {
          component: 'test-component',
          action: 'performance-check'
        });
      }).not.toThrow();

      logger.info('Component error tracking test completed', { test: 'component', status: 'success' });
    });
  });

  describe('Validation Error Tracking', () => {
    test('should track validation errors', () => {
      logger.info('Testing validation error tracking', { test: 'validation', module: 'error-tracking-test' });

      const validationError = new Error('Invalid email format');

      expect(() => {
        trackValidationError('email', validationError, {
          component: 'validation-test',
          value: 'invalid-email',
          rules: ['email-format', 'required']
        });
      }).not.toThrow();

      logger.info('Validation error tracking test completed', { test: 'validation', status: 'success' });
    });
  });

  describe('Configuration', () => {
    test('should have proper test configuration', () => {
      expect(TEST_CONFIG).toHaveProperty('service');
      expect(TEST_CONFIG).toHaveProperty('environment');
      expect(TEST_CONFIG).toHaveProperty('version');
      expect(TEST_CONFIG.service).toBe('vibecode-webgui-test');
      expect(TEST_CONFIG.environment).toBe('test');
    });

    test('should validate environment setup', () => {
      // Check if basic error tracking functions exist
      expect(typeof trackError).toBe('function');
      expect(typeof trackApiError).toBe('function');
      expect(typeof trackDatabaseError).toBe('function');
      expect(typeof trackAuthError).toBe('function');
      expect(typeof trackValidationError).toBe('function');
      expect(typeof trackPerformanceIssue).toBe('function');
    });

    test('should validate error tracker utilities', () => {
      // These are classes/namespaces with static methods
      expect(DatabaseErrorTracker).toBeDefined();
      expect(DatabaseErrorTracker.trackConnectionError).toBeDefined();
      expect(DatabaseErrorTracker.trackQueryError).toBeDefined();

      expect(AuthErrorTracker).toBeDefined();
      expect(AuthErrorTracker.trackLoginError).toBeDefined();
      expect(AuthErrorTracker.trackTokenError).toBeDefined();

      expect(FileErrorTracker).toBeDefined();
      expect(FileErrorTracker.trackUploadError).toBeDefined();
      expect(FileErrorTracker.trackProcessingError).toBeDefined();

      expect(AIErrorTracker).toBeDefined();
      expect(AIErrorTracker.trackModelError).toBeDefined();
      expect(AIErrorTracker.trackPromptError).toBeDefined();

      expect(typeof createComponentErrorTracker).toBe('function');
    });
  });
});
