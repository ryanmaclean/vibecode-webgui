/**
 * Error Logger
 *
 * Provides specialized error logging with stack traces and context.
 */

import { logger } from '@/lib/logger';
import { sanitizeLogData, LogMetadata } from './format';

/**
 * Error context for detailed error logging
 */
export interface ErrorContext {
  operation?: string;
  requestId?: string;
  userId?: string;
  component?: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Formatted error structure
 */
export interface FormattedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  cause?: FormattedError;
  details?: Record<string, unknown>;
}

/**
 * Format an error for logging
 *
 * @param error - The error to format
 * @returns Formatted error object
 */
export function formatError(error: unknown): FormattedError {
  if (error instanceof Error) {
    const formatted: FormattedError = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };

    // Extract additional error properties
    const errorObj = error as unknown as Record<string, unknown>;

    if ('code' in errorObj) {
      formatted.code = String(errorObj.code);
    }

    if ('statusCode' in errorObj) {
      formatted.statusCode = Number(errorObj.statusCode);
    }

    if ('status' in errorObj) {
      formatted.statusCode = Number(errorObj.status);
    }

    if ('cause' in errorObj && errorObj.cause) {
      formatted.cause = formatError(errorObj.cause);
    }

    // Capture any additional properties
    const knownProps = new Set([
      'name',
      'message',
      'stack',
      'code',
      'statusCode',
      'status',
      'cause'
    ]);
    const additionalProps: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(errorObj)) {
      if (!knownProps.has(key) && typeof value !== 'function') {
        additionalProps[key] = value;
      }
    }

    if (Object.keys(additionalProps).length > 0) {
      formatted.details = sanitizeLogData(additionalProps);
    }

    return formatted;
  }

  // Handle non-Error objects
  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error
    };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      name: 'UnknownError',
      message: JSON.stringify(error),
      details: sanitizeLogData(error as Record<string, unknown>)
    };
  }

  return {
    name: 'UnknownError',
    message: String(error)
  };
}

/**
 * Log an error with full context and stack trace
 *
 * @param error - The error to log
 * @param context - Additional context about the error
 *
 * @example
 * ```typescript
 * try {
 *   await createWorkspace(data);
 * } catch (error) {
 *   logError(error, {
 *     operation: 'createWorkspace',
 *     requestId: 'abc-123',
 *     input: { projectName: data.projectName }
 *   });
 * }
 * ```
 */
export function logError(error: unknown, context?: ErrorContext): void {
  const formattedError = formatError(error);

  const logData: Record<string, unknown> = {
    error: formattedError,
    errorType: formattedError.name,
    errorMessage: formattedError.message
  };

  if (formattedError.stack) {
    logData.stackTrace = formattedError.stack;
  }

  if (formattedError.code) {
    logData.errorCode = formattedError.code;
  }

  if (formattedError.statusCode) {
    logData.statusCode = formattedError.statusCode;
  }

  if (context) {
    if (context.operation) logData.operation = context.operation;
    if (context.requestId) logData.requestId = context.requestId;
    if (context.userId) logData.userId = context.userId;
    if (context.component) logData.component = context.component;
    if (context.input) logData.input = sanitizeLogData(context.input);
    if (context.metadata) logData.metadata = sanitizeLogData(context.metadata);
  }

  logger.error(`Error: ${formattedError.message}`, logData);
}

/**
 * Log an error with additional context and return the formatted error
 *
 * @param message - Custom error message
 * @param error - The error to log
 * @param context - Additional context
 * @returns Formatted error object
 */
export function logErrorWithContext(
  message: string,
  error: unknown,
  context?: ErrorContext
): FormattedError {
  const formattedError = formatError(error);

  const logData: Record<string, unknown> = {
    customMessage: message,
    error: formattedError,
    errorType: formattedError.name
  };

  if (formattedError.stack) {
    logData.stackTrace = formattedError.stack;
  }

  if (context) {
    Object.assign(logData, sanitizeLogData(context as Record<string, unknown>));
  }

  logger.error(message, logData);

  return formattedError;
}

/**
 * Create an error logger for a specific component
 *
 * @param component - Component name
 * @returns Object with error logging methods
 *
 * @example
 * ```typescript
 * const errorLog = createErrorLogger('workspace-service');
 *
 * errorLog.log(error, { operation: 'create' });
 * errorLog.warn('Retrying operation', error, { attempt: 2 });
 * ```
 */
export function createErrorLogger(component: string) {
  return {
    /**
     * Log an error at ERROR level
     */
    log(error: unknown, context?: Omit<ErrorContext, 'component'>): void {
      logError(error, { ...context, component });
    },

    /**
     * Log an error at WARN level (for non-critical errors)
     */
    warn(
      message: string,
      error: unknown,
      context?: Omit<ErrorContext, 'component'>
    ): void {
      const formattedError = formatError(error);

      logger.warn(message, {
        component,
        error: formattedError,
        errorType: formattedError.name,
        errorMessage: formattedError.message,
        ...sanitizeLogData((context || {}) as Record<string, unknown>)
      });
    },

    /**
     * Log an error with a custom message
     */
    withMessage(
      message: string,
      error: unknown,
      context?: Omit<ErrorContext, 'component'>
    ): FormattedError {
      return logErrorWithContext(message, error, { ...context, component });
    }
  };
}
