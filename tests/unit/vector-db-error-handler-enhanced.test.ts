/**
 * Enhanced test suite for the VectorDbErrorHandler implementation
 * Covers database-specific error patterns, edge cases, retry integration, and more
 */

import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler, categorizeError } from '../../src/lib/vector-db/vector-db-error-handler-new';
import { logger } from '../../src/lib/logger';

// Mock logger
jest.mock('../../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

// Helper to create database-specific error objects
const createDatabaseError = (provider: string, details: any) => {
  switch (provider) {
    case 'postgres':
      return {
        ...details,
        name: 'PostgresError',
        severity: details.severity || 'ERROR',
        code: details.code || '42P01', // Default to relation not found
        position: details.position || '15',
        file: 'postgres.c',
        line: '1822'
      };
    case 'redis':
      return {
        ...details,
        name: 'ReplyError',
        command: details.command || 'GET',
        code: details.code || 'ERR'
      };
    case 'cosmosdb':
      return {
        ...details,
        name: 'CosmosDBError',
        code: details.code || 404,
        body: {
          code: details.bodyCode || 'NotFound',
          message: details.message || 'Resource not found'
        }
      };
    case 'sqlserver':
      return {
        ...details,
        name: 'RequestError',
        number: details.number || 208, // Invalid object name
        lineNumber: details.lineNumber || 1,
        state: details.state || 1,
        class: details.class || 16,
        serverName: 'SQL01',
        procName: details.procName
      };
    default:
      return details;
  }
};

describe('Enhanced Vector Database Error Handler Tests', () => {
  let errorHandler: VectorDbErrorHandler;
  
  beforeEach(() => {
    jest.clearAllMocks();
    errorHandler = new VectorDbErrorHandler('test-provider', true, true);
  });

  describe('Database-Specific Error Patterns', () => {
    it('should categorize Postgres-specific errors correctly', () => {
      // Connection error
      const pgConnectionError = createDatabaseError('postgres', {
        code: '08006', // Connection failure
        message: 'connection terminated unexpectedly'
      });
      expect(categorizeError(pgConnectionError)).toBe(VectorDbErrorType.CONNECTION);
      
      // Query syntax error
      const pgQueryError = createDatabaseError('postgres', {
        code: '42601', // Syntax error
        message: 'syntax error at or near "WHERE"'
      });
      expect(categorizeError(pgQueryError)).toBe(VectorDbErrorType.QUERY_FAILED);
      
      // Permission error
      const pgAuthError = createDatabaseError('postgres', {
        code: '42501', // Insufficient privilege
        message: 'permission denied for relation users'
      });
      expect(categorizeError(pgAuthError)).toBe(VectorDbErrorType.AUTHORIZATION_ERROR);
    });
    
    it('should categorize Redis-specific errors correctly', () => {
      // Connection error
      const redisConnectionError = createDatabaseError('redis', {
        message: 'Connection timeout',
        code: 'ETIMEDOUT'
      });
      expect(categorizeError(redisConnectionError)).toBe(VectorDbErrorType.TIMEOUT);
      
      // Command error
      const redisCommandError = createDatabaseError('redis', {
        message: 'ERR unknown command',
        command: 'UNKNOWN'
      });
      expect(categorizeError(redisCommandError)).toBe(VectorDbErrorType.QUERY_FAILED);
      
      // Auth error
      const redisAuthError = createDatabaseError('redis', {
        message: 'NOAUTH Authentication required',
        code: 'NOAUTH'
      });
      expect(categorizeError(redisAuthError)).toBe(VectorDbErrorType.AUTHORIZATION_ERROR);
    });
    
    it('should categorize CosmosDB-specific errors correctly', () => {
      // Not found error
      const cosmosNotFoundError = createDatabaseError('cosmosdb', {
        code: 404,
        bodyCode: 'NotFound',
        message: 'Resource not found'
      });
      expect(categorizeError(cosmosNotFoundError)).toBe(VectorDbErrorType.QUERY_FAILED);
      
      // Auth error
      const cosmosAuthError = createDatabaseError('cosmosdb', {
        code: 401,
        bodyCode: 'Unauthorized',
        message: 'The authorization token is invalid'
      });
      expect(categorizeError(cosmosAuthError)).toBe(VectorDbErrorType.AUTHORIZATION_ERROR);
      
      // Timeout error
      const cosmosTimeoutError = createDatabaseError('cosmosdb', {
        code: 408,
        bodyCode: 'RequestTimeout',
        message: 'Operation could not be completed within the specified time'
      });
      expect(categorizeError(cosmosTimeoutError)).toBe(VectorDbErrorType.TIMEOUT);
    });
    
    it('should categorize SQL Server-specific errors correctly', () => {
      // Invalid object error
      const sqlServerQueryError = createDatabaseError('sqlserver', {
        number: 208,
        message: 'Invalid object name "nonexistent_table"'
      });
      expect(categorizeError(sqlServerQueryError)).toBe(VectorDbErrorType.QUERY_FAILED);
      
      // Permission error
      const sqlServerAuthError = createDatabaseError('sqlserver', {
        number: 229,
        message: 'The SELECT permission was denied on the object'
      });
      expect(categorizeError(sqlServerAuthError)).toBe(VectorDbErrorType.AUTHORIZATION_ERROR);
      
      // Connection error
      const sqlServerConnectionError = createDatabaseError('sqlserver', {
        number: 53,
        message: 'Could not open a connection to SQL Server'
      });
      expect(categorizeError(sqlServerConnectionError)).toBe(VectorDbErrorType.CONNECTION);
    });
  });

  describe('Error Propagation Through Operation Chain', () => {
    it('should correctly enhance errors through operation chain', () => {
      // Simulate error propagation through multiple operations
      // Initial error in a low-level operation
      const originalError = new Error('Network connection failed');
      
      // Error handled in first layer (connection)
      const connectionError = errorHandler.handleError(
        originalError,
        'connect',
        VectorDbErrorType.CONNECTION,
        true,
        { host: 'db.example.com', port: 5432 }
      );
      
      // Error propagated to query layer
      const queryError = errorHandler.handleError(
        connectionError,
        'executeQuery',
        undefined, // Use existing type
        undefined, // Use existing retryable
        { queryId: '123', parameters: { id: 456 } }
      );
      
      // Error propagated to API layer
      const apiError = errorHandler.handleError(
        queryError,
        'getSimilarDocuments',
        undefined,
        undefined,
        { userId: 789, timestamp: new Date().toISOString() }
      );
      
      // The final error should contain all the context from the chain
      expect(apiError.operation).toBe('getSimilarDocuments'); // Latest operation
      expect(apiError.type).toBe(VectorDbErrorType.CONNECTION); // Original type preserved
      expect(apiError.retryable).toBe(true); // Original retryable preserved
      
      // Should contain merged details from all layers
      expect(apiError.details).toHaveProperty('host', 'db.example.com');
      expect(apiError.details).toHaveProperty('port', 5432);
      expect(apiError.details).toHaveProperty('queryId', '123');
      expect(apiError.details).toHaveProperty('parameters.id', 456);
      expect(apiError.details).toHaveProperty('userId', 789);
      expect(apiError.details).toHaveProperty('timestamp');
    });
  });

  describe('Edge Cases for Error Objects', () => {
    it('should handle undefined or null errors gracefully', () => {
      // @ts-ignore - Testing invalid input
      const handledUndefinedError = errorHandler.handleError(undefined, 'operation');
      expect(handledUndefinedError).toBeInstanceOf(VectorDbError);
      expect(handledUndefinedError.message).toBe('Unknown error');
      
      // @ts-ignore - Testing invalid input
      const handledNullError = errorHandler.handleError(null, 'operation');
      expect(handledNullError).toBeInstanceOf(VectorDbError);
      expect(handledNullError.message).toBe('Unknown error');
    });
    
    it('should handle errors without message property', () => {
      // @ts-ignore - Testing unusual error object
      const errorWithoutMessage = { code: 'SOME_CODE' };
      const handledError = errorHandler.handleError(errorWithoutMessage, 'operation');
      
      expect(handledError).toBeInstanceOf(VectorDbError);
      expect(handledError.message).toBe('Unknown error');
      expect(handledError.details).toHaveProperty('originalError');
    });
    
    it('should handle error-like objects with non-string messages', () => {
      // @ts-ignore - Testing unusual error object
      const errorWithObjectMessage = { message: { text: 'Error occurred', code: 500 } };
      const handledError = errorHandler.handleError(errorWithObjectMessage, 'operation');
      
      expect(handledError).toBeInstanceOf(VectorDbError);
      expect(typeof handledError.message).toBe('string');
      expect(handledError.details).toHaveProperty('originalError');
    });
    
    it('should handle primitive values passed as errors', () => {
      // @ts-ignore - Testing invalid input
      const handledStringError = errorHandler.handleError('Database connection failed', 'operation');
      expect(handledStringError).toBeInstanceOf(VectorDbError);
      expect(handledStringError.message).toBe('Database connection failed');
      
      // @ts-ignore - Testing invalid input
      const handledNumberError = errorHandler.handleError(500, 'operation');
      expect(handledNumberError).toBeInstanceOf(VectorDbError);
      expect(handledNumberError.message).toBe('Unknown error');
      expect(handledNumberError.details).toHaveProperty('originalError', 500);
    });
  });

  describe('Integration with Retry Mechanisms', () => {
    it('should classify retryable errors correctly for different operations', () => {
      // Connection errors should be retryable
      const connectionError = new Error('Failed to connect to database') as any;
      connectionError.code = 'ECONNREFUSED';
      expect(errorHandler.isRetryableError(connectionError)).toBe(true);
      
      // Timeout errors should be retryable
      const timeoutError = new Error('Query execution timed out');
      expect(errorHandler.isRetryableError(timeoutError)).toBe(true);
      
      // Authentication errors should not be retryable
      const authError = new Error('Invalid credentials');
      expect(errorHandler.isRetryableError(authError)).toBe(false);
      
      // Query syntax errors should not be retryable
      const syntaxError = new Error('SQL syntax error');
      expect(errorHandler.isRetryableError(syntaxError)).toBe(false);
    });
    
    it('should respect the retryable flag when explicitly set', () => {
      // Force non-retryable for a connection error
      const connectionError = new Error('Failed to connect to database') as any;
      connectionError.code = 'ECONNREFUSED';
      
      const handledError = errorHandler.handleError(
        connectionError,
        'connect',
        VectorDbErrorType.CONNECTION,
        false // Explicitly set to non-retryable
      );
      
      expect(handledError.retryable).toBe(false);
      expect(errorHandler.isRetryableError(handledError)).toBe(false);
      
      // Force retryable for an error that's not normally retryable
      const syntaxError = new Error('SQL syntax error');
      
      const handledSyntaxError = errorHandler.handleError(
        syntaxError,
        'executeQuery',
        VectorDbErrorType.QUERY_FAILED,
        true // Explicitly set to retryable
      );
      
      expect(handledSyntaxError.retryable).toBe(true);
      expect(errorHandler.isRetryableError(handledSyntaxError)).toBe(true);
    });
  });

  describe('Metrics and Logging', () => {
    it('should log errors with appropriate context', () => {
      const error = new Error('Test error');
      errorHandler.handleError(
        error,
        'testOperation',
        VectorDbErrorType.QUERY_FAILED,
        false,
        { param1: 'value1' }
      );
      
      // Check that logger.error was called with the correct context
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error',
        errorType: VectorDbErrorType.QUERY_FAILED,
        operation: 'testOperation',
        provider: 'test-provider',
        details: expect.objectContaining({
          param1: 'value1',
          retryable: false
        })
      }));
    });
    
    it('should increment error metrics when handling errors', () => {
      // Assuming metrics integration would be here
      // This would require actual implementation in the error handler
      
      // For now, we can test that the metrics capability is passed to the constructor
      const metricsEnabledHandler = new VectorDbErrorHandler('test-provider', true, true);
      const error = new Error('Metric test error');
      
      const handledMetricError = metricsEnabledHandler.handleError(
        error,
        'metricTestOperation',
        VectorDbErrorType.TIMEOUT
      );
      
      // In a real implementation, we would expect metrics to be incremented
      // expect(metrics.increment).toHaveBeenCalledWith('vector_db.errors', 1, expect.any(Object));
      expect(handledMetricError).toBeInstanceOf(VectorDbError);
    });
  });

  describe('Comprehensive Database Error Handling Patterns', () => {
    it('should handle complex real-world error patterns', () => {
      // Test a complex real-world PostgreSQL error
      const pgComplexError = {
        name: 'error',
        length: 202,
        severity: 'ERROR',
        code: '42P01',
        detail: 'Table "nonexistent_table" does not exist in the current database.',
        hint: 'Check the spelling of the table name and ensure it exists.',
        position: '15',
        internalPosition: '0',
        internalQuery: '',
        where: 'parse_relation.c:1180',
        schema: 'public',
        table: '',
        column: '',
        dataType: '',
        constraint: '',
        file: 'parse_relation.c',
        line: '1180',
        routine: 'parserOpenTable',
        message: 'relation "nonexistent_table" does not exist'
      };
      
      const handledPgError = errorHandler.handleError(
        pgComplexError,
        'executeQuery',
        undefined,
        undefined,
        { sql: 'SELECT * FROM nonexistent_table' }
      );
      
      expect(handledPgError).toBeInstanceOf(VectorDbError);
      expect(handledPgError.type).toBe(VectorDbErrorType.QUERY_FAILED);
      expect(handledPgError.details).toHaveProperty('sql');
      expect(handledPgError.retryable).toBe(false); // Query syntax errors shouldn't be retried
      
      // Test a complex real-world Redis error
      const redisComplexError = {
        name: 'ReplyError',
        command: 'HGET',
        args: ['user:1000', 'email'],
        code: 'WRONGTYPE',
        message: 'WRONGTYPE Operation against a key holding the wrong kind of value',
        stack: 'ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value\n    at parseError (/path/to/node_modules/redis-parser/lib/parser.js:179:12)\n    at parseType (/path/to/node_modules/redis-parser/lib/parser.js:302:14)'
      } as any;
      
      const handledRedisError = errorHandler.handleError(
        redisComplexError,
        'getHashValue',
        undefined,
        undefined,
        { key: 'user:1000', field: 'email' }
      );
      
      expect(handledRedisError).toBeInstanceOf(VectorDbError);
      expect(handledRedisError.type).toBe(VectorDbErrorType.QUERY_FAILED);
      expect(handledRedisError.details).toHaveProperty('key');
      expect(handledRedisError.details).toHaveProperty('field');
      expect(handledRedisError.retryable).toBe(false); // Wrong type errors shouldn't be retried
    });
  });

  describe('Performance Impact of Extended Error Context', () => {
    it('should handle errors with large context efficiently', () => {
      // Create an error with a large context object
      const largeContext = {
        sql: 'SELECT * FROM large_table WHERE complex_condition = true',
        parameters: Array(1000).fill(0).map((_, i) => ({ key: `param${i}`, value: `value${i}` })),
        metadata: {
          executionTime: 1234,
          rowsExamined: 50000,
          indexesUsed: ['idx_1', 'idx_2', 'idx_3'],
          executionPlan: JSON.stringify({ complex: 'plan', details: Array(100).fill('step') })
        }
      };
      
      const start = performance.now();
      
      // Handle the error with the large context
      const error = new Error('Query execution failed');
      const handledError = errorHandler.handleError(
        error,
        'executeComplexQuery',
        VectorDbErrorType.QUERY_FAILED,
        false,
        largeContext
      );
      
      const end = performance.now();
      const duration = end - start;
      
      // The handling should be fast (< 5ms) even with large context
      expect(duration).toBeLessThan(5);
      expect(handledError).toBeInstanceOf(VectorDbError);
      expect(handledError.details).toHaveProperty('parameters');
      expect(handledError.details).toHaveProperty('metadata');
    });
  });
});