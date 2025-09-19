/**
 * Global teardown for production E2E tests
 * Cleanup after testing against live deployment
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'http://20.36.249.127';

  console.log(`🧹 Cleaning up after E2E tests for: ${baseURL}`);

  try {
    // Log test completion
    console.log('✅ Production E2E tests completed');
    console.log('📊 Test results available in test-results/ directory');

    // Note: We don't need to stop any services since we're testing against live deployment
    console.log('ℹ️  Live deployment continues running');

  } catch (error) {
    console.error('⚠️  Teardown warning:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;