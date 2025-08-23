/**
 * Global teardown for Playwright tests
 * This runs once after all tests complete
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');
  
  try {
    // Clean up any test data or resources
    console.log('🗑️ Cleaning up test resources...');
    
    // Here you could:
    // - Clean up test databases
    // - Remove test files
    // - Reset application state
    // - Send test results to monitoring systems
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here as it would fail the entire test run
  }
}

export default globalTeardown;