/**
 * Enhanced Vector Database Error Handler
 */

import { 
  VectorDBErrorType, 
  VectorDBError, 
  handleVectorDBError
} from './vector-db-error-handler';
import { categorizeErrorWithProvider } from './database-error-patterns';

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
    error: any,
    operation: string,
    errorType?: VectorDBErrorType,
    retryable?: boolean,
    additionalContext: any = {}
  ): VectorDBError {
    // Check for Azure PostgreSQL specific pgvector errors
    if (this.isAzurePgVectorError(error)) {
      const message = error.message || 'Azure PostgreSQL pgvector extension error';
      additionalContext = {
        ...additionalContext,
        azure: true,
        pgvectorError: true,
        requiresAdminAction: true
      };
      return new VectorDBError(
        message,
        VectorDBErrorType.INITIALIZATION,
        operation,
        this.provider,
        additionalContext
      );
    }

    // If error type is not provided, use provider-specific categorization
    const resolvedErrorType = errorType || this.getProviderSpecificErrorType(error);
    
    // Use the handleVectorDBError function from the base module
    return handleVectorDBError(error, operation, this.provider);
  }

  /**
   * Use provider-specific error categorization 
   */
  private getProviderSpecificErrorType(error: any): VectorDBErrorType {
    return categorizeErrorWithProvider(error, this.provider);
  }

  /**
   * Check if an error is retryable based on error type and provider
   */
  public isRetryableError(error: any): boolean {
    const errorType = this.getProviderSpecificErrorType(error);
    
    // Generally retryable error types
    const retryableTypes = [
      VectorDBErrorType.CONNECTION_FAILED,
      VectorDBErrorType.TIMEOUT,
      VectorDBErrorType.SERVICE,
      VectorDBErrorType.UNKNOWN_ERROR
    ];
    
    return retryableTypes.includes(errorType);
  }
  
  /**
   * Check if an error is related to Azure PostgreSQL pgvector limitations
   */
  private isAzurePgVectorError(error: any): boolean {
    if (!error) return false;
    
    const message = (error.message || '').toLowerCase();
    
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
}

// Re-export types from the original error handler
export { VectorDBErrorType, VectorDBError, categorizeErrorWithProvider as categorizeError };