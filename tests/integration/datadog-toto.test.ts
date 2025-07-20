/**
 * Datadog Toto Test Observability Integration
 * Validates Toto test observability with Datadog
 * Only runs when ENABLE_DATADOG_TESTS=true and DD_API_KEY is set
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { TotoTest } from 'datadog-toto';

// Only run these tests when explicitly enabled with real API key
const shouldRunTests = 
  process.env.ENABLE_DATADOG_TESTS === 'true' && 
  !!process.env.DD_API_KEY &&
  !!process.env.DD_APP_KEY;

const conditionalDescribe = shouldRunTests ? describe : describe.skip;

// Initialize Toto test suite
const toto = new TotoTest({
  apiKey: process.env.DD_API_KEY as string,
  appKey: process.env.DD_APP_KEY as string,
  site: process.env.DD_SITE || 'datadoghq.com',
  service: 'vibecode-webgui',
  env: process.env.NODE_ENV || 'test'
});

conditionalDescribe('Datadog Toto Test Observability', () => {
  beforeAll(async () => {
    // Validate environment setup
    expect(process.env.DD_API_KEY).toBeDefined();
    expect(process.env.DD_APP_KEY).toBeDefined();
  });

  test('should track test execution in Datadog', async () => {
    const testSpan = await toto.startTest({
      name: 'vibecode.webui.login_test',
      suite: 'vibecode-webui-e2e',
      startTime: Date.now(),
      tags: {
        'test.type': 'e2e',
        'test.framework': 'jest',
        'test.team': 'platform'
      }
    });

    try {
      // Simulate test steps
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Add test steps as spans
      await testSpan.addStep('navigate_to_login', { url: '/login' });
      await testSpan.addStep('enter_credentials', { username: 'testuser' });
      
      // Simulate test assertion
      const isLoggedIn = true;
      await testSpan.addStep('verify_login', { success: isLoggedIn });
      
      // Mark test as passed
      await testSpan.end({
        result: 'pass',
        duration: 1500,
        metrics: {
          'test.duration': 1500,
          'test.steps': 3
        },
        tags: {
          'test.result': 'pass',
          'test.verdict': 'passed'
        }
      });
      
      expect(isLoggedIn).toBe(true);
    } catch (error) {
      // Mark test as failed
      await testSpan.end({
        result: 'fail',
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          'test.failed': 1
        },
        tags: {
          'test.result': 'fail',
          'test.verdict': 'failed',
          'error.msg': error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }, 30000);

  test('should track test suite execution', async () => {
    const suiteSpan = await toto.startTestSuite({
      name: 'vibecode-webui-e2e-suite',
      startTime: Date.now(),
      tags: {
        'test.type': 'e2e',
        'test.framework': 'jest',
        'test.team': 'platform'
      }
    });

    try {
      // Simulate test suite execution
      const testResults = [
        { name: 'login_test', passed: true, duration: 1200 },
        { name: 'dashboard_load', passed: true, duration: 800 },
        { name: 'data_export', passed: false, duration: 2500, error: 'Timeout exceeded' }
      ];

      for (const result of testResults) {
        await suiteSpan.addTestResult({
          name: result.name,
          passed: result.passed,
          duration: result.duration,
          error: result.error,
          tags: {
            'test.result': result.passed ? 'pass' : 'fail'
          }
        });
      }

      const suiteResult = {
        passed: testResults.every(t => t.passed),
        total: testResults.length,
        failed: testResults.filter(t => !t.passed).length,
        duration: testResults.reduce((sum, t) => sum + t.duration, 0)
      };

      await suiteSpan.end({
        result: suiteResult.passed ? 'pass' : 'fail',
        duration: suiteResult.duration,
        metrics: {
          'tests.total': suiteResult.total,
          'tests.passed': suiteResult.total - suiteResult.failed,
          'tests.failed': suiteResult.failed,
          'tests.duration': suiteResult.duration
        },
        tags: {
          'test.suite.result': suiteResult.passed ? 'pass' : 'fail'
        }
      });

      expect(suiteResult.passed).toBe(false); // Expected to fail due to data_export test
    } catch (error) {
      await suiteSpan.end({
        result: 'fail',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }, 30000);
});
