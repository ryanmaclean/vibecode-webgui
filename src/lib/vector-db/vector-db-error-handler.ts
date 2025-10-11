/**
 * Vector Database Error Handler
 * Standardized error handling for vector database operations
 */

import { logger } from '../logger';

/**
 * Details object for vector database errors
 */
export interface VectorDBErrorDetails {
  code?: string | number;
  errno?: number;
  sqlMessage?: string;
  stack?: string;
  originalError?: unknown;
  [key: string]: unknown;
}

/**
 * Type guard for objects with code property
 */
<<<<<<< HEAD
<<<<<<< HEAD
function hasCode(e: unknown): e is { code: string | number } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

=======
export class VectorDbError extends Error {
  type: VectorDbErrorType;
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
export enum VectorDBErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  VECTOR_CREATION_FAILED = 'VECTOR_CREATION_FAILED',
  VECTOR_UPDATE_FAILED = 'VECTOR_UPDATE_FAILED',
  VECTOR_DELETION_FAILED = 'VECTOR_DELETION_FAILED',
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED',
  SIMILARITY_SEARCH_FAILED = 'SIMILARITY_SEARCH_FAILED',
  INDEX_OPERATION_FAILED = 'INDEX_OPERATION_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  // Additional enum values for enhanced error patterns
  INITIALIZATION = 'INITIALIZATION',
  SERVICE = 'SERVICE',
  TIMEOUT = 'TIMEOUT',
  SEARCH = 'SEARCH'
<<<<<<< HEAD
  // Note: AUTHENTICATION and CONNECTION are aliases for AUTHORIZATION_ERROR and CONNECTION_FAILED respectively
=======
>>>>>>> merge-conflict-cleanup
}

export class VectorDBError extends Error {
  type: VectorDBErrorType;
<<<<<<< HEAD
=======
export class VectorDbError extends Error {
  type: VectorDbErrorType;
>>>>>>> fix/consolidated-dependency-updates
=======
>>>>>>> merge-conflict-cleanup
  operation: string;
  provider: string;
  details: VectorDBErrorDetails | null;
  timestamp: string;
  // Whether the error is considered retryable (optional; set by handlers)
  retryable?: boolean;

  constructor(
    message: string,
<<<<<<< HEAD
<<<<<<< HEAD
    type: VectorDBErrorType = VectorDBErrorType.UNKNOWN_ERROR,
=======
    type: VectorDbErrorType = VectorDbErrorType.UNKNOWN_ERROR,
>>>>>>> fix/consolidated-dependency-updates
=======
    type: VectorDbErrorType = VectorDbErrorType.UNKNOWN_ERROR,
=======
>>>>>>> main
    type: VectorDBErrorType = VectorDBErrorType.UNKNOWN_ERROR,
>>>>>>> merge-conflict-cleanup
    operation: string = 'unknown',
    provider: string = 'unknown',
    details: VectorDBErrorDetails | null = null
  ) {
    super(message);
<<<<<<< HEAD
<<<<<<< HEAD
    this.name = 'VectorDBError';
=======
        this.name = 'VectorDbError';
>>>>>>> fix/consolidated-dependency-updates
=======
    this.name = 'VectorDbError';
=======
>>>>>>> main
    this.name = 'VectorDBError';
>>>>>>> merge-conflict-cleanup
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

  private sanitizeDetails(details: VectorDBErrorDetails | null): VectorDBErrorDetails | null {
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
export const handleVectorDBError = (
  error: unknown,
  operation: string,
  provider: string
): VectorDBError => {
  // If already a VectorDBError, return it
  if (error instanceof VectorDBError) {
=======
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
<<<<<<< HEAD
export function handleVectorDbError(
=======
=======
>>>>>>> main
export const handleVectorDBError = (
>>>>>>> merge-conflict-cleanup
  error: any,
  operation: string,
  provider: string,
  shouldRetry: boolean = false
): VectorDbError {
  // If it's already a VectorDbError, return it
  if (error instanceof VectorDbError) {
<<<<<<< HEAD
>>>>>>> fix/consolidated-dependency-updates
=======
=======
>>>>>>> main
): VectorDBError => {
  // If already a VectorDBError, return it
  if (error instanceof VectorDBError) {
>>>>>>> merge-conflict-cleanup
    return error;
  }

  // Normalize incoming error value
  // - undefined/null -> Unknown error
  // - string -> message = string
  // - object without string message -> Unknown error
  // - Error -> use as-is
  let baseError: Error;
  const originalError: unknown = error;
  if (error instanceof Error) {
    baseError = error;
  } else if (error == null) {
    baseError = new Error('Unknown error');
  } else if (typeof error === 'string') {
    baseError = new Error(error);
<<<<<<< HEAD
  } else if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    baseError = new Error(error.message);
  } else if (typeof error === 'object' && 'message' in error && error.message) {
    // Non-string message (e.g., object)
    const msg = error.message as { text?: string };
    baseError = new Error(String(msg.text || 'Unknown error'));
=======
  } else if (typeof (error as any).message === 'string') {
    baseError = new Error((error as any).message);
  } else if ((error as any).message && typeof (error as any).message !== 'string') {
    // Non-string message (e.g., object)
    baseError = new Error(String((error as any).message?.text || 'Unknown error'));
>>>>>>> merge-conflict-cleanup
  } else {
    baseError = new Error('Unknown error');
  }

  // Map common database errors to appropriate types
<<<<<<< HEAD
  let errorType = VectorDBErrorType.UNKNOWN_ERROR;
  const errorMessage = baseError.message || 'Unknown vector database error';
  const errorDetails: VectorDBErrorDetails = {};

  // Connection errors
  if (
    (hasCode(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) ||
    baseError.name === 'ConnectionError' ||
    errorMessage.includes('connect') ||
    errorMessage.includes('connection')
  ) {
    errorType = VectorDBErrorType.CONNECTION_FAILED;
  }
  // Authentication errors
  else if (
    (hasCode(error) && (error.code === 'EAUTH' || error.code === 401 || error.code === 403)) ||
    errorMessage.includes('auth') ||
    errorMessage.includes('credentials') ||
    errorMessage.includes('permission')
  ) {
    errorType = VectorDBErrorType.AUTHORIZATION_ERROR;
  }
  // Query errors
  else if (
    (hasCode(error) && error.code === 'EQUERY') ||
    errorMessage.includes('query') ||
    errorMessage.includes('SQL')
  ) {
    errorType = VectorDBErrorType.QUERY_FAILED;
  }

  // Extract useful information from the error
  if (hasCode(error)) {
    errorDetails.code = error.code;
  }
  if (typeof error === 'object' && error !== null && 'errno' in error && typeof error.errno === 'number') {
    errorDetails.errno = error.errno;
  }
  if (typeof error === 'object' && error !== null && 'sqlMessage' in error && typeof error.sqlMessage === 'string') {
    errorDetails.sqlMessage = error.sqlMessage;
  }
  if (baseError.stack) {
    errorDetails.stack = baseError.stack;
  }
  // Preserve original error for diagnostics (redacted later by toJSON)
  if (!(error instanceof Error)) {
    errorDetails.originalError = originalError;
  }

  return new VectorDBError(
=======
  const errorType = getErrorType(error);
  const errorMessage = error.message || 'Unknown vector database error';
  const errorDetails: Record<string, any> = {};

  // Extract useful information from the error
  if (error.code) errorDetails.code = error.code;
  if (error.errno) errorDetails.errno = error.errno;
  if (error.sqlMessage) errorDetails.sqlMessage = error.sqlMessage;
  if (error.stack) errorDetails.stack = error.stack;

  return new VectorDbError(
<<<<<<< HEAD
>>>>>>> fix/consolidated-dependency-updates
=======
=======
>>>>>>> main
  let errorType = VectorDBErrorType.UNKNOWN_ERROR;
  const errorMessage = baseError.message || 'Unknown vector database error';
  let errorDetails: Record<string, unknown> = {};

  // Connection errors
  if (
    (error as any)?.code === 'ECONNREFUSED' ||
    (error as any)?.code === 'ETIMEDOUT' ||
    baseError.name === 'ConnectionError' ||
    errorMessage.includes('connect') ||
    errorMessage.includes('connection')
  ) {
    errorType = VectorDBErrorType.CONNECTION_FAILED;
  }
  // Authentication errors
  else if (
    (error as any)?.code === 'EAUTH' ||
    (error as any)?.code === 401 ||
    (error as any)?.code === 403 ||
    errorMessage.includes('auth') ||
    errorMessage.includes('credentials') ||
    errorMessage.includes('permission')
  ) {
    errorType = VectorDBErrorType.AUTHORIZATION_ERROR;
  }
  // Query errors
  else if (
    (error as any)?.code === 'EQUERY' ||
    errorMessage.includes('query') ||
    errorMessage.includes('SQL')
  ) {
    errorType = VectorDBErrorType.QUERY_FAILED;
  }

  // Extract useful information from the error
  if ((error as any)?.code) errorDetails = { ...errorDetails, code: (error as any).code };
  if ((error as any)?.errno) errorDetails = { ...errorDetails, errno: (error as any).errno };
  if ((error as any)?.sqlMessage) errorDetails = { ...errorDetails, sqlMessage: (error as any).sqlMessage };
  if ((baseError as any)?.stack) errorDetails = { ...errorDetails, stack: (baseError as any).stack };
  // Preserve original error for diagnostics (redacted later by toJSON)
  if (!(error instanceof Error)) {
    errorDetails = { ...errorDetails, originalError };
  }

  return new VectorDBError(
>>>>>>> merge-conflict-cleanup
    errorMessage,
    errorType,
    operation,
    provider,
    errorDetails
  );
};
=======
}
>>>>>>> fix/consolidated-dependency-updates

/**
 * Backward/alternate naming compatibility for imports expecting VectorDb* symbols
 */
export { VectorDBErrorType as VectorDbErrorType };
export { VectorDBError as VectorDbError };

/**
 * Enhanced handler class providing provider-aware categorization and retryability helpers.
 * Many adapters import this class from './vector-db-error-handler'.
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
   * Normalize and enrich an error with consistent formatting.
   */
  public handleError(
    error: unknown,
    operation: string,
    errorType?: VectorDBErrorType,
    retryable?: boolean,
<<<<<<< HEAD
    additionalContext: VectorDBErrorDetails = {}
  ): VectorDBError {
    // Check for Azure PostgreSQL specific pgvector errors first
    if (this.isAzurePgVectorError(error)) {
      const message = (error instanceof Error)
        ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string')
          ? error.message
          : 'Azure PostgreSQL pgvector extension error';

      const azureContext = {
        ...additionalContext,
        azure: true,
        pgvectorError: true,
        requiresAdminAction: true,
        ...(typeof retryable === 'boolean' ? { retryable } : {}),
      };

      const azureError = new VectorDBError(
        message,
        VectorDBErrorType.INITIALIZATION,
        operation,
        this.provider,
        azureContext
      );

      if (typeof retryable === 'boolean') {
        azureError.retryable = retryable;
      }

      return azureError;
    }

=======
    additionalContext: Record<string, any> = {}
  ): VectorDBError {
>>>>>>> merge-conflict-cleanup
    // Categorize if no explicit type provided (use local fallback to avoid circular imports)
    const resolvedType = errorType ?? this.categorizeFallback(error);

    // Attach context (including retryable if provided)
    const context = {
      ...additionalContext,
      ...(typeof retryable === 'boolean' ? { retryable } : {}),
    };

    // Delegate to base normalizer for consistency
    const normalized = handleVectorDBError(
      error,
      operation,
      this.provider
<<<<<<< HEAD
=======
    );

    // Override type if we resolved a more specific one
    if (resolvedType && normalized.type !== resolvedType) {
      normalized.type = resolvedType;
    }

    // Merge context into details and set top-level retryable property when provided
    normalized.details = { ...(normalized.details || {}), ...context };
    if (typeof retryable === 'boolean') {
      (normalized as any).retryable = retryable;
    }

    // Optional logging hook
    if (this.enableLogging) {
      logger.error('Vector DB operation error', {
        provider: this.provider,
        operation,
        type: normalized.type,
        message: normalized.message,
        context,
      });
    }

    return normalized;
  }

  /**
   * Determine if an error is retryable using provider-aware patterns.
   */
  public isRetryableError(error: any): boolean {
    const t = this.categorizeFallback(error);
    return (
      t === VectorDBErrorType.CONNECTION_FAILED ||
      t === VectorDBErrorType.TIMEOUT ||
      t === VectorDBErrorType.SERVICE ||
      t === VectorDBErrorType.UNKNOWN_ERROR
>>>>>>> merge-conflict-cleanup
    );

    // Override type if we resolved a more specific one
    if (resolvedType && normalized.type !== resolvedType) {
      normalized.type = resolvedType;
    }

    // Merge context into details and set top-level retryable property when provided
    normalized.details = { ...(normalized.details || {}), ...context };
    if (typeof retryable === 'boolean') {
      normalized.retryable = retryable;
    }

    // Optional logging hook
    if (this.enableLogging) {
      logger.error('Vector DB operation error', {
        provider: this.provider,
        operation,
        type: normalized.type,
        message: normalized.message,
        context,
      });
    }

    return normalized;
  }

  /**
   * Determine if an error is retryable using provider-aware patterns.
   */
  public isRetryableError(error: unknown): boolean {
    const t = this.categorizeFallback(error);
    return (
      t === VectorDBErrorType.CONNECTION_FAILED ||
      t === VectorDBErrorType.TIMEOUT ||
      t === VectorDBErrorType.SERVICE ||
      t === VectorDBErrorType.UNKNOWN_ERROR
    );
  }
<<<<<<< HEAD

  /**
   * Check if error is authentication related
   */
  public isAuthError(error: unknown): boolean {
    const msg = String((typeof error === 'object' && error !== null && 'message' in error) ? error.message : '').toLowerCase();
    const code = String(hasCode(error) ? error.code : '');
    const status = (typeof error === 'object' && error !== null && ('status' in error || 'statusCode' in error))
      ? ((error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode ?? 0)
      : 0;

    return (
      code === 'EAUTH' || status === 401 || status === 403 ||
      msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden') ||
      msg.includes('credentials') || msg.includes('permission')
    );
  }

  /**
   * Check if error is network/connection related
   */
  public isNetworkError(error: unknown): boolean {
    const msg = String((typeof error === 'object' && error !== null && 'message' in error) ? error.message : '').toLowerCase();
    const code = String(hasCode(error) ? error.code : '');

    return (
      code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENETWORK' ||
      msg.includes('connection') || msg.includes('connect') || msg.includes('network')
    );
  }

  /**
   * Check if error is timeout related
   */
  public isTimeoutError(error: unknown): boolean {
    const msg = String((typeof error === 'object' && error !== null && 'message' in error) ? error.message : '').toLowerCase();
    const code = String(hasCode(error) ? error.code : '');
    const status = (typeof error === 'object' && error !== null && ('status' in error || 'statusCode' in error))
      ? ((error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode ?? 0)
      : 0;

    return (
      code === 'ETIMEDOUT' || status === 408 || status === 504 ||
      msg.includes('timeout') || msg.includes('timed out')
    );
  }

  /**
   * Check if an error is related to Azure PostgreSQL pgvector limitations
   */
  private isAzurePgVectorError(error: unknown): boolean {
    if (!error) return false;
    const message = String((typeof error === 'object' && error !== null && 'message' in error) ? error.message : '').toLowerCase();

    // Check for Azure PostgreSQL specific pgvector errors
    return (
      message.includes('vector') &&
      (
        message.includes('shared_preload_libraries') ||
        message.includes('extension "vector" is not available') ||
        message.includes('extension vector does not exist') ||
        message.includes('could not open extension control file "vector.control"') ||
        message.includes('serverparametertocmsunallowedparametervalue') ||
        message.includes('value \'vector\' is invalid for server parameter') ||
        message.includes('operator does not exist: vector') ||
        message.includes('type "vector" does not exist')
      )
    );
  }

  /**
   * Fallback categorization to avoid importing database-error-patterns (prevents circular deps).
   */
  private categorizeFallback(error: unknown): VectorDBErrorType {
    if (!error) return VectorDBErrorType.UNKNOWN_ERROR;
    const msg = String((typeof error === 'object' && error !== null && 'message' in error) ? error.message : '').toLowerCase();
    const code = String(hasCode(error) ? error.code : '');
    const status = (typeof error === 'object' && error !== null && ('status' in error || 'statusCode' in error))
      ? ((error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode ?? 0)
      : 0;

    // Connection
    if (
      code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' ||
      msg.includes('connection') || msg.includes('connect') || msg.includes('network')
    ) return VectorDBErrorType.CONNECTION_FAILED;

    // Auth
    if (
      code === 'EAUTH' || status === 401 || status === 403 ||
      msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('credentials') || msg.includes('permission')
    ) return VectorDBErrorType.AUTHORIZATION_ERROR;

    // Timeout
    if (
      code === 'ETIMEDOUT' || status === 408 || status === 504 ||
      msg.includes('timeout') || msg.includes('timed out')
    ) return VectorDBErrorType.TIMEOUT;

    // Rate limiting / service
    if (
      status === 429 || status === 503 ||
      msg.includes('rate limit') || msg.includes('throttl') || msg.includes('service unavailable')
    ) return VectorDBErrorType.SERVICE;

    // Query / syntax
    if (
      msg.includes('query') || msg.includes('syntax') || msg.includes('sql') || msg.includes('malformed')
    ) return VectorDBErrorType.QUERY_FAILED;

    // Vector specific
    if (msg.includes('vector')) return VectorDBErrorType.VECTOR_CREATION_FAILED;

    // Initialization / configuration
    if (msg.includes('not initialized') || msg.includes('initialize') || msg.includes('configuration'))
      return VectorDBErrorType.INITIALIZATION;

    return VectorDBErrorType.UNKNOWN_ERROR;
  }

  /**
   * Fallback categorization to avoid importing database-error-patterns (prevents circular deps).
   */
  private categorizeFallback(error: any): VectorDBErrorType {
    if (!error) return VectorDBErrorType.UNKNOWN_ERROR;
    const msg = String(error.message || '').toLowerCase();
    const code = String((error as any).code ?? '');
    const status = (error as any).status ?? (error as any).statusCode ?? 0;

    // Connection
    if (
      code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' ||
      msg.includes('connection') || msg.includes('connect') || msg.includes('network')
    ) return VectorDBErrorType.CONNECTION_FAILED;

    // Auth
    if (
      code === 'EAUTH' || status === 401 || status === 403 ||
      msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('credentials') || msg.includes('permission')
    ) return VectorDBErrorType.AUTHORIZATION_ERROR;

    // Timeout
    if (
      code === 'ETIMEDOUT' || status === 408 || status === 504 ||
      msg.includes('timeout') || msg.includes('timed out')
    ) return VectorDBErrorType.TIMEOUT;

    // Rate limiting / service
    if (
      status === 429 || status === 503 ||
      msg.includes('rate limit') || msg.includes('throttl') || msg.includes('service unavailable')
    ) return VectorDBErrorType.SERVICE;

    // Query / syntax
    if (
      msg.includes('query') || msg.includes('syntax') || msg.includes('sql') || msg.includes('malformed')
    ) return VectorDBErrorType.QUERY_FAILED;

    // Vector specific
    if (msg.includes('vector')) return VectorDBErrorType.VECTOR_CREATION_FAILED;

    // Initialization / configuration
    if (msg.includes('not initialized') || msg.includes('initialize') || msg.includes('configuration'))
      return VectorDBErrorType.INITIALIZATION;

    return VectorDBErrorType.UNKNOWN_ERROR;
  }
}
<<<<<<< HEAD
=======
}
>>>>>>> fix/consolidated-dependency-updates
=======
<<<<<<< HEAD
};
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
