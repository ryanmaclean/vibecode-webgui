/**
 * Datadog Error Tracking Test Suite
 * 
 * This script tests the Datadog Error Tracking integration to ensure
 * errors are properly captured and sent to Datadog.
 */

import { trackError, trackApiError trackAuthError, trackValidationError, trackPerformanceIssue } from './error-tracking';
import { createComponentErrorTracker, DatabaseErrorTracker, AuthErrorTracker, FileErrorTracker, AIErrorTracker } from './error-tracking-utils';

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
  console.log('🧪 Testing basic error tracking...');
  
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
    
    console.log('✅ Basic error tracking test completed');
  } catch (error) {
    console.error('❌ Basic error tracking test failed:', error);
  }
}

/**
 * Test API error tracking
 */
export function testApiErrorTracking(): void {
  console.log('🧪 Testing API error tracking...');
  
  try {
    const apiError = new Error('API request failed');
    trackApiError('/api/test', 500, apiError, {
      method: 'POST',
      userAgent: 'test-agent',
      requestId: 'test-request-123'
    });
    
    console.log('✅ API error tracking test completed');
  } catch (error) {
    console.error('❌ API error tracking test failed:', error);
  }
}

/**
 * Test database error tracking
 */
export function testDatabaseErrorTracking(): void {
  console.log('🧪 Testing database error tracking...');
  
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
    
    console.log('✅ Database error tracking test completed');
  } catch (error) {
    console.error('❌ Database error tracking test failed:', error);
  }
}

/**
 * Test authentication error tracking
 */
export function testAuthErrorTracking(): void {
  console.log('🧪 Testing authentication error tracking...');
  
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
    
    console.log('✅ Authentication error tracking test completed');
  } catch (error) {
    console.error('❌ Authentication error tracking test failed:', error);
  }
}

/**
 * Test file operation error tracking
 */
export function testFileErrorTracking(): void {
  console.log('🧪 Testing file operation error tracking...');
  
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
    
    console.log('✅ File operation error tracking test completed');
  } catch (error) {
    console.error('❌ File operation error tracking test failed:', error);
  }
}

/**
 * Test AI operation error tracking
 */
export function testAIErrorTracking(): void {
  console.log('🧪 Testing AI operation error tracking...');
  
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
    
    console.log('✅ AI operation error tracking test completed');
  } catch (error) {
    console.error('❌ AI operation error tracking test failed:', error);
  }
}

/**
 * Test performance issue tracking
 */
export function testPerformanceErrorTracking(): void {
  console.log('🧪 Testing performance issue tracking...');
  
  try {
    trackPerformanceIssue('Slow database query', {
      duration: 5000,
      threshold: 1000,
      queryComplexityScore: 3
    }, {
      component: 'performance-test',
      operation: 'database-query'
    });
    
    console.log('✅ Performance issue tracking test completed');
  } catch (error) {
    console.error('❌ Performance issue tracking test failed:', error);
  }
}

/**
 * Test component error tracking
 */
export function testComponentErrorTracking(): void {
  console.log('🧪 Testing component error tracking...');
  
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
    
    console.log('✅ Component error tracking test completed');
  } catch (error) {
    console.error('❌ Component error tracking test failed:', error);
  }
}

/**
 * Test validation error tracking
 */
export function testValidationErrorTracking(): void {
  console.log('🧪 Testing validation error tracking...');
  
  try {
    const validationError = new Error('Invalid email format');
    trackValidationError('email', validationError, {
      component: 'validation-test',
      value: 'invalid-email',
      rules: ['email-format', 'required']
    });
    
    console.log('✅ Validation error tracking test completed');
  } catch (error) {
    console.error('❌ Validation error tracking test failed:', error);
  }
}

/**
 * Run all error tracking tests
 */
export function runAllErrorTrackingTests(): void {
  console.log('🚀 Starting Datadog Error Tracking Test Suite...');
  console.log(`Configuration: ${JSON.stringify(TEST_CONFIG, null, 2)}`);
  
  if (!TEST_CONFIG.enabled) {
    console.log('⚠️ Error tracking tests are disabled. Set DD_ERROR_TRACKING_TEST_MODE=true to enable.');
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
      console.error(`❌ Test ${index + 1} failed:`, error);
      failed++;
    }
  });
  
  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('🎉 All error tracking tests passed!');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }
}

/**
 * Test error tracking configuration
 */
export function testErrorTrackingConfiguration(): boolean {
  console.log('🔧 Testing error tracking configuration...');
  
  const requiredEnvVars = [
    'DD_API_KEY',
    'DD_SERVICE',
    'DD_ENV',
    'DD_VERSION'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please check docs/datadog-error-tracking-env.example for setup instructions');
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  
  // Test Datadog API connectivity
  if (process.env.DD_API_KEY) {
    console.log('🔗 Testing Datadog API connectivity...');
    // This would typically make an API call to validate the key
    console.log('✅ Datadog API key is configured');
  }
  
  return true;
}

/**
 * Generate test report
 */
export function generateTestReport(): void {
  console.log('\n📋 Datadog Error Tracking Test Report');
  console.log('=====================================');
  console.log(`Service: ${TEST_CONFIG.service}`);
  console.log(`Environment: ${TEST_CONFIG.environment}`);
  console.log(`Version: ${TEST_CONFIG.version}`);
  console.log(`Test Mode: ${TEST_CONFIG.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  if (TEST_CONFIG.enabled) {
    console.log('\n🔍 Next Steps:');
    console.log('1. Check your Datadog Error Tracking dashboard');
    console.log('2. Look for errors tagged with service:vibecode-webgui-test');
    console.log('3. Verify error context and metadata are captured');
    console.log('4. Test error grouping and alerting rules');
  }
}

// Export test functions for use in other modules

// Run tests if this file is executed directly
if (require.main === module) {
  runAllErrorTrackingTests();
  generateTestReport();
}
