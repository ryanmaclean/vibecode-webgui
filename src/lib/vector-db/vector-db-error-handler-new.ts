/**
 * Enhanced Vector Database Error Handler
 *
 * @deprecated This file is deprecated and will be removed in a future version.
 * All functionality has been consolidated into './vector-db-error-handler'.
 * Please import from './vector-db-error-handler' instead.
 *
 * Migration: Replace all imports from './vector-db-error-handler-new'
 * with './vector-db-error-handler'
 */

import {
  VectorDBErrorType,
  VectorDBError
} from './vector-db-error-handler';
import { categorizeErrorWithProvider } from './database-error-patterns';

// Helper type for error-like objects
interface ErrorLike {
  message?: unknown
  code?: unknown
  stack?: unknown
  status?: unknown
  statusCode?: unknown
  retryable?: unknown
}

/**
 * Enhanced error handler class for vector database operations
 * This provides provider-specific categorization for vector database errors
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
   * Handle an error with consistent formatting and logging and enhanced categorization
   */
  public handleError(
    error: unknown,
    operation: string,
    errorType?: VectorDBErrorType,
    retryable?: boolean,
    additionalContext: Record<string, unknown> = {}
  ): VectorDBError {
    // Preserve type and details if already a VectorDBError
    if (error instanceof VectorDBError) {
      const mergedDetails = {
        ...(error.details || {}),
        ...additionalContext,
        ...(typeof retryable === 'boolean' ? { retryable } : {}),
      } as Record<string, unknown>;
      const enriched = new VectorDBError(
        error.message,
        errorType || error.type,
        operation,
        this.provider,
        mergedDetails
      );
      const errorLike = error as ErrorLike;
      if (typeof retryable === 'boolean') {
        (enriched as ErrorLike).retryable = retryable;
      } else if (typeof errorLike.retryable === 'boolean') {
        (enriched as ErrorLike).retryable = errorLike.retryable;
      }
      return enriched;
    }
    // Check for Azure PostgreSQL specific pgvector errors (guard against non-objects)
    if (this.isAzurePgVectorError(error)) {
      const errorLike = error as ErrorLike;
      const message = (typeof errorLike?.message === 'string')
        ? errorLike.message
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
        (enriched as ErrorLike).retryable = retryable;
      }
      return enriched;
    }

    // Determine error type: prefer explicit, then provider-specific, then generic fallback
    const providerType = this.getProviderSpecificErrorType(error);
    const genericFallbackType = this.getGenericFallbackType(error);
    let resolvedErrorType = errorType || providerType || genericFallbackType || VectorDBErrorType.UNKNOWN_ERROR;

    // Build a normalized message
    let message: string;
    if (error instanceof Error) {
      message = error.message || 'Unknown error';
    } else if (typeof error === 'string') {
      message = error;
    } else {
      const errorLike = error as ErrorLike;
      if (error && typeof errorLike.message === 'string') {
        message = errorLike.message as string;
      } else if (errorLike?.message && typeof errorLike.message !== 'string') {
        const messageObj = errorLike.message as { text?: unknown };
        message = String(messageObj?.text || 'Unknown error');
      } else {
        message = 'Unknown error';
      }
    }

    // Prepare details including stack and original error if non-Error
    const details: Record<string, unknown> = {};
    const stack = (error instanceof Error ? error.stack : (error as ErrorLike)?.stack);
    if (typeof stack === 'string') details.stack = stack;
    if (!(error instanceof Error)) details.originalError = error as unknown;

    // Merge additional context and retryable flag
    const effectiveRetryable =
      typeof retryable === 'boolean'
        ? retryable
        : (
            resolvedErrorType === VectorDBErrorType.CONNECTION_FAILED ||
            resolvedErrorType === VectorDBErrorType.TIMEOUT ||
            resolvedErrorType === VectorDBErrorType.SERVICE
          );

    const mergedDetails = {
      ...details,
      ...additionalContext,
      retryable: effectiveRetryable,
    };

    // Final minimal safeguard for common SQL/Redis command patterns (keeps implementation simple)
    if (
      resolvedErrorType === VectorDBErrorType.UNKNOWN_ERROR
    ) {
      const errorLike = error as ErrorLike;
      const m = String(errorLike?.message ?? '').toLowerCase();
      const c = String(errorLike?.code ?? '').toLowerCase();
      if (
        m.includes('does not exist') || c.startsWith('42') ||
        m.includes('wrongtype') || m.includes('unknown command') || m.includes('operation against a key') || c === 'wrongtype'
      ) {
        resolvedErrorType = VectorDBErrorType.QUERY_FAILED;
      }
    }

    // Construct the VectorDBError so that its constructor logs with our merged details
    const enriched = new VectorDBError(
      message,
      resolvedErrorType,
      operation,
      this.provider,
      mergedDetails
    );
    (enriched as ErrorLike).retryable = effectiveRetryable;
    return enriched;
  }

  /**
   * Use provider-specific error categorization 
   */
  private getProviderSpecificErrorType(error: unknown): VectorDBErrorType {
    return categorizeErrorWithProvider(error, this.provider);
  }

  /**
   * Check if an error is retryable based on error type and provider
   */
  public isRetryableError(error: unknown): boolean {
    // Respect explicit retryable flag on VectorDBError
    if (error instanceof VectorDBError) {
      const errorLike = error as ErrorLike;
      if (typeof errorLike.retryable === 'boolean') {
        return errorLike.retryable as boolean;
      }
    }

    // Prefer using VectorDBError.type when available
    let errorType = (error instanceof VectorDBError) ? error.type : this.getProviderSpecificErrorType(error);
    if (!errorType || errorType === VectorDBErrorType.UNKNOWN_ERROR) {
      // Fall back to generic categorization so that auth/query errors are not marked retryable
      errorType = this.getGenericFallbackType(error);
    }

    // Generally retryable error types
    return (
      errorType === VectorDBErrorType.CONNECTION_FAILED ||
      errorType === VectorDBErrorType.TIMEOUT ||
      errorType === VectorDBErrorType.SERVICE
    );
  }
  
  /**
   * Check if an error is related to Azure PostgreSQL pgvector limitations
   */
  private isAzurePgVectorError(error: unknown): boolean {
    if (!error) return false;
    const errorLike = error as ErrorLike;
    const message = String(errorLike?.message ?? '').toLowerCase();

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
   * Generic fallback categorization when provider-specific patterns are unavailable.
   */
  private getGenericFallbackType(error: unknown): VectorDBErrorType {
    if (!error) return VectorDBErrorType.UNKNOWN_ERROR;
    const errorLike = error as ErrorLike;
    const msg = String(errorLike?.message ?? '').toLowerCase();
    const code = String(errorLike?.code ?? '');
    const status = errorLike?.status ?? errorLike?.statusCode ?? 0;

    if (
      code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' ||
      msg.includes('connection') || msg.includes('connect') || msg.includes('network')
    ) return VectorDBErrorType.CONNECTION_FAILED;

    if (
      code === 'EAUTH' || status === 401 || status === 403 ||
      msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('credentials') || msg.includes('permission')
    ) return VectorDBErrorType.AUTHORIZATION_ERROR;

    if (
      status === 408 || status === 504 || code === 'ETIMEDOUT' ||
      msg.includes('timeout') || msg.includes('timed out')
    ) return VectorDBErrorType.TIMEOUT;

    if (
      status === 429 || status === 503 ||
      msg.includes('rate limit') || msg.includes('throttl') || msg.includes('service unavailable')
    ) return VectorDBErrorType.SERVICE;

    if (
      msg.includes('query') || msg.includes('syntax') || msg.includes('sql') || msg.includes('malformed') || msg.includes('does not exist') || code.startsWith('42') ||
      msg.includes('wrongtype') || msg.includes('unknown command') || msg.includes('operation against a key')
    ) return VectorDBErrorType.QUERY_FAILED;

    if (msg.includes('vector')) return VectorDBErrorType.VECTOR_CREATION_FAILED;

    if (msg.includes('not initialized') || msg.includes('initialize') || msg.includes('configuration'))
      return VectorDBErrorType.INITIALIZATION;

    return VectorDBErrorType.UNKNOWN_ERROR;
  }

  public isNetworkError(error: unknown): boolean {
    return this.isRetryableError(error) && this.getGenericFallbackType(error) === VectorDBErrorType.CONNECTION_FAILED;
  }

  public isTimeoutError(error: unknown): boolean {
    return this.isRetryableError(error) && this.getGenericFallbackType(error) === VectorDBErrorType.TIMEOUT;
  }
}

// Re-export types from the original error handler
export { VectorDBErrorType, VectorDBError, categorizeErrorWithProvider as categorizeError };
// Backward-compatible aliases
export { VectorDBErrorType as VectorDbErrorType, VectorDBError as VectorDbError };