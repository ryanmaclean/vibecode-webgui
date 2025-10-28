/**
 * Test suite for the new VectorDbErrorHandler implementation
 * Ensures error handling is consistent and backward compatible
 */

import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler, categorizeError } from '../mocks/vector-db-error-handler-new';
import { PostgresVectorDatabaseAdapter } from '../mocks/postgres-vector-database-adapter-new';
import { VectorDatabaseProvider } from '../mocks/vector-types';

// Import legacy error handling for compatibility tests
import { VectorDBError, VectorDBErrorType, handleVectorDBError } from '../mocks/vector-db-error-handler';

describe('Vector Database Error Handler', () => {
  describe('VectorDbError class', () => {
    it('should create error with default values', () => {
      const error = new VectorDbError('Test error message');
      
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('VectorDbError');
      expect(error.type).toBe(VectorDbErrorType.UNKNOWN_ERROR);
      expect(error.operation).toBe('unknown');
      expect(error.provider).toBe('unknown');
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeTruthy();
      expect(error.retryable).toBe(false);
    });

    it('should create error with custom values', () => {
      const error = new VectorDbError(
        'Connection failed',
        VectorDbErrorType.CONNECTION,
        'connect',
        'postgres',
        { host: 'localhost', port: 5432 },
        true
      );
      
      expect(error.message).toBe('Connection failed');
      expect(error.type).toBe(VectorDbErrorType.CONNECTION);
      expect(error.operation).toBe('connect');
      expect(error.provider).toBe('postgres');
      expect(error.details).toEqual({ host: 'localhost', port: 5432 });
      expect(error.retryable).toBe(true);
    });

    it('should sanitize sensitive information in toJSON', () => {
      const error = new VectorDbError(
        'Auth failed',
        VectorDbErrorType.AUTHENTICATION,
        'authenticate',
        'postgres',
        { 
          connectionString: 'postgres://user:password@localhost:5432/db',
          password: 'secret123',
          apiKey: 'ak_12345',
          host: 'localhost'
        }
      );
      
      const jsonError = error.toJSON();
      
      expect(jsonError.details.connectionString).toBe('[REDACTED]');
      expect(jsonError.details.password).toBe('[REDACTED]');
      expect(jsonError.details.apiKey).toBe('[REDACTED]');
      expect(jsonError.details.host).toBe('localhost');
    });
  });

  describe('VectorDbErrorHandler class', () => {
    let errorHandler: VectorDbErrorHandler;
    
    beforeEach(() => {
      errorHandler = new VectorDbErrorHandler('test-provider');
    });
    
    it('should detect authentication errors correctly', () => {
      const authError1 = new Error('Authentication failed');
      const authError2 = new Error('Invalid credentials');
      const authError3 = { status: 401, message: 'Unauthorized' };
      
      expect(errorHandler.isAuthError(authError1)).toBe(true);
      expect(errorHandler.isAuthError(authError2)).toBe(true);
      expect(errorHandler.isAuthError(authError3)).toBe(true);
      expect(errorHandler.isAuthError(new Error('Other error'))).toBe(false);
    });
    
    it('should detect network errors correctly', () => {
      const netError1 = new Error('Connection refused');
      const netError2 = { code: 'ECONNREFUSED', message: 'Cannot connect' };
      const netError3 = new Error('Network timeout');
      
      expect(errorHandler.isNetworkError(netError1)).toBe(true);
      expect(errorHandler.isNetworkError(netError2)).toBe(true);
      expect(errorHandler.isNetworkError(netError3)).toBe(true);
      expect(errorHandler.isNetworkError(new Error('Syntax error'))).toBe(false);
    });
    
    it('should detect timeout errors correctly', () => {
      const timeoutError1 = new Error('Operation timed out');
      const timeoutError2 = { code: 'ETIMEDOUT', message: 'Request timeout' };
      
      expect(errorHandler.isTimeoutError(timeoutError1)).toBe(true);
      expect(errorHandler.isTimeoutError(timeoutError2)).toBe(true);
      expect(errorHandler.isTimeoutError(new Error('Other error'))).toBe(false);
    });
    
    it('should identify retryable errors correctly', () => {
      const retryableError1 = new VectorDbError('Timeout', VectorDbErrorType.TIMEOUT, 'op', 'provider', {}, true);
      const retryableError2 = new Error('Connection reset');
      const nonRetryableError = new VectorDbError('Invalid query', VectorDbErrorType.QUERY_FAILED, 'op', 'provider', {}, false);
      
      expect(errorHandler.isRetryableError(retryableError1)).toBe(true);
      expect(errorHandler.isRetryableError(retryableError2)).toBe(true);
      expect(errorHandler.isRetryableError(nonRetryableError)).toBe(false);
    });
    
    it('should handle errors correctly', () => {
      const originalError = new Error('Test error');
      const handledError = errorHandler.handleError(
        originalError,
        'testOperation',
        VectorDbErrorType.QUERY_FAILED,
        true,
        { param1: 'value1' }
      );
      
      expect(handledError).toBeInstanceOf(VectorDbError);
      expect(handledError.message).toBe('Test error');
      expect(handledError.type).toBe(VectorDbErrorType.QUERY_FAILED);
      expect(handledError.operation).toBe('testOperation');
      expect(handledError.provider).toBe('test-provider');
      expect(handledError.retryable).toBe(true);
      expect(handledError.details).toHaveProperty('param1', 'value1');
      expect(handledError.details).toHaveProperty('retryable', true);
    });
    
    it('should update existing VectorDbError when handling', () => {
      const existingError = new VectorDbError(
        'Existing error',
        VectorDbErrorType.CONNECTION,
        'connect',
        'original-provider',
        { existing: true },
        false
      );
      
      const updatedError = errorHandler.handleError(
        existingError,
        'newOperation',
        undefined,
        true,
        { new: true }
      );
      
      expect(updatedError).toBe(existingError); // Should be the same object
      expect(updatedError.retryable).toBe(true); // Should be updated
      expect(updatedError.details).toHaveProperty('existing', true); // Should keep original details
      expect(updatedError.details).toHaveProperty('new', true); // Should add new details
      expect(updatedError.type).toBe(VectorDbErrorType.CONNECTION); // Should keep original type
      expect(updatedError.provider).toBe('original-provider'); // Should keep original provider
    });
  });

  describe('categorizeError function', () => {
    it('should categorize connection errors', () => {
      expect(categorizeError({ code: 'ECONNREFUSED', message: 'Connection refused' }))
        .toBe(VectorDbErrorType.CONNECTION);
      expect(categorizeError(new Error('Failed to connect to database')))
        .toBe(VectorDbErrorType.CONNECTION);
    });
    
    it('should categorize authentication errors', () => {
      expect(categorizeError({ status: 401, message: 'Unauthorized' }))
        .toBe(VectorDbErrorType.AUTHORIZATION_ERROR);
      expect(categorizeError(new Error('Invalid credentials')))
        .toBe(VectorDbErrorType.AUTHORIZATION_ERROR);
    });
    
    it('should categorize timeout errors', () => {
      expect(categorizeError({ code: 'ETIMEDOUT', message: 'Request timed out' }))
        .toBe(VectorDbErrorType.TIMEOUT);
      expect(categorizeError(new Error('Operation timed out')))
        .toBe(VectorDbErrorType.TIMEOUT);
    });
    
    it('should categorize query errors', () => {
      expect(categorizeError({ code: 'EQUERY', message: 'SQL syntax error' }))
        .toBe(VectorDbErrorType.QUERY_FAILED);
      expect(categorizeError(new Error('Error in SQL query')))
        .toBe(VectorDbErrorType.QUERY_FAILED);
    });
    
    it('should default to unknown error for uncategorized errors', () => {
      expect(categorizeError(new Error('Some random error')))
        .toBe(VectorDbErrorType.UNKNOWN_ERROR);
      expect(categorizeError({ message: 'Uncategorized error' }))
        .toBe(VectorDbErrorType.UNKNOWN_ERROR);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy error type constants', () => {
      // Legacy constants should map to new enum values
      expect(VectorDBErrorType.CONNECTION_FAILED).toBe(VectorDbErrorType.CONNECTION);
      expect(VectorDBErrorType.SIMILARITY_SEARCH_FAILED).toBe(VectorDbErrorType.SEARCH);
      expect(VectorDBErrorType.VECTOR_CREATION_FAILED).toBe(VectorDbErrorType.VECTOR_OPERATION_FAILED);
    });
    
    it('should ensure handleVectorDBError is compatible with new error handler', () => {
      const legacyError = handleVectorDBError(
        new Error('Legacy error'),
        'testOperation',
        'legacy-provider'
      );
      
      const newErrorHandler = new VectorDbErrorHandler('test-provider');
      const newError = newErrorHandler.handleError(
        new Error('New error'),
        'testOperation'
      );
      
      // Both should produce VectorDbError instances
      expect(legacyError).toBeInstanceOf(VectorDBError);
      expect(newError).toBeInstanceOf(VectorDbError);
      
      // Legacy errors should have required properties
      expect(legacyError).toHaveProperty('type');
      expect(legacyError).toHaveProperty('operation', 'testOperation');
      expect(legacyError).toHaveProperty('provider', 'legacy-provider');
    });
  });

  describe('Integration with PostgresVectorDatabaseAdapter', () => {
    let adapter: PostgresVectorDatabaseAdapter;
    
    beforeEach(() => {
      adapter = new PostgresVectorDatabaseAdapter({
        provider: VectorDatabaseProvider.POSTGRES,
        connectionString: 'postgres://fake:fake@localhost:5432/fake',
        enableLogging: false
      });
    });
    
    it('should handle initialization errors correctly', async () => {
      try {
        // This should fail since we're using fake connection details
        await adapter.initialize();
        fail('Expected initialization to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(VectorDbError);
        expect(error.type).toBe(VectorDbErrorType.INITIALIZATION);
        expect(error.operation).toBe('initializeProvider');
        expect(error.provider).toBe('postgres');
        expect(error.details).toBeTruthy();
      }
    });
  });
});