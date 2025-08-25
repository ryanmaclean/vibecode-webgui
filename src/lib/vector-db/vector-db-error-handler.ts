/**
 * Vector Database Error Handler
 * Provides consistent error handling for vector database operations
 */

import { metrics } from '../server-monitoring';

/**
 * Error types for vector database operations
 */
export enum VectorDbErrorType {
  INITIALIZATION = 'initialization',
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  STORE = 'store',
  SEARCH = 'search',
  DELETE = 'delete',
  STATS = 'stats',
  CACHE = 'cache',
  EMBEDDING = 'embedding',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * Error details for vector database operations
 */
export interface VectorDbErrorDetails {
  errorType: VectorDbErrorType;
  provider: string;
  operation: string;
  message: string;
  retryable: boolean;
  originalError?: any;
  data?: Record<string, any>;
}

/**
 * Vector Database Error class
 * Extends Error with additional context for vector database operations
 */
export class VectorDbError extends Error {
  public errorType: VectorDbErrorType;
  public provider: string;
  public operation: string;
  public retryable: boolean;
  public originalError?: any;
  public data?: Record<string, any>;

  constructor(details: VectorDbErrorDetails) {
    super(details.message);
    this.name = 'VectorDbError';
    this.errorType = details.errorType;
    this.provider = details.provider;
    this.operation = details.operation;
    this.retryable = details.retryable;
    this.originalError = details.originalError;
    this.data = details.data;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VectorDbError);
    }
  }

  /**
   * Format error for logging
   */
  public toLogFormat(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      provider: this.provider,
      operation: this.operation,
      retryable: this.retryable,
      data: this.data,
      originalError: this.originalError instanceof Error ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : this.originalError
    };
  }
}

/**
 * Vector Database Error Handler
 * Provides consistent error handling for vector database operations
 */
export class VectorDbErrorHandler {
  private provider: string;
  private enableLogging: boolean;
  private enableMetrics: boolean;

  constructor(provider: string, enableLogging: boolean = true, enableMetrics: boolean = true) {
    this.provider = provider;
    this.enableLogging = enableLogging;
    this.enableMetrics = enableMetrics;
  }

  /**
   * Handle error from vector database operation
   * @param error The original error
   * @param operation The operation that failed
   * @param errorType The type of error
   * @param retryable Whether the operation is retryable
   * @param data Additional data to include in the error
   * @returns A new VectorDbError with consistent formatting
   */
  public handleError(
    error: any,
    operation: string,
    errorType: VectorDbErrorType = VectorDbErrorType.UNKNOWN,
    retryable: boolean = false,
    data?: Record<string, any>
  ): VectorDbError {
    // Determine error message
    let message = 'Vector database operation failed';
    
    if (error instanceof Error) {
      message = `${message}: ${error.message}`;
    } else if (typeof error === 'string') {
      message = `${message}: ${error}`;
    }

    // Record metrics
    if (this.enableMetrics) {
      metrics.increment(`vector_db.${operation}.error`);
      metrics.increment(`vector_db.${operation}.error.${errorType}`);
    }

    // Create error details
    const errorDetails: VectorDbErrorDetails = {
      errorType,
      provider: this.provider,
      operation,
      message,
      retryable,
      originalError: error,
      data
    };

    // Create error
    const vectorDbError = new VectorDbError(errorDetails);

    // Log error if enabled
    if (this.enableLogging) {
      console.error(`Vector DB Error (${this.provider}/${operation}):`, 
        vectorDbError.message, 
        { 
          errorType, 
          retryable, 
          data: vectorDbError.data,
          originalError: error instanceof Error ? error.message : error
        }
      );
    }

    return vectorDbError;
  }

  /**
   * Determine if an error is a timeout error
   */
  public isTimeoutError(error: any): boolean {
    if (!error) return false;
    
    // Check common timeout error patterns
    const message = error.message || error.toString();
    const timeoutKeywords = [
      'timeout',
      'timed out',
      'deadline exceeded',
      'operation timed out',
      'request timed out',
      'connection timed out'
    ];
    
    // Check for timeout indicators
    return (
      error.name === 'TimeoutError' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      timeoutKeywords.some(keyword => message.toLowerCase().includes(keyword))
    );
  }

  /**
   * Determine if an error is a network error
   */
  public isNetworkError(error: any): boolean {
    if (!error) return false;
    
    // Check common network error patterns
    const message = error.message || error.toString();
    const networkKeywords = [
      'network',
      'connect',
      'connection',
      'unreachable',
      'socket',
      'host',
      'dns',
      'eai_again',
      'econnrefused',
      'econnreset'
    ];
    
    // Check for network error indicators
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ENETUNREACH' ||
      error.code === 'EHOSTUNREACH' ||
      error.code === 'EAI_AGAIN' ||
      networkKeywords.some(keyword => message.toLowerCase().includes(keyword))
    );
  }

  /**
   * Determine if an error is an authentication error
   */
  public isAuthError(error: any): boolean {
    if (!error) return false;
    
    // Check common auth error patterns
    const message = error.message || error.toString();
    const authKeywords = [
      'auth',
      'authentication',
      'unauthorized',
      'forbidden',
      'access denied',
      'permission',
      'credential',
      'token',
      'apikey',
      'api key',
      '401',
      '403'
    ];
    
    // Check for auth error indicators
    return (
      error.status === 401 ||
      error.status === 403 ||
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      authKeywords.some(keyword => message.toLowerCase().includes(keyword))
    );
  }

  /**
   * Classify an error based on its properties and message
   */
  public classifyError(error: any): VectorDbErrorType {
    if (!error) return VectorDbErrorType.UNKNOWN;
    
    if (this.isTimeoutError(error)) {
      return VectorDbErrorType.TIMEOUT;
    }
    
    if (this.isNetworkError(error)) {
      return VectorDbErrorType.CONNECTION;
    }
    
    if (this.isAuthError(error)) {
      return VectorDbErrorType.AUTHENTICATION;
    }
    
    // Default to unknown
    return VectorDbErrorType.UNKNOWN;
  }
}