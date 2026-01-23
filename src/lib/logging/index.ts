/**
 * Structured Logging Utilities for VibeCode WebGUI
 *
 * This module provides consistent, structured logging across the application.
 * It builds on top of the Pino logger and provides specialized utilities for:
 * - Request/response logging
 * - Error logging with stack traces
 * - Performance timing
 * - Service-specific loggers
 *
 * Usage:
 *   import { apiLogger, createServiceLogger, logError, logPerformance } from '@/lib/logging';
 */

export { apiLogger, createApiLogger } from './api-logger';
export {
  logError,
  logErrorWithContext,
  createErrorLogger,
  formatError,
  type ErrorContext
} from './error-logger';
export {
  createPerformanceTimer,
  logPerformanceMetric,
  withTiming,
  type PerformanceTimer,
  type TimingResult
} from './performance-logger';
export {
  createServiceLogger,
  type ServiceLogger,
  type LogContext
} from './service-logger';
export {
  LogLevel,
  LOG_LEVELS,
  formatLogMessage,
  sanitizeLogData,
  type LogMetadata
} from './format';
