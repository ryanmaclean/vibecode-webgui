/**
 * Manual test script for vector database error handling
 * This script tests real-world error scenarios with the new error handler
 */

import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from '../../src/lib/vector-db/vector-db-error-handler-new';
import { PostgresVectorDatabaseAdapter } from '../../src/lib/vector-db/postgres-vector-database-adapter-new';
import { VectorDatabaseProvider } from '../../src/lib/vector-db/vector-types';
import { EnhancedVectorDatabaseAdapter } from '../../src/lib/vector-db/enhanced-vector-database-adapter-new';

// Test connection failures
async function testConnectionFailures() {
  console.log('=== Testing Connection Failures ===');
  
  // Invalid connection string
  const adapter = new PostgresVectorDatabaseAdapter({
    provider: VectorDatabaseProvider.POSTGRES,
    connectionString: 'postgres://invalid:invalid@localhost:5432/nonexistent',
    enableLogging: true
  });
  
  try {
    console.log('Attempting to initialize with invalid connection...');
    await adapter.initialize();
  } catch (error) {
    console.log('Error caught:');
    console.log('- Type:', error.type);
    console.log('- Message:', error.message);
    console.log('- Operation:', error.operation);
    console.log('- Retryable:', error.retryable);
    console.log('- Details:', JSON.stringify(error.details, null, 2));
  }
}

// Test enhanced adapter with retry mechanism
async function testRetryMechanism() {
  console.log('\n=== Testing Retry Mechanism ===');
  
  // Create base adapter with invalid connection
  const baseAdapter = new PostgresVectorDatabaseAdapter({
    provider: VectorDatabaseProvider.POSTGRES,
    connectionString: 'postgres://invalid:invalid@localhost:5432/nonexistent',
    enableLogging: true
  });
  
  // Wrap with enhanced adapter for retry
  const enhancedAdapter = new EnhancedVectorDatabaseAdapter(
    baseAdapter,
    {
      provider: VectorDatabaseProvider.POSTGRES,
      enableLogging: true
    },
    {
      maxRetries: 2,
      baseDelay: 100 // Fast retries for testing
    }
  );
  
  try {
    console.log('Attempting to search with retry...');
    await enhancedAdapter.search([0.1, 0.2, 0.3]);
  } catch (error) {
    console.log('Error caught after retries:');
    console.log('- Type:', error.type);
    console.log('- Message:', error.message);
    console.log('- Operation:', error.operation);
    console.log('- Retryable:', error.retryable);
    console.log('- Details:', JSON.stringify(error.details, null, 2));
    
    // Get retry status
    const status = enhancedAdapter.getRetryStatus();
    console.log('Retry status:');
    console.log('- Circuit broken:', status.circuitBroken);
    console.log('- Recent failures:', status.recentFailures);
  }
}

// Test error handler directly
function testErrorHandler() {
  console.log('\n=== Testing Error Handler Directly ===');
  
  const errorHandler = new VectorDbErrorHandler('test-provider');
  
  // Test different error types
  const errors = [
    new Error('Connection refused'),
    { code: 'ECONNRESET', message: 'Connection reset by peer' },
    new Error('Authentication failed'),
    { status: 401, message: 'Unauthorized' },
    new Error('Query timeout'),
    { code: 'ETIMEDOUT', message: 'Operation timed out' }
  ];
  
  errors.forEach((err, index) => {
    const handledError = errorHandler.handleError(
      err,
      `testOperation${index}`,
      undefined, // Let the handler determine the type
      undefined, // Let the handler determine if retryable
      { testIndex: index }
    );
    
    console.log(`\nError ${index + 1}:`);
    console.log('- Type:', handledError.type);
    console.log('- Message:', handledError.message);
    console.log('- Operation:', handledError.operation);
    console.log('- Retryable:', handledError.retryable);
    console.log('- Details:', JSON.stringify(handledError.details, null, 2));
  });
}

// Run all tests
async function runTests() {
  try {
    await testConnectionFailures();
    await testRetryMechanism();
    testErrorHandler();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Unexpected error in test runner:', error);
  }
}

// Run the tests
runTests();