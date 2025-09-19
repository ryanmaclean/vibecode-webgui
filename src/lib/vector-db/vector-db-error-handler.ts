/**
 * Vector Database Error Handler
 * Standardized error handling for vector database operations
 */

import { logger } from '../logger';

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
  details: any;
  timestamp: string;
  // Whether the error is considered retryable (optional; set by handlers)
  retryable?: boolean;

  constructor(
    message: string,
    type: VectorDBErrorType = VectorDBErrorType.UNKNOWN_ERROR,
    operation: string = 'unknown',
    provider: string = 'unknown',
    details: any = null
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

export const handleVectorDBError = (
  error: any,
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
  } else if (typeof (error as any).message === 'string') {
    baseError = new Error((error as any).message);
  } else if ((error as any).message && typeof (error as any).message !== 'string') {
    // Non-string message (e.g., object)
    baseError = new Error(String((error as any).message?.text || 'Unknown error'));
  } else {
    baseError = new Error('Unknown error');
  }

  // Map common database errors to appropriate types
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
    error: any,
    operation: string,
    errorType?: VectorDBErrorType,
    retryable?: boolean,
    additionalContext: Record<string, any> = {}
  ): VectorDBError {
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
    );
  }

  /**
   * Check if error is authentication related
   */
  public isAuthError(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    const code = String((error as any)?.code ?? '');
    const status = (error as any)?.status ?? (error as any)?.statusCode ?? 0;

    return (
      code === 'EAUTH' || status === 401 || status === 403 ||
      msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden') ||
      msg.includes('credentials') || msg.includes('permission')
    );
  }

  /**
   * Check if error is network/connection related
   */
  public isNetworkError(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    const code = String((error as any)?.code ?? '');

    return (
      code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENETWORK' ||
      msg.includes('connection') || msg.includes('connect') || msg.includes('network')
    );
  }

  /**
   * Check if error is timeout related
   */
  public isTimeoutError(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    const code = String((error as any)?.code ?? '');
    const status = (error as any)?.status ?? (error as any)?.statusCode ?? 0;

    return (
      code === 'ETIMEDOUT' || status === 408 || status === 504 ||
      msg.includes('timeout') || msg.includes('timed out')
    );
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
