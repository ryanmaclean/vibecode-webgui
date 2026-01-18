/**
 * Global teardown for E2E tests
 * Cleans up test data and reports test metrics
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');
  
  try {
    // Clean up test artifacts
    await cleanupTestArtifacts();
    
    console.log('✅ E2E test environment cleanup complete');
    
  } catch (error) {
    console.error('❌ E2E teardown failed:', error);
  }
}

async function cleanupTestArtifacts() {
  console.log('🗑️ Cleaning up test artifacts...');
  
  // Remove temporary auth files
  const fs = await import('fs/promises');
  try {
    await fs.unlink('tests/e2e/auth-state.json');
  } catch (error) {
    // File might not exist, which is fine
  }
  
  // Additional cleanup can be added here
  console.log('✅ Test artifacts cleaned up');
}

export default globalTeardown;