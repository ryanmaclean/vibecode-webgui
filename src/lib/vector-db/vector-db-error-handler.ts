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
function hasCode(e: unknown): e is { code: string | number } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

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
  // Note: AUTHENTICATION and CONNECTION are aliases for AUTHORIZATION_ERROR and CONNECTION_FAILED respectively
}

export class VectorDBError extends Error {
  type: VectorDBErrorType;
  operation: string;
  provider: string;
  details: VectorDBErrorDetails | null;
  timestamp: string;
  // Whether the error is considered retryable (optional; set by handlers)
  retryable?: boolean;

  constructor(
    message: string,
    type: VectorDBErrorType = VectorDBErrorType.UNKNOWN_ERROR,
    operation: string = 'unknown',
    provider: string = 'unknown',
    details: VectorDBErrorDetails | null = null
  ) {
    super(message);
    this.name = 'VectorDBError';
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

export const handleVectorDBError = (
  error: unknown,
  operation: string,
  provider: string
): VectorDBError => {
  // If already a VectorDBError, return it
  if (error instanceof VectorDBError) {
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
  } else if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    baseError = new Error(error.message);
  } else if (typeof error === 'object' && 'message' in error && error.message) {
    // Non-string message (e.g., object)
    const msg = error.message as { text?: string };
    baseError = new Error(String(msg.text || 'Unknown error'));
  } else {
    baseError = new Error('Unknown error');
  }

  // Map common database errors to appropriate types
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
    errorMessage,
    errorType,
    operation,
    provider,
    errorDetails
  );
};

/**
 * Backward/alternate naming compatibility for imports expecting VectorDb* symbols
 */
export { VectorDBErrorType as VectorDbErrorType };
export { VectorDBError as VectorDbError };

/**
 * For compatibility with code that imports categorizeError from the -new handler,
 * users should import categorizeErrorWithProvider directly from './database-error-patterns'
 * Note: Not re-exported here to avoid circular dependency
 */

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
    additionalContext: VectorDBErrorDetails = {}
  ): VectorDBError {
    // If already a VectorDBError, enrich with additional context
    if (error instanceof VectorDBError) {
      const mergedDetails = {
        ...(error.details || {}),
        ...additionalContext,
        ...(typeof retryable === 'boolean' ? { retryable } : {}),
      };
      const enriched = new VectorDBError(
        error.message,
        errorType || error.type,
        operation,
        this.provider,
        mergedDetails
      );
      if (typeof retryable === 'boolean') {
        enriched.retryable = retryable;
      } else if (typeof error.retryable === 'boolean') {
        enriched.retryable = error.retryable;
      }
      return enriched;
    }

    // Check for Azure PostgreSQL specific pgvector errors
    if (this.isAzurePgVectorError(error)) {
      const message = (error instanceof Error)
        ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string')
          ? error.message
          : 'Azure PostgreSQL pgvector extension error';
      const ctx = {
        ...additionalContext,
        azure: true,
        pgvectorError: true,
        requiresAdminAction: true,
        ...(typeof retryable === 'boolean' ? { retryable } : {}),
      };
      const enriched = new VectorDBError(
        message,
        VectorDBErrorType.INITIALIZATION,
        operation,
        this.provider,
        ctx
      );
      if (typeof retryable === 'boolean') {
        enriched.retryable = retryable;
      }
      return enriched;
    }

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
}
