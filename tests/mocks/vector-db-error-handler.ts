/**
 * Mock for legacy vector-db-error-handler
 * Provides compatibility with existing error handler interface
 */

import { VectorDbError, VectorDbErrorType } from './vector-db-error-handler-new';

// Legacy error types that map to new enum values
export const VectorDBErrorType = {
  CONNECTION_FAILED: VectorDbErrorType.CONNECTION,
  SIMILARITY_SEARCH_FAILED: VectorDbErrorType.SEARCH,
  VECTOR_CREATION_FAILED: VectorDbErrorType.VECTOR_OPERATION_FAILED,
  VECTOR_UPDATE_FAILED: VectorDbErrorType.VECTOR_OPERATION_FAILED,
  VECTOR_DELETION_FAILED: VectorDbErrorType.VECTOR_OPERATION_FAILED,
  // Include all new enum values for full compatibility
  ...VectorDbErrorType
};

// Legacy error class alias
export const VectorDBError = VectorDbError;

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

  const errorMessage = error.message || 'Unknown vector database error';
  const errorDetails: Record<string, any> = {};

  // Extract useful information from the error
  if (error.code) errorDetails.code = error.code;
  if (error.errno) errorDetails.errno = error.errno;
  if (error.stack) errorDetails.stack = error.stack;

  // Simple categorization for legacy compatibility
  let errorType = VectorDbErrorType.UNKNOWN_ERROR;
  const message = errorMessage.toLowerCase();
  const code = (error.code || '').toString();

  if (code === 'ECONNREFUSED' || message.includes('connection')) {
    errorType = VectorDbErrorType.CONNECTION;
  } else if (message.includes('timeout')) {
    errorType = VectorDbErrorType.TIMEOUT;
  } else if (message.includes('auth') || message.includes('credential')) {
    errorType = VectorDbErrorType.AUTHORIZATION_ERROR;
  } else if (message.includes('query') || message.includes('sql')) {
    errorType = VectorDbErrorType.QUERY_FAILED;
  }

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