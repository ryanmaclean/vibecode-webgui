/**
 * Vector Database Error Handler
 * Standardized error handling for vector database operations
 */

import { logger } from '../logger';

/**
 * Standardized error types for vector database operations
 */
export enum VectorDbErrorType {
  // Connection related errors
  CONNECTION = 'CONNECTION',                             // Generic connection error
  CONNECTION_FAILED = 'CONNECTION_FAILED',               // Legacy: use CONNECTION instead
  
  // Initialization errors
  INITIALIZATION = 'INITIALIZATION',                     // Error during adapter initialization
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',           // Error in configuration
  
  // Authentication and authorization
  AUTHENTICATION = 'AUTHENTICATION',                     // Authentication failure
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',           // Authorization/permission failure
  
  // Query errors
  QUERY_FAILED = 'QUERY_FAILED',                         // Generic query failure
  SEARCH = 'SEARCH',                                     // Error during search operation
  SIMILARITY_SEARCH_FAILED = 'SIMILARITY_SEARCH_FAILED', // Legacy: use SEARCH instead
  
  // Timeouts
  TIMEOUT = 'TIMEOUT',                                   // Generic timeout
  
  // Service errors
  SERVICE = 'SERVICE',                                   // Service unavailable or error
  
  // Vector operations
  VECTOR_CREATION_FAILED = 'VECTOR_CREATION_FAILED',     // Error creating vector
  VECTOR_UPDATE_FAILED = 'VECTOR_UPDATE_FAILED',         // Error updating vector
  VECTOR_DELETION_FAILED = 'VECTOR_DELETION_FAILED',     // Error deleting vector
  
  // Embedding generation
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED', // Error generating embeddings
  
  // Index operations
  INDEX_OPERATION_FAILED = 'INDEX_OPERATION_FAILED',     // Error with index operations
  
  // Feature support
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',       // Operation not supported by provider
  
  // Fallback
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'                        // Unclassified error
}

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

  constructor(
    message: string,
    type: VectorDbErrorType = VectorDbErrorType.UNKNOWN_ERROR,
    operation: string = 'unknown',
    provider: string = 'unknown',
    details: any = null
  ) {
    super(message);
        this.name = 'VectorDbError';
    this.type = type;
    this.operation = operation;
    this.provider = provider;
    this.details = details;
    this.timestamp = new Date().toISOString();

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

<<<<<<< HEAD
// Legacy alias for backward compatibility
export const VectorDBError = VectorDbError;

/**
 * Helper function to determine the error type based on error properties
 * @param error Any error object to analyze
 * @returns The appropriate VectorDbErrorType
 */
export function getErrorType(error: any): VectorDbErrorType {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code?.toString() || '';
  const status = error?.status || error?.statusCode || 0;
  
  // Connection errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    error.name === 'ConnectionError' ||
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
  
  // Timeout errors
  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return VectorDbErrorType.TIMEOUT;
  }
  
  // Query errors
  if (
    code === 'EQUERY' ||
    message.includes('query') ||
    message.includes('sql')
  ) {
    return VectorDbErrorType.QUERY_FAILED;
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
  if (message.includes('embedding')) {
    return VectorDbErrorType.EMBEDDING_GENERATION_FAILED;
  }
  
  if (message.includes('search')) {
    return VectorDbErrorType.SEARCH;
  }
  
  if (message.includes('index')) {
    return VectorDbErrorType.INDEX_OPERATION_FAILED;
  }
  
  if (message.includes('not implemented') || message.includes('unsupported')) {
    return VectorDbErrorType.UNSUPPORTED_OPERATION;
  }
  
  // Default case
  return VectorDbErrorType.UNKNOWN_ERROR;
}

/**
 * Legacy function-based error handler
 * @deprecated Use VectorDbErrorHandler class instead
 */
=======
>>>>>>> origin/feature/general-improvements-fixed
export const handleVectorDBError = (
  error: any,
  operation: string,
  provider: string
<<<<<<< HEAD
): VectorDbError => {
  // If already a VectorDbError, return it
  if (error instanceof VectorDbError) {
=======
): VectorDBError => {
  // If already a VectorDBError, return it
  if (error instanceof VectorDBError) {
>>>>>>> origin/feature/general-improvements-fixed
    return error;
  }

  // Map common database errors to appropriate types
<<<<<<< HEAD
  const errorType = getErrorType(error);
  const errorMessage = error.message || 'Unknown vector database error';
  const errorDetails: Record<string, any> = {};

  // Extract useful information from the error
  if (error.code) errorDetails.code = error.code;
  if (error.errno) errorDetails.errno = error.errno;
  if (error.sqlMessage) errorDetails.sqlMessage = error.sqlMessage;
  if (error.stack) errorDetails.stack = error.stack;

  return new VectorDbError(
=======
  let errorType = VectorDBErrorType.UNKNOWN_ERROR;
  let errorMessage = error.message || 'Unknown vector database error';
  let errorDetails = {};

  // Connection errors
  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.name === 'ConnectionError' ||
    errorMessage.includes('connect') ||
    errorMessage.includes('connection')
  ) {
    errorType = VectorDBErrorType.CONNECTION_FAILED;
  }
  // Authentication errors
  else if (
    error.code === 'EAUTH' ||
    error.code === 401 ||
    error.code === 403 ||
    errorMessage.includes('auth') ||
    errorMessage.includes('credentials') ||
    errorMessage.includes('permission')
  ) {
    errorType = VectorDBErrorType.AUTHORIZATION_ERROR;
  }
  // Query errors
  else if (
    error.code === 'EQUERY' ||
    errorMessage.includes('query') ||
    errorMessage.includes('SQL')
  ) {
    errorType = VectorDBErrorType.QUERY_FAILED;
  }

  // Extract useful information from the error
  if (error.code) errorDetails = { ...errorDetails, code: error.code };
  if (error.errno) errorDetails = { ...errorDetails, errno: error.errno };
  if (error.sqlMessage) errorDetails = { ...errorDetails, sqlMessage: error.sqlMessage };
  if (error.stack) errorDetails = { ...errorDetails, stack: error.stack };

  return new VectorDBError(
>>>>>>> origin/feature/general-improvements-fixed
    errorMessage,
    errorType,
    operation,
    provider,
    errorDetails
  );
<<<<<<< HEAD
};

/**
 * Error handler class for vector database operations
 * This provides a consistent approach to error handling across adapters
 */
export class VectorDbErrorHandler {
  private provider: string;
  private enableLogging: boolean;
  private enableMetrics: boolean;

  constructor(provider: string, enableLogging: boolean = false, enableMetrics: boolean = false) {
    this.provider = provider;
    this.enableLogging = enableLogging;
    this.enableMetrics = enableMetrics;
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
    const resolvedErrorType = errorType || getErrorType(error);
    
    // Determine if retryable if not provided
    const isRetryable = retryable !== undefined ? retryable : this.isRetryableError(error);
    
    const details = {
      retryable: isRetryable,
      ...additionalContext
    };
    
    // If we have existing VectorDbError, update it with our context
    if (error instanceof VectorDbError) {
      error.details = { ...error.details, ...details };
      return error;
    }
    
    // Create a new VectorDbError
    return new VectorDbError(
      message,
      resolvedErrorType,
      operation,
      this.provider,
      details
    );
  }
}
=======
};
>>>>>>> origin/feature/general-improvements-fixed
