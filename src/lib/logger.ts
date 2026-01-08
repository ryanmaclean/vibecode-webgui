/**
 * Production-ready Pino logger with zero circular dependencies
 * 
 * Architecture:
 * 1. Config (no imports from app code)
 * 2. Implementation (only imports config + pino)
 * 3. Export (provides clean interface)
 * 
 * Features:
 * - Environment-based log levels
 * - Datadog integration
 * - Structured logging
 * - TypeScript types
 * - Server/client compatible
 */

import pino from 'pino';

// ============================================================================
// Configuration (no circular dependencies possible)
// ============================================================================

interface LoggerConfig {
  level: string;
  prettyPrint: boolean;
  datadogEnabled: boolean;
  datadogApiKey?: string;
  datadogSite?: string;
  serviceName: string;
  environment: string;
}

function getLoggerConfig(): LoggerConfig {
  const isServer = typeof window === 'undefined';

  // Detect if we're in a build phase (not runtime)
  // During build, Next.js sets NEXT_PHASE or we can detect by checking if we're generating static pages
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                      process.env.npm_lifecycle_event === 'build' ||
                      process.env.BUILDING === 'true';

  return {
    level: process.env.LOG_LEVEL || process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    prettyPrint: process.env.NODE_ENV !== 'production' && !isBuildTime,
    datadogEnabled: isServer && !!process.env.DD_API_KEY && !isBuildTime,
    datadogApiKey: process.env.DD_API_KEY,
    datadogSite: process.env.DD_SITE || 'datadoghq.com',
    serviceName: process.env.DD_SERVICE || 'vibecode-webgui',
    environment: process.env.NODE_ENV || 'development',
  };
}

// ============================================================================
// Logger Implementation
// ============================================================================

const config = getLoggerConfig();

// Base Pino options
const pinoOptions: pino.LoggerOptions = {
  level: config.level,
  base: {
    service: config.serviceName,
    env: config.environment,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Custom formatters removed - they conflict with transport targets
  // (pino-datadog does not allow custom level formatters)
};

// Transport configuration
// NOTE: Transports use worker threads which cause "write after end" errors
// during Next.js build static generation phase. We disable them during build.
const transports: Array<pino.TransportTargetOptions> = [];

// Pretty print for development (disabled during build)
if (config.prettyPrint) {
  transports.push({
    target: 'pino-pretty',
    level: config.level,
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  });
}

// Datadog transport for production (disabled during build)
if (config.datadogEnabled && config.datadogApiKey) {
  transports.push({
    target: 'pino-datadog',
    level: 'info',
    options: {
      apiKey: config.datadogApiKey,
      ddsource: 'nodejs',
      service: config.serviceName,
      ddtags: `env:${config.environment}`,
      site: config.datadogSite,
    },
  });
}

// Create logger instance
const pinoLogger = transports.length > 0
  ? pino({
      ...pinoOptions,
      transport: {
        targets: transports,
      },
    })
  : pino(pinoOptions);

// ============================================================================
// Public API (compatible with existing logger interface)
// ============================================================================

export const logger = {
  error: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.error(metadata || {}, message);
    } else {
      pinoLogger.error(message);
    }
  },

  warn: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.warn(metadata || {}, message);
    } else {
      pinoLogger.warn(message);
    }
  },

  info: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  http: (message: unknown, metadata?: Record<string, unknown>) => {
    // Pino doesn't have http level, map to info
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  debug: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.debug(metadata || {}, message);
    } else {
      pinoLogger.debug(message);
    }
  },

  log: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  child: (metadata: Record<string, unknown>) => {
    return createChildLogger(metadata);
  },
};

// Child logger factory
export function createLogger(contextMetadata: Record<string, unknown>) {
  const childLogger = pinoLogger.child(contextMetadata);

  return {
    error: (message: unknown, metadata?: Record<string, unknown>) => {
      if (typeof message === 'string') {
        childLogger.error(metadata || {}, message);
      } else {
        childLogger.error(message);
      }
    },

    warn: (message: unknown, metadata?: Record<string, unknown>) => {
      if (typeof message === 'string') {
        childLogger.warn(metadata || {}, message);
      } else {
        childLogger.warn(message);
      }
    },

    info: (message: unknown, metadata?: Record<string, unknown>) => {
      if (typeof message === 'string') {
        childLogger.info(metadata || {}, message);
      } else {
        childLogger.info(message);
      }
    },

    http: (message: unknown, metadata?: Record<string, unknown>) => {
      // Pino doesn't have http level, map to info
      if (typeof message === 'string') {
        childLogger.info(metadata || {}, message);
      } else {
        childLogger.info(message);
      }
    },

    debug: (message: unknown, metadata?: Record<string, unknown>) => {
      if (typeof message === 'string') {
        childLogger.debug(metadata || {}, message);
      } else {
        childLogger.debug(message);
      }
    },

    log: (message: unknown, metadata?: Record<string, unknown>) => {
      if (typeof message === 'string') {
        childLogger.info(metadata || {}, message);
      } else {
        childLogger.info(message);
      }
    },

    child: (metadata: Record<string, unknown>) => {
      return createLogger({ ...contextMetadata, ...metadata });
    },
  };
}

export function createChildLogger(contextMetadata: Record<string, unknown>) {
  return createLogger(contextMetadata);
}

// Direct access to Pino instance for advanced usage
export const pinoInstance = pinoLogger;

// ============================================================================
// Helper Functions (for compatibility with existing codebase)
// ============================================================================

/**
 * Log performance metrics with duration
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  logger.info('Performance metric', {
    operation,
    durationMs,
    ...metadata,
  });
}

/**
 * Log API requests with method, URL, status, and timing
 */
export function logApiRequest(
  method: string,
  url: string,
  statusCode: number,
  responseTimeMs: number,
  metadata?: Record<string, unknown>
): void {
  // Use http level if available, otherwise info
  const logData = {
    method,
    url,
    statusCode,
    responseTimeMs,
    ...metadata,
  };

  if ('http' in logger) {
    (logger as any).http('API Request', logData);
  } else {
    logger.info('API Request', logData);
  }
}

/**
 * Log database operations with duration
 */
export function logDatabaseOperation(
  operation: string,
  table: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  logger.debug('Database operation', {
    operation,
    table,
    durationMs,
    ...metadata,
  });
}

// Type exports for consumers
export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof createLogger>;
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';
