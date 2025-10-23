// import { logger } from '@/lib/logger';


/**
 * Vector Database Error Handler
 * Centralized error handling for vector database operations
 */

export enum VectorDbErrorType {
  CONNECTION_ERROR = 'connection_error',
  QUERY_ERROR = 'query_error',
  INDEX_ERROR = 'index_error',
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  TIMEOUT_ERROR = 'timeout_error',
  STORAGE_ERROR = 'storage_error',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface VectorDbErrorDetails {
  type: VectorDbErrorType;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  fallbackStrategy?: 'default' | 'alternative' | 'none';
}

/**
 * Vector Database Error Class
 */
export class VectorDbError extends Error {
  public readonly type: VectorDbErrorType;
  public readonly context?: Record<string, any>;
  public readonly retryable: boolean;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(details: VectorDbErrorDetails) {
    super(details.message);
    this.name = 'VectorDbError';
    this.type = details.type;
    this.context = details.context;
    this.retryable = details.retryable;
    this.severity = details.severity;

    if (details.stack) {
      this.stack = details.stack;
    } else if (details.originalError?.stack) {
      this.stack = details.originalError.stack;
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      context: this.context,
      retryable: this.retryable,
      severity: this.severity,
      stack: this.stack,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Vector Database Error Handler
 */
export class VectorDbErrorHandler {
  private errorCounts: Map<VectorDbErrorType, number> = new Map();
  private recentErrors: Array<{
    error: VectorDbError;
    timestamp: Date;
    operation: string;
  }> = [];

  /**
   * Handle and classify vector database errors
   */
  handleError(
    error: Error | unknown,
    operation: string,
    context?: Record<string, any>
  ): VectorDbError {
    const errorDetails = this.classifyError(error, operation, context);
    const vectorDbError = new VectorDbError(errorDetails);

    // Track error statistics
    this.trackError(vectorDbError, operation);

    // Log error based on severity
    this.logError(vectorDbError, operation);

    return vectorDbError;
  }

  /**
   * Classify error type and determine properties
   */
  private classifyError(
    error: Error | unknown,
    operation: string,
    context?: Record<string, any>
  ): VectorDbErrorDetails {
    const message = error instanceof Error ? error.message : String(error);
    const originalError = error instanceof Error ? error : undefined;

    // Connection-related errors
    if (message.includes('ECONNREFUSED') || message.includes('Connection refused')) {
      return {
        type: VectorDbErrorType.CONNECTION_ERROR,
        message: `Connection failed for operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: true,
        severity: 'high'
      };
    }

    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return {
        type: VectorDbErrorType.TIMEOUT_ERROR,
        message: `Operation timed out: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: true,
        severity: 'medium'
      };
    }

    if (message.includes('authentication') || message.includes('unauthorized') || message.includes('403')) {
      return {
        type: VectorDbErrorType.AUTHENTICATION_ERROR,
        message: `Authentication failed for operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: false,
        severity: 'high'
      };
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return {
        type: VectorDbErrorType.RATE_LIMIT_ERROR,
        message: `Rate limit exceeded for operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: true,
        severity: 'medium'
      };
    }

    // Query/Index related errors
    if (message.includes('syntax') || message.includes('invalid query') || message.includes('SQL')) {
      return {
        type: VectorDbErrorType.QUERY_ERROR,
        message: `Query error in operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: false,
        severity: 'medium'
      };
    }

    if (message.includes('index') || message.includes('vector') || message.includes('dimension')) {
      return {
        type: VectorDbErrorType.INDEX_ERROR,
        message: `Index error in operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: false,
        severity: 'medium'
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return {
        type: VectorDbErrorType.VALIDATION_ERROR,
        message: `Validation error in operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: false,
        severity: 'low'
      };
    }

    // Storage/Database errors
    if (message.includes('disk') || message.includes('storage') || message.includes('database')) {
      return {
        type: VectorDbErrorType.STORAGE_ERROR,
        message: `Storage error in operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: true,
        severity: 'high'
      };
    }

    // Configuration errors
    if (message.includes('config') || message.includes('missing') || message.includes('undefined')) {
      return {
        type: VectorDbErrorType.CONFIGURATION_ERROR,
        message: `Configuration error in operation: ${operation}`,
        originalError,
        context: { ...context, operation },
        timestamp: new Date(),
        retryable: false,
        severity: 'medium'
      };
    }

    // Default to unknown error
    return {
      type: VectorDbErrorType.UNKNOWN_ERROR,
      message: `Unknown error in operation: ${operation} - ${message}`,
      originalError,
      context: { ...context, operation, originalMessage: message },
      timestamp: new Date(),
      retryable: false,
      severity: 'medium'
    };
  }

  /**
   * Track error statistics
   */
  private trackError(error: VectorDbError, operation: string): void {
    // Increment error count for this type
    const currentCount = this.errorCounts.get(error.type) || 0;
    this.errorCounts.set(error.type, currentCount + 1);

    // Store recent error for analysis
    this.recentErrors.push({
      error,
      timestamp: new Date(),
      operation
    });

    // Keep only recent errors (last 100)
    if (this.recentErrors.length > 100) {
      this.recentErrors = this.recentErrors.slice(-100);
    }
  }

  /**
   * Log error based on severity
   */
  private logError(error: VectorDbError, operation: string): void {
    const logData = {
      type: error.type,
      message: error.message,
      operation,
      context: error.context,
      timestamp: error.timestamp || new Date()
    };

    switch (error.severity) {
      case 'critical':
        console.error('CRITICAL VectorDB Error:', logData);
        // In production, this would trigger alerts
        break;
      case 'high':
        console.error('HIGH VectorDB Error:', logData);
        break;
      case 'medium':
        console.warn('MEDIUM VectorDB Error:', logData);
        break;
      case 'low':
        console.info('LOW VectorDB Error:', logData);
        break;
    }
  }

  /**
   * Attempt error recovery with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: ErrorRecoveryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    const exponentialBackoff = options.exponentialBackoff !== false;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const vectorDbError = this.handleError(lastError, 'retry_operation');
        if (!vectorDbError.retryable || attempt === maxRetries) {
          throw lastError;
        }

        // Wait before retry
        const delay = exponentialBackoff ? retryDelay * Math.pow(2, attempt) : retryDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Retry operation failed');
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{
      type: VectorDbErrorType;
      message: string;
      operation: string;
      timestamp: Date;
    }>;
    errorRate: number;
  } {
    const errorsByType: Record<string, number> = {};
    this.errorCounts.forEach((count, type) => {
      errorsByType[type] = count;
    });

    const recentErrorSummary = this.recentErrors.slice(-10).map(entry => ({
      type: entry.error.type,
      message: entry.error.message,
      operation: entry.operation,
      timestamp: entry.timestamp
    }));

    // Calculate error rate (errors per minute over last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrorCount = this.recentErrors.filter(e => e.timestamp > oneHourAgo).length;
    const errorRate = recentErrorCount / 60; // per minute

    return {
      totalErrors: this.recentErrors.length,
      errorsByType,
      recentErrors: recentErrorSummary,
      errorRate
    };
  }

  /**
   * Get error recovery suggestions
   */
  getRecoverySuggestions(): Array<{
    type: VectorDbErrorType;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const suggestions: Array<{
      type: VectorDbErrorType;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    const stats = this.getErrorStats();

    // Connection errors - high priority
    if (stats.errorsByType[VectorDbErrorType.CONNECTION_ERROR] > 5) {
      suggestions.push({
        type: VectorDbErrorType.CONNECTION_ERROR,
        suggestion: 'Check database connectivity and network configuration',
        priority: 'high'
      });
    }

    // Timeout errors - medium priority
    if (stats.errorsByType[VectorDbErrorType.TIMEOUT_ERROR] > 3) {
      suggestions.push({
        type: VectorDbErrorType.TIMEOUT_ERROR,
        suggestion: 'Review query performance and consider adding indexes',
        priority: 'medium'
      });
    }

    // Authentication errors - high priority
    if (stats.errorsByType[VectorDbErrorType.AUTHENTICATION_ERROR] > 0) {
      suggestions.push({
        type: VectorDbErrorType.AUTHENTICATION_ERROR,
        suggestion: 'Verify database credentials and permissions',
        priority: 'high'
      });
    }

    // Rate limit errors - medium priority
    if (stats.errorsByType[VectorDbErrorType.RATE_LIMIT_ERROR] > 2) {
      suggestions.push({
        type: VectorDbErrorType.RATE_LIMIT_ERROR,
        suggestion: 'Implement rate limiting or upgrade service tier',
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Clear error statistics
   */
  clearStats(): void {
    this.errorCounts.clear();
    this.recentErrors = [];
  }

  /**
   * Check if service is healthy based on error patterns
   */
  isHealthy(): boolean {
    const stats = this.getErrorStats();

    // Unhealthy if error rate is too high or critical errors occurred recently
    if (stats.errorRate > 1) return false; // More than 1 error per minute

    const recentCriticalErrors = this.recentErrors.filter(
      e => e.error.severity === 'critical' && e.timestamp > new Date(Date.now() - 5 * 60 * 1000)
    );

    return recentCriticalErrors.length === 0;
  }
}

/**
 * Legacy function-based error handler
 * @deprecated Use VectorDbErrorHandler class instead
 */
export function handleVectorDbError(
  error: Error | unknown,
  operation: string,
  context?: Record<string, any>
): VectorDbError {
  const handler = new VectorDbErrorHandler();
  return handler.handleError(error, operation, context);
}

// Export singleton instance for global use
export const vectorDbErrorHandler = new VectorDbErrorHandler();
