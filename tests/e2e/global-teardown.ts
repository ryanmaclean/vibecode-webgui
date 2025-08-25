/**
 * Global teardown for E2E tests
 * Cleans up test data and reports test metrics
 */

import { FullConfig } from '@playwright/test';
import { MonitoringService } from '../../src/lib/monitoring';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');
  
  // Initialize monitoring for cleanup tracking
  const monitoring = new MonitoringService();
  monitoring.init();
  
  try {
    // Clean up test artifacts
    await cleanupTestArtifacts();
    
    // Report test completion metrics
    await reportTestMetrics(monitoring);
    
    console.log('✅ E2E test environment cleanup complete');
    monitoring.trackEvent('e2e_teardown_completed', { success: true });
    
  } catch (error) {
    console.error('❌ E2E teardown failed:', error);
    monitoring.trackEvent('e2e_teardown_failed', { error: error.message });
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

async function reportTestMetrics(monitoring: MonitoringService) {
  console.log('📊 Reporting test completion metrics...');
  
  // Track test suite completion
  monitoring.trackEvent('e2e_test_suite_completed', {
    timestamp: new Date().toISOString(),
    environment: 'test'
  });
  
  // Log performance metrics if available
  try {
    const fs = await import('fs/promises');
    const resultsPath = 'playwright-report/results.json';
    const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
    
    monitoring.trackEvent('e2e_test_results', {
      totalTests: results.stats?.total || 0,
      passedTests: results.stats?.passed || 0,
      failedTests: results.stats?.failed || 0,
      duration: results.stats?.duration || 0
    });
    
  } catch (error) {
    console.log('⚠️ Could not read test results for metrics');
  }
}

export default globalTeardown;