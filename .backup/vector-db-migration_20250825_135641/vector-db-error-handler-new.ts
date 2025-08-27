/**
 * Vector Database Error Handler
 * Standardized error handling for vector database operations
 * 
 * @module vector-db-error-handler
 * @description This module provides a standardized approach to error handling for vector database operations.
 * It includes a class-based error handler, error categorization, and utilities for error management.
 * 
 * @example
 * // Initialize the error handler in your adapter
 * this.errorHandler = new VectorDbErrorHandler(
 *   'postgres',
 *   this.config.enableLogging || false,
 *   this.config.enableMetrics || false
 * );
 * 
 * // Handle errors with proper context
 * try {
 *   // Database operation
 * } catch (error) {
 *   throw this.errorHandler.handleError(
 *     error,
 *     'currentOperation',
 *     VectorDbErrorType.QUERY_FAILED,
 *     isRetryable,
 *     { additionalContext: 'value' }
 *   );
 * }
 */

import { logger } from '../logger';
import { categorizeErrorWithProvider, isRetryableWithProvider } from './database-error-patterns';

/**
 * Vector database error types
 * Defines the categories of errors that can occur in vector database operations
 */
export enum VectorDbErrorType {
  // Connection related errors
  CONNECTION = 'CONNECTION',                             // Generic connection error
  
  // Initialization errors
  INITIALIZATION = 'INITIALIZATION',                     // Error during adapter initialization
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',           // Error in configuration
  
  // Authentication and authorization
  AUTHENTICATION = 'AUTHENTICATION',                     // Authentication failure
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',           // Authorization/permission failure
  
  // Query errors
  QUERY_FAILED = 'QUERY_FAILED',                         // Generic query failure
  SEARCH = 'SEARCH',                                     // Error during search operation
  
  // Timeouts
  TIMEOUT = 'TIMEOUT',                                   // Generic timeout
  
  // Service errors
  SERVICE = 'SERVICE',                                   // Service unavailable or error
  
  // Vector operations
  VECTOR_OPERATION_FAILED = 'VECTOR_OPERATION_FAILED',   // Generic vector operation error
  
  // Embedding generation
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED', // Error generating embeddings
  
  // Index operations
  INDEX_OPERATION_FAILED = 'INDEX_OPERATION_FAILED',     // Error with index operations
  
  // Feature support
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',       // Operation not supported by provider
  
  // Fallback
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'                        // Unclassified error
}

// Legacy types for backward compatibility
// @deprecated Use VectorDbErrorType.CONNECTION instead
export const CONNECTION_FAILED = VectorDbErrorType.CONNECTION;
// @deprecated Use VectorDbErrorType.SEARCH instead
export const SIMILARITY_SEARCH_FAILED = VectorDbErrorType.SEARCH;
// @deprecated Use VectorDbErrorType.VECTOR_OPERATION_FAILED instead
export const VECTOR_CREATION_FAILED = VectorDbErrorType.VECTOR_OPERATION_FAILED;
export const VECTOR_UPDATE_FAILED = VectorDbErrorType.VECTOR_OPERATION_FAILED;
export const VECTOR_DELETION_FAILED = VectorDbErrorType.VECTOR_OPERATION_FAILED;

// Legacy alias for backward compatibility
export const VectorDBErrorType = VectorDbErrorType;

/**
 * Standard error class for vector database operations
 */
export class VectorDbError extends Error {
  type: VectorDbErrorType;
  operation: string;
  provider: string;
  details: any;
  timestamp: string;
  retryable: boolean;

  constructor(
    message: string,
    type: VectorDbErrorType = VectorDbErrorType.UNKNOWN_ERROR,
    operation: string = 'unknown',
    provider: string = 'unknown',
    details: any = null,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'VectorDbError';
    this.type = type;
    this.operation = operation;
    this.provider = provider;
    this.details = details || {};
    this.timestamp = new Date().toISOString();
    this.retryable = retryable;

    // Log error details
    this.logError();
  }

  private logError() {
    logger.error({
      message: this.message,
      errorType: this.type,
      operation: this.operation,
      provider: this.provider,
      details: this.details,
      timestamp: this.timestamp
    });
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      operation: this.operation,
      provider: this.provider,
      timestamp: this.timestamp,
      retryable: this.retryable,
      // Only include non-sensitive details
      details: this.sanitizeDetails(this.details)
    };
  }

  private sanitizeDetails(details: any) {
    if (!details) return null;

    // Create a copy to avoid modifying the original
    const sanitized = { ...details };

    // Remove sensitive information
    const sensitiveKeys = [
      'password', 'apiKey', 'api_key', 'secret', 'token', 'connectionString',
      'connection_string', 'auth', 'credential', 'credentials'
    ];

    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Legacy alias for backward compatibility
export const VectorDBError = VectorDbError;

/**
 * Helper function to categorize errors based on common patterns
 * @param error Any error object to analyze
 * @returns The appropriate VectorDbErrorType
 */
export function categorizeError(error: any): VectorDbErrorType {
  const message = (error?.message || '').toLowerCase();
  const code = (error?.code || '').toString();
  const name = error?.name || '';
  const status = error?.status || error?.statusCode || 0;
  const number = error?.number || error?.errno || 0; // SQL Server error number or Node.js errno
  const severity = error?.severity || ''; // PostgreSQL severity
  const pgCode = error?.pgCode || error?.code || ''; // PostgreSQL error code
  
  // Database-specific error identification
  
  // PostgreSQL specific errors
  if (name === 'PostgresError' || name === 'PG:Error' || severity === 'ERROR' || severity === 'FATAL') {
    // Connection errors
    if (
      pgCode === '08000' || // connection_exception
      pgCode === '08003' || // connection_does_not_exist
      pgCode === '08006' || // connection_failure
      pgCode === '08001' || // sqlclient_unable_to_establish_sqlconnection
      pgCode === '08004'    // sqlserver_rejected_establishment_of_sqlconnection
    ) {
      return VectorDbErrorType.CONNECTION;
    }
    
    // Authentication errors
    if (
      pgCode === '28P01' || // invalid_password
      pgCode === '28000'    // invalid_authorization_specification
    ) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
    
    // Permission errors
    if (
      pgCode === '42501' || // insufficient_privilege
      pgCode.startsWith('2F')  // SQL routine exception
    ) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
    
    // Query errors
    if (
      pgCode.startsWith('42') || // syntax error or access rule violation
      pgCode.startsWith('22')    // data exception
    ) {
      return VectorDbErrorType.QUERY_FAILED;
    }
    
    // Unsupported features
    if (pgCode === '0A000') { // feature_not_supported
      return VectorDbErrorType.UNSUPPORTED_OPERATION;
    }
  }
  
  // SQL Server specific errors
  if (name === 'RequestError' || name === 'MSSQLError') {
    // Login/permission errors
    if (
      number === 18456 || // Login failed
      number === 15151 || // Cannot execute in the current database
      number === 229     // Execute permission denied
    ) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
    
    // Connection errors
    if (
      number === 53 ||   // Unable to open connection
      number === 10053 || // Transport-level error
      number === 10054 || // Connection reset
      number === 10060 || // Connection timeout
      number === 10061 || // Connection refused
      number === 40613    // Database unavailable
    ) {
      return VectorDbErrorType.CONNECTION;
    }
    
    // Query errors
    if (
      number === 102 ||  // Syntax error
      number === 156 ||  // Incorrect syntax
      number === 207 ||  // Invalid column name
      number === 208     // Invalid object name
    ) {
      return VectorDbErrorType.QUERY_FAILED;
    }
    
    // Timeout errors
    if (
      number === 1222 || // Lock timeout
      number === -2      // Timeout expired
    ) {
      return VectorDbErrorType.TIMEOUT;
    }
  }
  
  // Redis specific errors
  if (name === 'ReplyError' || message.includes('redis')) {
    // Authentication errors
    if (
      message.includes('noauth') ||
      message.includes('acl') ||
      code === 'NOAUTH'
    ) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
    
    // Command/query errors
    if (
      message.includes('wrong kind') ||
      message.includes('wrong type') ||
      message.includes('unknown command') ||
      code === 'WRONGTYPE'
    ) {
      return VectorDbErrorType.QUERY_FAILED;
    }
    
    // Redis-specific connection errors
    if (message.includes('connection') || message.includes('connect')) {
      return VectorDbErrorType.CONNECTION;
    }
  }
  
  // CosmosDB specific errors
  if (name === 'CosmosDBError' || (status >= 400 && message.includes('cosmos'))) {
    // Not found errors
    if (status === 404) {
      return VectorDbErrorType.QUERY_FAILED;
    }
    
    // Auth errors
    if (status === 401 || status === 403) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
    
    // Timeout errors
    if (status === 408 || status === 504) {
      return VectorDbErrorType.TIMEOUT;
    }
    
    // Service errors
    if (status === 503 || status >= 500) {
      return VectorDbErrorType.SERVICE;
    }
  }
  
  // Generic error categorization
  
  // Connection errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    name === 'ConnectionError' ||
    message.includes('connect') ||
    message.includes('connection')
  ) {
    return VectorDbErrorType.CONNECTION;
  }
  
  // Authentication/Authorization errors
  if (
    code === 'EAUTH' ||
    status === 401 ||
    status === 403 ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('auth') ||
    message.includes('permission') ||
    message.includes('credentials')
  ) {
    return VectorDbErrorType.AUTHORIZATION_ERROR;
  }
  
  // Query errors
  if (
    code === 'EQUERY' ||
    message.includes('query') ||
    message.includes('sql')
  ) {
    return VectorDbErrorType.QUERY_FAILED;
  }
  
  // Timeout errors
  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return VectorDbErrorType.TIMEOUT;
  }
  
  // Service errors
  if (
    code === '503' ||
    message.includes('service') ||
    message.includes('unavailable')
  ) {
    return VectorDbErrorType.SERVICE;
  }
  
  // Initialization errors
  if (
    message.includes('initialize') ||
    message.includes('init') ||
    message.includes('not initialized')
  ) {
    return VectorDbErrorType.INITIALIZATION;
  }
  
  // Vector operation errors
  if (
    message.includes('vector') ||
    message.includes('embedding')
  ) {
    return VectorDbErrorType.VECTOR_OPERATION_FAILED;
  }
  
  // Search errors
  if (
    message.includes('search') ||
    message.includes('similarity')
  ) {
    return VectorDbErrorType.SEARCH;
  }
  
  // Unsupported operation
  if (
    message.includes('not implemented') ||
    message.includes('unsupported')
  ) {
    return VectorDbErrorType.UNSUPPORTED_OPERATION;
  }
  
  // Default to unknown error
  return VectorDbErrorType.UNKNOWN_ERROR;
}

/**
 * Legacy function-based error handler (for backward compatibility)
 * @deprecated Use VectorDbErrorHandler class instead
 */
export const handleVectorDBError = (
  error: any,
  operation: string,
  provider: string
): VectorDbError => {
  // If already a VectorDbError, return it
  if (error instanceof VectorDbError) {
    return error;
  }

  // Use the categorizeError function to determine error type
  const errorType = categorizeError(error);
  const errorMessage = error.message || 'Unknown vector database error';
  const errorDetails: Record<string, any> = {};

  // Extract useful information from the error
  if (error.code) errorDetails.code = error.code;
  if (error.errno) errorDetails.errno = error.errno;
  if (error.sqlMessage) errorDetails.sqlMessage = error.sqlMessage;
  if (error.stack) errorDetails.stack = error.stack;

  // Determine if error is retryable
  const isRetryable = (
    errorType === VectorDbErrorType.CONNECTION ||
    errorType === VectorDbErrorType.TIMEOUT ||
    (errorType === VectorDbErrorType.QUERY_FAILED && 
     errorMessage.toLowerCase().includes('timeout'))
  );

  return new VectorDbError(
    errorMessage,
    errorType,
    operation,
    provider,
    errorDetails,
    isRetryable
  );
};

/**
 * Error handler class for vector database operations
 * This provides a more robust approach to error handling with helper methods
 */
export class VectorDbErrorHandler {
  private provider: string;

  constructor(provider: string, _enableLogging: boolean = false, _enableMetrics: boolean = false) {
    this.provider = provider;
    // Logging and metrics flags provided for future enhancements
  }

  /**
   * Check if an error is an authentication error
   */
  public isAuthError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toString() || '';
    const status = error?.status || error?.statusCode || 0;
    
    return (
      code === 'EAUTH' || 
      status === 401 || 
      status === 403 ||
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('auth') ||
      message.includes('permission') ||
      message.includes('credentials')
    );
  }

  /**
   * Check if an error is a network error
   */
  public isNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toString() || '';
    
    return (
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      code === 'ENOTFOUND' ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('connect')
    );
  }

  /**
   * Check if an error is a timeout error
   */
  public isTimeoutError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toString() || '';
    
    return (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKETTIMEDOUT' ||
      message.includes('timeout') ||
      message.includes('timed out')
    );
  }

  /**
   * Determine if an error is retryable
   */
  public isRetryableError(error: any): boolean {
    // If it's already a VectorDbError with retryable flag set
    if (error instanceof VectorDbError && error.retryable) {
      return true;
    }
    
    return (
      this.isNetworkError(error) || 
      this.isTimeoutError(error) ||
      (error instanceof VectorDbError && 
        (error.type === VectorDbErrorType.CONNECTION ||
         error.type === VectorDbErrorType.TIMEOUT))
    );
  }

  /**
   * Handle an error with consistent formatting and logging
   */
  public handleError(
    error: any,
    operation: string,
    errorType?: VectorDbErrorType,
    retryable?: boolean,
    additionalContext: any = {}
  ): VectorDbError {
    const message = error?.message || 'Unknown error';
    
    // Determine error type if not provided
    const resolvedErrorType = errorType || (
      error instanceof VectorDbError ? 
        error.type : 
        categorizeErrorWithProvider(error, this.provider) || categorizeError(error)
    );
    
    // Determine if retryable if not provided
    const isRetryable = retryable !== undefined ? 
      retryable : 
      isRetryableWithProvider(error, this.provider) || this.isRetryableError(error);
    
    const details = {
      retryable: isRetryable,
      ...additionalContext
    };
    
    // If we have existing VectorDbError, update it with our context
    if (error instanceof VectorDbError) {
      error.details = { ...error.details, ...details };
      error.retryable = isRetryable;
      return error;
    }
    
    // Create a new VectorDbError
    return new VectorDbError(
      message,
      resolvedErrorType,
      operation,
      this.provider,
      details,
      isRetryable
    );
  }
}