/**
 * Log Formatting Utilities
 *
 * Provides consistent formatting and sanitization for log data.
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Log level numeric values for comparison
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40
};

/**
 * Standard log metadata interface
 */
export interface LogMetadata {
  service?: string;
  component?: string;
  operation?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  timestamp?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Sensitive field patterns to redact
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i,
  /session[_-]?id/i,
  /cookie/i
];

/**
 * Maximum string length for log values
 */
const MAX_STRING_LENGTH = 1000;

/**
 * Maximum depth for nested object logging
 */
const MAX_DEPTH = 5;

/**
 * Format a log message with consistent structure
 */
export function formatLogMessage(
  level: LogLevel,
  message: string,
  metadata?: LogMetadata
): Record<string, unknown> {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeLogData(metadata || {})
  };
}

/**
 * Sanitize log data by redacting sensitive fields and truncating long values
 */
export function sanitizeLogData(
  data: Record<string, unknown>,
  depth = 0
): Record<string, unknown> {
  if (depth > MAX_DEPTH) {
    return { _truncated: 'Max depth exceeded' };
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Check if key matches sensitive patterns
    if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    sanitized[key] = sanitizeValue(value, depth);
  }

  return sanitized;
}

/**
 * Sanitize a single value
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > MAX_STRING_LENGTH) {
      return `${value.substring(0, MAX_STRING_LENGTH)}... [truncated, total length: ${value.length}]`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    if (value.length > 100) {
      return {
        _type: 'array',
        _length: value.length,
        _preview: value.slice(0, 10).map(v => sanitizeValue(v, depth + 1)),
        _truncated: true
      };
    }
    return value.map(v => sanitizeValue(v, depth + 1));
  }

  if (typeof value === 'object') {
    return sanitizeLogData(value as Record<string, unknown>, depth + 1);
  }

  // For functions and other types, return type name
  return `[${typeof value}]`;
}

/**
 * Create a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extract trace context from headers
 */
export function extractTraceContext(headers: Headers): {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
} {
  return {
    traceId:
      headers.get('x-trace-id') ||
      headers.get('x-datadog-trace-id') ||
      headers.get('traceparent')?.split('-')[1],
    spanId:
      headers.get('x-span-id') ||
      headers.get('x-datadog-span-id') ||
      headers.get('traceparent')?.split('-')[2],
    parentSpanId: headers.get('x-datadog-parent-id') || undefined
  };
}

/**
 * Format bytes for human-readable output
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}us`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}
