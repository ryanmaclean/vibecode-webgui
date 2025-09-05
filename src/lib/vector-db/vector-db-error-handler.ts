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
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class VectorDBError extends Error {
  type: VectorDBErrorType;
  operation: string;
  provider: string;
  details: any;
  timestamp: string;

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

  // Map common database errors to appropriate types
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
    errorMessage,
    errorType,
    operation,
    provider,
    errorDetails
  );
};
