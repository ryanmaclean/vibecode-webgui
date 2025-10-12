/**
 * Error Tracking Utilities
 * 
 * This module provides utility functions for consistent error tracking
 * across different parts of the application.
 */

import { trackError, trackApiError, trackDatabaseError, trackAuthError, trackValidationError, trackPerformanceIssue } from '../monitoring/error-tracking';
import { logger } from '@/lib/logger';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  [key: string]: unknown;
}

/**
 * Error tracking utilities for React components
 */
export class ComponentErrorTracker {
  private componentName: string;

  constructor(componentName: string) {
    this.componentName = componentName;
  }

  /**
   * Track an error in a React component
   */
  trackError(error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      component: this.componentName
    });
  }

  /**
   * Track a warning in a React component
   */
  trackWarning(message: string, context: ErrorContext = {}): void {
    trackError(new Error(message), {
      ...context,
      component: this.componentName
    });
  }

  /**
   * Track user interactions that might lead to errors
   */
  trackUserInteraction(action: string, context: ErrorContext = {}): void {
    logger.info(`User interaction in ${this.componentName}: ${action}`, context);
  }
}

/**
 * Error tracking utilities for database operations
 */
export class DatabaseErrorTracker {
  /**
   * Track database connection errors
   */
  static trackConnectionError(error: Error, context: ErrorContext = {}): void {
    trackDatabaseError('connection', error, {
      ...context,
      error_type: 'connection'
    });
  }

  /**
   * Track database query errors
   */
  static trackQueryError(operation: string, error: Error, context: ErrorContext = {}): void {
    trackDatabaseError(operation, error, {
      ...context,
      error_type: 'query'
    });
  }

  /**
   * Track database transaction errors
   */
  static trackTransactionError(operation: string, error: Error, context: ErrorContext = {}): void {
    trackDatabaseError(operation, error, {
      ...context,
      error_type: 'transaction'
    });
  }

  /**
   * Track database migration errors
   */
  static trackMigrationError(migration: string, error: Error, context: ErrorContext = {}): void {
    trackDatabaseError(migration, error, {
      ...context,
      error_type: 'migration'
    });
  }
}

/**
 * Error tracking utilities for authentication
 */
export class AuthErrorTracker {
  /**
   * Track login errors
   */
  static trackLoginError(error: Error, context: ErrorContext = {}): void {
    trackAuthError(error, {
      ...context,
      auth_action: 'login'
    });
  }

  /**
   * Track logout errors
   */
  static trackLogoutError(error: Error, context: ErrorContext = {}): void {
    trackAuthError(error, {
      ...context,
      auth_action: 'logout'
    });
  }

  /**
   * Track token validation errors
   */
  static trackTokenError(error: Error, context: ErrorContext = {}): void {
    trackAuthError(error, {
      ...context,
      auth_action: 'token_validation'
    });
  }

  /**
   * Track password reset errors
   */
  static trackPasswordResetError(error: Error, context: ErrorContext = {}): void {
    trackAuthError(error, {
      ...context,
      auth_action: 'password_reset'
    });
  }
}

/**
 * Error tracking utilities for file operations
 */
export class FileErrorTracker {
  /**
   * Track file upload errors
   */
  static trackUploadError(error: Error, filename: string, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      file_operation: 'upload',
      filename,
      component: 'file-operations'
    });
  }

  /**
   * Track file download errors
   */
  static trackDownloadError(error: Error, filename: string, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      file_operation: 'download',
      filename,
      component: 'file-operations'
    });
  }

  /**
   * Track file processing errors
   */
  static trackProcessingError(error: Error, filename: string, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      file_operation: 'processing',
      filename,
      component: 'file-operations'
    });
  }
}

/**
 * Error tracking utilities for AI operations
 */
export class AIErrorTracker {
  /**
   * Track AI model errors
   */
  static trackModelError(model: string, error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      ai_model: model,
      component: 'ai-operations'
    });
  }

  /**
   * Track AI prompt errors
   */
  static trackPromptError(promptId: string, error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      prompt_id: promptId,
      component: 'ai-operations'
    });
  }

  /**
   * Track AI response errors
   */
  static trackResponseError(error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      component: 'ai-operations'
    });
  }
}

/**
 * Error tracking utilities for external API calls
 */
export class ExternalAPIErrorTracker {
  /**
   * Track external API errors
   */
  static trackAPIError(service: string, endpoint: string, error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      external_service: service,
      external_endpoint: endpoint,
      component: 'external-api'
    });
  }

  /**
   * Track rate limiting errors
   */
  static trackRateLimitError(service: string, error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      external_service: service,
      error_type: 'rate_limit',
      component: 'external-api'
    });
  }

  /**
   * Track timeout errors
   */
  static trackTimeoutError(service: string, timeout: number, context: ErrorContext = {}): void {
    trackError(new Error(`Timeout after ${timeout}ms`), {
      ...context,
      external_service: service,
      error_type: 'timeout',
      timeout_ms: timeout,
      component: 'external-api'
    });
  }
}

/**
 * Performance error tracking utilities
 */
export class PerformanceErrorTracker {
  /**
   * Track slow operations
   */
  static trackSlowOperation(operation: string, duration: number, threshold: number, context: ErrorContext = {}): void {
    trackPerformanceIssue(
      `Slow ${operation}`,
      { duration, threshold },
      {
        ...context,
        operation,
        component: 'performance'
      }
    );
  }

  /**
   * Track memory issues
   */
  static trackMemoryIssue(usage: number, limit: number, context: ErrorContext = {}): void {
    trackPerformanceIssue(
      'High memory usage',
      { usage, limit, percentage: (usage / limit) * 100 },
      {
        ...context,
        component: 'performance'
      }
    );
  }

  /**
   * Track CPU issues
   */
  static trackCPUIssue(usage: number, context: ErrorContext = {}): void {
    trackPerformanceIssue(
      'High CPU usage',
      { cpu_usage: usage },
      {
        ...context,
        component: 'performance'
      }
    );
  }
}

/**
 * Generic error tracking utilities
 */
export class GenericErrorTracker {
  /**
   * Track validation errors
   */
  static trackValidationError(field: string, error: Error, context: ErrorContext = {}): void {
    trackValidationError(field, error, context);
  }

  /**
   * Track configuration errors
   */
  static trackConfigError(configKey: string, error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      config_key: configKey,
      error_type: 'configuration',
      component: 'config'
    });
  }

  /**
   * Track network errors
   */
  static trackNetworkError(error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      error_type: 'network',
      component: 'network'
    });
  }

  /**
   * Track parsing errors
   */
  static trackParsingError(dataType: string, error: Error, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      data_type: dataType,
      error_type: 'parsing',
      component: 'data-parsing'
    });
  }
}

/**
 * React Error Boundary integration
 */
export class ReactErrorBoundaryTracker {
  /**
   * Track React error boundary errors
   */
  static trackBoundaryError(error: Error, errorInfo: any, context: ErrorContext = {}): void {
    trackError(error, {
      ...context,
      error_boundary: true,
      error_info: errorInfo,
      component: 'react-error-boundary'
    });
  }
}

/**
 * Utility function to create a component error tracker
 */
export function createComponentErrorTracker(componentName: string): ComponentErrorTracker {
  return new ComponentErrorTracker(componentName);
}
