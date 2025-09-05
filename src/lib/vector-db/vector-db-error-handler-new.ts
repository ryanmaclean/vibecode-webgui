/**
 * Enhanced Vector Database Error Handler
 */

import { 
  VectorDbErrorType, 
  VectorDbError, 
  VectorDbErrorHandler as BaseErrorHandler 
} from './vector-db-error-handler';
import { categorizeErrorWithProvider } from './database-error-patterns';

/**
 * Enhanced error handler class for vector database operations
 * This extends the base error handler with provider-specific categorization
 */
export class VectorDbErrorHandler extends BaseErrorHandler {
  constructor(provider: string, enableLogging: boolean = false, enableMetrics: boolean = false) {
    super(provider, enableLogging, enableMetrics);
  }

  /**
   * Handle an error with consistent formatting and logging and enhanced categorization
   */
  public handleError(
    error: any,
    operation: string,
    errorType?: VectorDbErrorType,
    retryable?: boolean,
    additionalContext: any = {}
  ): VectorDbError {
    // Check for Azure PostgreSQL specific pgvector errors
    if (this.isAzurePgVectorError(error)) {
      const message = error.message || 'Azure PostgreSQL pgvector extension error';
      additionalContext = {
        ...additionalContext,
        azure: true,
        pgvectorError: true,
        requiresAdminAction: true
      };
      // @ts-expect-error - Accessing private property from parent class
      return new VectorDbError(
        message,
        VectorDbErrorType.INITIALIZATION,
        operation,
        // @ts-expect-error - Accessing private property from parent class
        this.provider as string,
        additionalContext
      );
    }

    // If error type is not provided, use provider-specific categorization
    const resolvedErrorType = errorType || this.getProviderSpecificErrorType(error);
    
    // Call parent handleError with the resolved error type
    return super.handleError(error, operation, resolvedErrorType, retryable, additionalContext);
  }

  /**
   * Use provider-specific error categorization 
   */
  private getProviderSpecificErrorType(error: any): VectorDbErrorType {
    // Access provider property through "this"
    // @ts-expect-error - Accessing private property from parent class
    const provider = this.provider as string;
    return categorizeErrorWithProvider(error, provider);
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
export { VectorDbErrorType, VectorDbError };