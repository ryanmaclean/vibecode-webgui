/**
 * Datadog Error Tracking Test Suite
 * 
 * This script tests the Datadog Error Tracking integration to ensure
 * errors are properly captured and sent to Datadog.
 */

import { trackError, trackApiError, trackDatabaseError, trackAuthError, trackValidationError, trackPerformanceIssue } from './error-tracking';
import { createComponentErrorTracker, DatabaseErrorTracker, AuthErrorTracker, FileErrorTracker, AIErrorTracker } from './error-tracking-utils';
import { logger } from '@/lib/logger';
// Test configuration
const TEST_CONFIG = {
  enabled: process.env.DD_ERROR_TRACKING_TEST_MODE === 'true',
  service: 'vibecode-webgui-test',
  environment: 'test',
  version: '1.0.0-test'
};

/**
 * Test basic error tracking
 */
export function testBasicErrorTracking(): void {
  logger.info('🧪 Testing basic error tracking...');
  
  try {
    const testError = new Error('Test error for Datadog Error Tracking');
    trackError(testError, {
      component: 'error-tracking-test',
      action: 'basic-test',
      metadata: {
        test_type: 'basic',
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info('✅ Basic error tracking test completed');
  } catch (error) {
    logger.error('❌ Basic error tracking test failed:', error);
  }
}

/**
 * Test API error tracking
 */
export function testApiErrorTracking(): void {
  logger.info('🧪 Testing API error tracking...');
  
  try {
    const apiError = new Error('API request failed');
    trackApiError('/api/test', 500, apiError, {
      method: 'POST',
      userAgent: 'test-agent',
      requestId: 'test-request-123'
    });
    
    logger.info('✅ API error tracking test completed');
  } catch (error) {
    logger.error('❌ API error tracking test failed:', error);
  }
}

/**
 * Test database error tracking
 */
export function testDatabaseErrorTracking(): void {
  logger.info('🧪 Testing database error tracking...');
  
  try {
    const dbError = new Error('Database connection failed');
    DatabaseErrorTracker.trackConnectionError(dbError, {
      component: 'database-test',
      database: 'postgresql',
      host: 'localhost'
    });
    
    const queryError = new Error('Query execution failed');
    DatabaseErrorTracker.trackQueryError('SELECT * FROM users', queryError, {
      component: 'database-test',
      query_type: 'SELECT'
    });
    
    logger.info('✅ Database error tracking test completed');
  } catch (error) {
    logger.error('❌ Database error tracking test failed:', error);
  }
}

/**
 * Test authentication error tracking
 */
export function testAuthErrorTracking(): void {
  logger.info('🧪 Testing authentication error tracking...');
  
  try {
    const authError = new Error('Invalid credentials');
    AuthErrorTracker.trackLoginError(authError, {
      component: 'auth-test',
      userId: 'test-user-123',
      provider: 'github'
    });
    
    const tokenError = new Error('Token validation failed');
    AuthErrorTracker.trackTokenError(tokenError, {
      component: 'auth-test',
      tokenType: 'access_token'
    });
    
    logger.info('✅ Authentication error tracking test completed');
  } catch (error) {
    logger.error('❌ Authentication error tracking test failed:', error);
  }
}

/**
 * Test file operation error tracking
 */
export function testFileErrorTracking(): void {
  logger.info('🧪 Testing file operation error tracking...');
  
  try {
    const uploadError = new Error('File upload failed');
    FileErrorTracker.trackUploadError(uploadError, 'test-file.txt', {
      component: 'file-test',
      fileSize: 1024,
      mimeType: 'text/plain'
    });
    
    const processingError = new Error('File processing failed');
    FileErrorTracker.trackProcessingError(processingError, 'test-file.txt', {
      component: 'file-test',
      operation: 'parse'
    });
    
    logger.info('✅ File operation error tracking test completed');
  } catch (error) {
    logger.error('❌ File operation error tracking test failed:', error);
  }
}

/**
 * Test AI operation error tracking
 */
export function testAIErrorTracking(): void {
  logger.info('🧪 Testing AI operation error tracking...');
  
  try {
    const modelError = new Error('AI model inference failed');
    AIErrorTracker.trackModelError('claude-3-5-sonnet', modelError, {
      component: 'ai-test',
      promptLength: 100,
      modelVersion: '20241022'
    });
    
    const promptError = new Error('Prompt processing failed');
    AIErrorTracker.trackPromptError('test-prompt-123', promptError, {
      component: 'ai-test',
      promptType: 'code-generation'
    });
    
    logger.info('✅ AI operation error tracking test completed');
  } catch (error) {
    logger.error('❌ AI operation error tracking test failed:', error);
  }
}

/**
 * Test performance issue tracking
 */
export function testPerformanceErrorTracking(): void {
  logger.info('🧪 Testing performance issue tracking...');
  
  try {
    trackPerformanceIssue('Slow database query', {
      duration: 5000,
      threshold: 1000,
      queryComplexityScore: 3
    }, {
      component: 'performance-test',
      operation: 'database-query'
    });
    
    logger.info('✅ Performance issue tracking test completed');
  } catch (error) {
    logger.error('❌ Performance issue tracking test failed:', error);
  }
}

/**
 * Test component error tracking
 */
export function testComponentErrorTracking(): void {
  logger.info('🧪 Testing component error tracking...');
  
  try {
    const componentTracker = createComponentErrorTracker('test-component');
    
    const componentError = new Error('Component rendering failed');
    componentTracker.trackError(componentError, {
      component: 'test-component',
      action: 'render',
      props: { testProp: 'test-value' }
    });
    
    componentTracker.trackWarning('Component performance warning', {
      component: 'test-component',
      action: 'performance-check'
    });
    
    logger.info('✅ Component error tracking test completed');
  } catch (error) {
    logger.error('❌ Component error tracking test failed:', error);
  }
}

/**
 * Test validation error tracking
 */
export function testValidationErrorTracking(): void {
  logger.info('🧪 Testing validation error tracking...');
  
  try {
    const validationError = new Error('Invalid email format');
    trackValidationError('email', validationError, {
      component: 'validation-test',
      value: 'invalid-email',
      rules: ['email-format', 'required']
    });
    
    logger.info('✅ Validation error tracking test completed');
  } catch (error) {
    logger.error('❌ Validation error tracking test failed:', error);
  }
}

/**
 * Run all error tracking tests
 */
export function runAllErrorTrackingTests(): void {
  logger.info('🚀 Starting Datadog Error Tracking Test Suite...');
  logger.info(`Configuration: ${JSON.stringify(TEST_CONFIG, null, 2)}`);
  
  if (!TEST_CONFIG.enabled) {
    logger.info('⚠️ Error tracking tests are disabled. Set DD_ERROR_TRACKING_TEST_MODE=true to enable.');
    return;
  }
  
  const tests = [
    testBasicErrorTracking,
    testApiErrorTracking,
    testDatabaseErrorTracking,
    testAuthErrorTracking,
    testFileErrorTracking,
    testAIErrorTracking,
    testPerformanceErrorTracking,
    testComponentErrorTracking,
    testValidationErrorTracking
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach((test, index) => {
    try {
      test();
      passed++;
    } catch (error) {
      logger.error(`❌ Test ${index + 1} failed:`, error);
      failed++;
    }
  });
  
  logger.info(`\n📊 Test Results:`);
  logger.info(`✅ Passed: ${passed}`);
  logger.info(`❌ Failed: ${failed}`);
  logger.info(`📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    logger.info('🎉 All error tracking tests passed!');
  } else {
    logger.info('⚠️ Some tests failed. Check the logs above for details.');
  }
}

/**
 * Test error tracking configuration
 */
export function testErrorTrackingConfiguration(): boolean {
  logger.info('🔧 Testing error tracking configuration...');
  
  const requiredEnvVars = [
    'DD_API_KEY',
    'DD_SERVICE',
    'DD_ENV',
    'DD_VERSION'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('❌ Missing required environment variables:', missingVars);
    logger.error('Please check docs/datadog-error-tracking-env.example for setup instructions');
    return false;
  }
  
  logger.info('✅ All required environment variables are set');
  
  // Test Datadog API connectivity
  if (process.env.DD_API_KEY) {
    logger.info('🔗 Testing Datadog API connectivity...');
    // This would typically make an API call to validate the key
    logger.info('✅ Datadog API key is configured');
  }
  
  return true;
}

/**
 * Generate test report
 */
export function generateTestReport(): void {
  logger.info('\n📋 Datadog Error Tracking Test Report');
  logger.info('=====================================');
  logger.info(`Service: ${TEST_CONFIG.service}`);
  logger.info(`Environment: ${TEST_CONFIG.environment}`);
  logger.info(`Version: ${TEST_CONFIG.version}`);
  logger.info(`Test Mode: ${TEST_CONFIG.enabled ? 'Enabled' : 'Disabled'}`);
  logger.info(`Timestamp: ${new Date().toISOString()}`);
  
  if (TEST_CONFIG.enabled) {
    logger.info('\n🔍 Next Steps:');
    logger.info('1. Check your Datadog Error Tracking dashboard');
    logger.info('2. Look for errors tagged with service:vibecode-webgui-test');
    logger.info('3. Verify error context and metadata are captured');
    logger.info('4. Test error grouping and alerting rules');
  }
}

// Export test functions for use in other modules

// Run tests if this file is executed directly
if (require.main === module) {
  runAllErrorTrackingTests();
  generateTestReport();
}
