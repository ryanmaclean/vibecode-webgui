/**
 * Test Setup for Agent Tests
 *
 * Global setup and teardown for agent test suite
 */

import { mockServer } from './mocks/openai-api-server';

// Global setup
export async function setup() {
  console.log('🚀 Setting up agent test environment...');

  // Start mock server
  mockServer.listen({ onUnhandledRequest: 'warn' });

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JEST_TIMEOUT = '30000';

  console.log('✅ Agent test environment ready');
}

// Global teardown
export async function teardown() {
  console.log('🧹 Cleaning up agent test environment...');

  // Close mock server
  mockServer.close();

  console.log('✅ Agent test environment cleaned up');
}

// Default export for Jest
export default {
  setup,
  teardown,
};
