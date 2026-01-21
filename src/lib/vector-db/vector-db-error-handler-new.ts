/**
 * Vector Database Error Handler
 * Standardized error handling for vector database operations
 *
 * @module vector-db-error-handler
 * @description This module provides a standardized approach to error handling for vector database operations.
 * It includes a class-based error handler, error categorization, and utilities for error management.
 */

/**
 * Vector database error types
 * Defines the categories of errors that can occur in vector database operations
 */
export enum VectorDbErrorType {
  // Connection related errors
  CONNECTION = 'CONNECTION',
  CONNECTION_FAILED = 'CONNECTION_FAILED',

  // Initialization errors
  INITIALIZATION = 'INITIALIZATION',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // Authentication and authorization
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',

  // Query errors
  QUERY_FAILED = 'QUERY_FAILED',
  SEARCH = 'SEARCH',

  // Timeouts
  TIMEOUT = 'TIMEOUT',

  // Service errors
  SERVICE = 'SERVICE',

  // Vector operations
  VECTOR_OPERATION_FAILED = 'VECTOR_OPERATION_FAILED',

  // Embedding generation
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED',

  // Index operations
  INDEX_OPERATION_FAILED = 'INDEX_OPERATION_FAILED',

  // Feature support
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',

  // Fallback
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Legacy compatibility exports
export const VectorDBErrorType = {
  CONNECTION_FAILED: VectorDbErrorType.CONNECTION,
  SIMILARITY_SEARCH_FAILED: VectorDbErrorType.SEARCH,
  VECTOR_CREATION_FAILED: VectorDbErrorType.VECTOR_OPERATION_FAILED,
  VECTOR_UPDATE_FAILED: VectorDbErrorType.VECTOR_OPERATION_FAILED,
  VECTOR_DELETION_FAILED: VectorDbErrorType.VECTOR_OPERATION_FAILED,
  // Include all new enum values
  ...VectorDbErrorType
};

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
    details: any = {},
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
      details: this.sanitizeDetails(this.details)
    };
  }

  private sanitizeDetails(details: any) {
    if (!details) return {};

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
 */
export function categorizeError(error: any, provider?: string): VectorDbErrorType {
  // Safely get message, handling non-string cases
  let message = '';
  if (error?.message) {
    if (typeof error.message === 'string') {
      message = error.message.toLowerCase();
    } else {
      // Handle non-string message objects
      message = String(error.message).toLowerCase();
    }
  }

  const code = (error?.code || '').toString();
  const status = error?.status || error?.statusCode || 0;

  // Auto-detect provider if not specified or if generic provider based on error characteristics
  let detectedProvider = provider;
  if (!detectedProvider || !['postgres', 'redis', 'cosmosdb', 'sqlserver'].includes(detectedProvider)) {
    // PostgreSQL detection
    if (error?.severity && error?.file && error?.line && error?.routine) {
      detectedProvider = 'postgres';
    }
    // Redis detection
    else if (error?.name === 'ReplyError' || error?.command) {
      detectedProvider = 'redis';
    }
    // CosmosDB detection
    else if (error?.body?.code) {
      detectedProvider = 'cosmosdb';
    }
    // SQL Server detection
    else if (error?.number && error?.lineNumber && error?.state) {
      detectedProvider = 'sqlserver';
    }
  }


  // Database-specific error patterns
  if (detectedProvider === 'postgres') {
    // PostgreSQL specific error codes
    if (code === '08006' || code === '08001' || code === '08003') {
      return VectorDbErrorType.CONNECTION;
    }
    if (code === '42601' || code === '42000' || code === '42P01') {
      return VectorDbErrorType.QUERY_FAILED;
    }
    if (code === '42501' || code === '28000') {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
  }

  if (detectedProvider === 'redis') {
    // Redis specific patterns
    if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || message.includes('connection timeout')) {
      return VectorDbErrorType.CONNECTION;
    }
    if (message.includes('err unknown command') || message.includes('wrongtype') || code === 'WRONGTYPE' || message.includes('WRONGTYPE'.toLowerCase())) {
      return VectorDbErrorType.QUERY_FAILED;
    }
    if (code === 'NOAUTH' || message.includes('authentication required')) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
  }

  if (detectedProvider === 'cosmosdb') {
    // CosmosDB specific patterns
    if (status === 401 || error?.body?.code === 'Unauthorized') {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
    if (status === 408 || error?.body?.code === 'RequestTimeout') {
      return VectorDbErrorType.TIMEOUT;
    }
    if (status === 404 || error?.body?.code === 'NotFound') {
      return VectorDbErrorType.SERVICE;
    }
  }

  if (detectedProvider === 'sqlserver') {
    // SQL Server specific error numbers
    if (error?.number === 53 || error?.number === 2) {
      return VectorDbErrorType.CONNECTION;
    }
    if (error?.number === 208 || error?.number === 156) {
      return VectorDbErrorType.QUERY_FAILED;
    }
    if (error?.number === 229 || error?.number === 230) {
      return VectorDbErrorType.AUTHORIZATION_ERROR;
    }
  }

  // Generic connection errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    message.includes('connect') ||
    message.includes('connection')
  ) {
    return VectorDbErrorType.CONNECTION;
  }

  // Authentication/Authorization errors
  if (
    status === 401 ||
    status === 403 ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('credentials') ||
    message.includes('invalid credentials')
  ) {
    return VectorDbErrorType.AUTHORIZATION_ERROR;
  }

  // Timeout errors
  if (
    code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return VectorDbErrorType.TIMEOUT;
  }

  // Query errors
  if (
    code === 'EQUERY' ||
    message.includes('query') ||
    message.includes('sql') ||
    message.includes('error in sql') ||
    message.includes('relation') && message.includes('does not exist')
  ) {
    return VectorDbErrorType.QUERY_FAILED;
  }

  // Service errors
  if (
    status >= 500 ||
    message.includes('service') ||
    message.includes('unavailable')
  ) {
    return VectorDbErrorType.SERVICE;
  }

  // Default to unknown error
  return VectorDbErrorType.UNKNOWN_ERROR;
}

/**
 * Legacy function-based error handler (for backward compatibility)
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

  const errorType = categorizeError(error);
  const errorMessage = error.message || 'Unknown vector database error';
  const errorDetails: Record<string, any> = {};

  // Extract useful information from the error
  if (error.code) errorDetails.code = error.code;
  if (error.errno) errorDetails.errno = error.errno;
  if (error.stack) errorDetails.stack = error.stack;

  // Determine if error is retryable
  const isRetryable = (
    errorType === VectorDbErrorType.CONNECTION ||
    errorType === VectorDbErrorType.TIMEOUT
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
 */
export class VectorDbErrorHandler {
  private provider: string;
  private enableLogging: boolean;
  private enableMetrics: boolean;

  constructor(provider: string = 'unknown', enableLogging: boolean = false, enableMetrics: boolean = false) {
    this.provider = provider;
    this.enableLogging = enableLogging;
    this.enableMetrics = enableMetrics;
  }

  /**
   * Check if an error is an authentication error
   */
  public isAuthError(error: any): boolean {
    // Safely handle non-string messages
    let message = '';
    if (error?.message && typeof error.message === 'string') {
      message = error.message.toLowerCase();
    } else if (error?.message) {
      message = String(error.message).toLowerCase();
    }

    const status = error?.status || error?.statusCode || 0;

    return (
      status === 401 ||
      status === 403 ||
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('invalid credentials')
    );
  }

  /**
   * Check if an error is a network error
   */
  public isNetworkError(error: any): boolean {
    // Safely handle non-string messages
    let message = '';
    if (error?.message && typeof error.message === 'string') {
      message = error.message.toLowerCase();
    } else if (error?.message) {
      message = String(error.message).toLowerCase();
    }

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
    // Safely handle non-string messages
    let message = '';
    if (error?.message && typeof error.message === 'string') {
      message = error.message.toLowerCase();
    } else if (error?.message) {
      message = String(error.message).toLowerCase();
    }

    const code = error?.code?.toString() || '';

    return (
      code === 'ETIMEDOUT' ||
      message.includes('timeout') ||
      message.includes('timed out')
    );
  }

  /**
   * Determine if an error is retryable
   */
  public isRetryableError(error: any): boolean {
    // If it's already a VectorDbError with retryable flag set
    if (error instanceof VectorDbError && error.retryable !== undefined) {
      return error.retryable;
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
    // Handle edge cases for error parameter
    let message: string;
    let originalError: any;

    if (error === null || error === undefined) {
      message = 'Unknown error';
      originalError = { type: 'null/undefined' };
    } else if (typeof error === 'string') {
      message = error;
      originalError = error; // Store string directly
    } else if (typeof error === 'number') {
      message = 'Unknown error';
      originalError = error; // Store number directly
    } else if (typeof error === 'object' && error.message !== undefined) {
      // Handle error-like objects with non-string messages
      if (typeof error.message === 'string') {
        message = error.message;
        originalError = error;
      } else {
        message = 'Unknown error';
        originalError = { ...error, originalMessage: error.message };
      }
    } else {
      message = error?.message || 'Unknown error';
      originalError = error;
    }

    // Determine error type if not provided
    const resolvedErrorType = errorType || (
      error instanceof VectorDbError ?
        error.type :
        categorizeError(error, this.provider)
    );

    // Determine if retryable if not provided
    const isRetryable = retryable !== undefined ?
      retryable :
      this.isRetryableError(error);

    const details = {
      retryable: isRetryable,
      originalError,
      ...additionalContext
    };

    // If we have existing VectorDbError, update it with our context
    if (error instanceof VectorDbError) {
      // Merge details, preserving existing context
      error.details = { ...error.details, ...details };
      error.retryable = isRetryable;
      // Update operation to the latest one (for operation chaining)
      error.operation = operation;

      // Log error if enabled
      if (this.enableLogging) {
        this.logError(error);
      }

      return error;
    }

    // Create a new VectorDbError
    const vectorDbError = new VectorDbError(
      message,
      resolvedErrorType,
      operation,
      this.provider,
      details,
      isRetryable
    );

    // Log error if enabled
    if (this.enableLogging) {
      this.logError(vectorDbError);
    }

    return vectorDbError;
  }

  /**
   * Log error with appropriate context
   */
  private logError(error: VectorDbError): void {
    const logContext = {
      message: error.message,
      errorType: error.type,
      operation: error.operation,
      provider: error.provider,
      details: error.details
    };

    console.error('VectorDbError:', logContext);
  }
}
