/**
 * Global teardown for Playwright E2E tests
 * Runs after all tests
 */
import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...')

  try {
    // Clean up test data
    console.log('🗑️  Cleaning up test data...')

    // You can add cleanup logic here
    // For example, delete test users, clean up test projects, etc.

    console.log('✅ E2E test teardown completed')

  } catch (error) {
    console.error('❌ E2E test teardown failed:', error)
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown
