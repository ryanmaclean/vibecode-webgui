/**
 * AI Gateway Service Logger
 *
 * Production-ready Pino logger for AI Gateway service with:
 * - Environment-based log levels
 * - Datadog integration
 * - Structured logging
 * - Performance tracking for AI operations
 * - Request logging middleware compatibility
 *
 * Architecture follows the consolidated logging pattern:
 * 1. Config (environment-based setup)
 * 2. Implementation (Pino with transports)
 * 3. Export (clean API compatible with existing code)
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
  version: string;
}

function getLoggerConfig(): LoggerConfig {
  const environment = process.env.NODE_ENV || 'development';

  // Detect if we're in a build phase (not runtime)
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                      process.env.npm_lifecycle_event === 'build' ||
                      process.env.BUILDING === 'true';

  return {
    level: process.env.LOG_LEVEL || (environment === 'production' ? 'info' : 'debug'),
    prettyPrint: environment !== 'production' && !isBuildTime,
    datadogEnabled: !!process.env.DD_API_KEY && !isBuildTime,
    datadogApiKey: process.env.DD_API_KEY,
    datadogSite: process.env.DD_SITE || 'datadoghq.com',
    serviceName: 'ai-gateway',
    environment,
    version: '1.0.0',
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
    environment: config.environment,
    version: config.version,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Transport configuration
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
// Public API (compatible with existing Winston-based interface)
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

  debug: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.debug(metadata || {}, message);
    } else {
      pinoLogger.debug(message);
    }
  },

  http: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  log: (message: unknown, metadata?: Record<string, unknown>) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  child: (contextMetadata: Record<string, unknown>) => {
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

      debug: (message: unknown, metadata?: Record<string, unknown>) => {
        if (typeof message === 'string') {
          childLogger.debug(metadata || {}, message);
        } else {
          childLogger.debug(message);
        }
      },

      http: (message: unknown, metadata?: Record<string, unknown>) => {
        if (typeof message === 'string') {
          childLogger.info(metadata || {}, message);
        } else {
          childLogger.info(message);
        }
      },

      log: (message: unknown, metadata?: Record<string, unknown>) => {
        if (typeof message === 'string') {
          childLogger.info(metadata || {}, message);
        } else {
          childLogger.info(message);
        }
      },
    };
  },
};

// ============================================================================
// Request logger middleware compatible format
// ============================================================================

type LogMeta = Record<string, unknown> | undefined;

export const requestLogger = {
  info: (message: string, meta?: LogMeta) => logger.info(message, meta),
  warn: (message: string, meta?: LogMeta) => logger.warn(message, meta),
  error: (message: string, meta?: LogMeta) => logger.error(message, meta),
  debug: (message: string, meta?: LogMeta) => logger.debug(message, meta),
};

// ============================================================================
// Performance logger for AI operations
// ============================================================================

export const performanceLogger = {
  logRequest: (operation: string, startTime: number, meta?: LogMeta) => {
    const duration = Date.now() - startTime;
    logger.info('AI operation completed', {
      operation,
      duration: `${duration}ms`,
      durationMs: duration,
      ...meta,
    });
  },

  logError: (operation: string, startTime: number, error: unknown, meta?: LogMeta) => {
    const duration = Date.now() - startTime;
    const err = error as { message?: string; stack?: string };
    logger.error('AI operation failed', {
      operation,
      duration: `${duration}ms`,
      durationMs: duration,
      error: err?.message || String(error),
      stack: err?.stack,
      ...meta,
    });
  },
};

// ============================================================================
// Default export for backward compatibility
// ============================================================================

export default logger;
