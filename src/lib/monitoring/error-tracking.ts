/**
 * Datadog Error Tracking Integration
 * 
 * This module provides comprehensive error tracking using Datadog's Error Tracking
 * capabilities, replacing any existing Sentry integration.
 */

import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';
// import { logger } from '@/lib/logger';
export interface ErrorTrackingConfig {
  service: string;
  environment: string;
  version: string;
  apiKey?: string;
  site?: string;
  enabled: boolean;
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  [key: string]: unknown;
}

export interface TrackedError {
  error: Error;
  context?: ErrorContext;
  level?: 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
}

class DatadogErrorTracker {
  private config: ErrorTrackingConfig;
  private initialized = false;

  constructor(config: ErrorTrackingConfig) {
    this.config = config;
  }

  /**
   * Initialize error tracking
   */
  init(): void {
    if (this.initialized || !this.config.enabled) {
      return;
    }

    try {
      // Error tracking is automatically enabled with RUM
      // We just need to ensure proper configuration
      console.info('🐕 Datadog Error Tracking initialized for service:', this.config.service);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Datadog Error Tracking:', error);
    }
  }

  /**
   * Track an error with context
   */
  trackError(trackedError: TrackedError): void {
    if (!this.initialized || !this.config.enabled) {
      console.warn('Error tracking not initialized or disabled');
      return;
    }

    try {
      const { error, context, level = 'error', tags = {} } = trackedError;

      // Add error to RUM
      datadogRum.addError(error, {
        ...context,
        service: this.config.service,
        environment: this.config.environment,
        version: this.config.version,
        level,
        ...tags
      });

      // Also log the error for additional context
      datadogLogs.console.error(error.message, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...context,
        service: this.config.service,
        environment: this.config.environment,
        version: this.config.version,
        level,
        ...tags
      });

      console.info(`🐕 Error tracked: ${error.name} - ${error.message}`);
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  }

  /**
   * Track a warning
   */
  trackWarning(message: string, context?: ErrorContext): void {
    this.trackError({
      error: new Error(message),
      context,
      level: 'warning'
    });
  }

  /**
   * Track user action with error context
   */
  trackUserAction(action: string, context?: ErrorContext): void {
    if (!this.initialized || !this.config.enabled) {
      return;
    }

    try {
      datadogRum.addAction(action, {
        ...context,
        service: this.config.service,
        environment: this.config.environment,
        version: this.config.version
      });
    } catch (error) {
      console.error('Failed to track user action:', error);
    }
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id?: string; name?: string; email?: string; [key: string]: any }): void {
    if (!this.initialized || !this.config.enabled) {
      return;
    }

    try {
      datadogRum.setUser(user);
      datadogLogs.setUser(user);
    } catch (error) {
      console.error('Failed to set user context:', error);
    }
  }

  /**
   * Add global context to all tracked errors
   */
  addGlobalContext(key: string, value: any): void {
    if (!this.initialized || !this.config.enabled) {
      return;
    }

    try {
      datadogRum.setGlobalContextProperty(key, value);
      datadogLogs.setGlobalContextProperty(key, value);
    } catch (error) {
      console.error('Failed to add global context:', error);
    }
  }

  /**
   * Track performance issues as errors
   */
  trackPerformanceIssue(issue: string, metrics: Record<string, number>, context?: ErrorContext): void {
    this.trackError({
      error: new Error(`Performance Issue: ${issue}`),
      context: {
        ...context,
        performance_metrics: metrics
      },
      level: 'warning',
      tags: {
        issue_type: 'performance'
      }
    });
  }

  /**
   * Track API errors
   */
  trackApiError(endpoint: string, statusCode: number, error: Error, context?: ErrorContext): void {
    this.trackError({
      error,
      context: {
        ...context,
        endpoint,
        status_code: statusCode
      },
      tags: {
        error_type: 'api',
        endpoint: endpoint.replace(/[^a-zA-Z0-9]/g, '_'),
        status_code: statusCode.toString()
      }
    });
  }

  /**
   * Track database errors
   */
  trackDatabaseError(operation: string, error: Error, context?: ErrorContext): void {
    this.trackError({
      error,
      context: {
        ...context,
        database_operation: operation
      },
      tags: {
        error_type: 'database',
        operation: operation.replace(/[^a-zA-Z0-9]/g, '_')
      }
    });
  }

  /**
   * Track authentication errors
   */
  trackAuthError(error: Error, context?: ErrorContext): void {
    this.trackError({
      error,
      context,
      tags: {
        error_type: 'authentication'
      }
    });
  }

  /**
   * Track validation errors
   */
  trackValidationError(field: string, error: Error, context?: ErrorContext): void {
    this.trackError({
      error,
      context: {
        ...context,
        validation_field: field
      },
      tags: {
        error_type: 'validation',
        field: field.replace(/[^a-zA-Z0-9]/g, '_')
      }
    });
  }
}

// Create singleton instance
let errorTracker: DatadogErrorTracker | null = null;

/**
 * Get the error tracker instance
 */
export function getErrorTracker(): DatadogErrorTracker {
  if (!errorTracker) {
    const config: ErrorTrackingConfig = {
      service: process.env.NEXT_PUBLIC_DD_SERVICE || 'vibecode-webgui',
      environment: process.env.NEXT_PUBLIC_DD_ENV || process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_DD_VERSION || process.env.APP_VERSION || '1.0.0',
      apiKey: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN,
      site: process.env.NEXT_PUBLIC_DD_SITE || 'datadoghq.com',
      enabled: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN ? true : false
    };

    errorTracker = new DatadogErrorTracker(config);
    errorTracker.init();
  }

  return errorTracker;
}

/**
 * Convenience functions for common error tracking scenarios
 */
export const trackError = (error: Error, context?: ErrorContext) => {
  getErrorTracker().trackError({ error, context });
};

export const trackWarning = (message: string, context?: ErrorContext) => {
  getErrorTracker().trackWarning(message, context);
};

export const trackUserAction = (action: string, context?: ErrorContext) => {
  getErrorTracker().trackUserAction(action, context);
};

export const setUser = (user: { id?: string; name?: string; email?: string; [key: string]: any }) => {
  getErrorTracker().setUser(user);
};

export const trackApiError = (endpoint: string, statusCode: number, error: Error, context?: ErrorContext) => {
  getErrorTracker().trackApiError(endpoint, statusCode, error, context);
};

export const trackDatabaseError = (operation: string, error: Error, context?: ErrorContext) => {
  getErrorTracker().trackDatabaseError(operation, error, context);
};

export const trackAuthError = (error: Error, context?: ErrorContext) => {
  getErrorTracker().trackAuthError(error, context);
};

export const trackValidationError = (field: string, error: Error, context?: ErrorContext) => {
  getErrorTracker().trackValidationError(field, error, context);
};

export const trackPerformanceIssue = (issue: string, metrics: Record<string, number>, context?: ErrorContext) => {
  getErrorTracker().trackPerformanceIssue(issue, metrics, context);
};

// Export the class for advanced usage
export { DatadogErrorTracker };
