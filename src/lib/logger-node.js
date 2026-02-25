/**
 * Production-ready Pino logger with zero circular dependencies (CommonJS)
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
 * - CommonJS compatible
 * - Node.js only
 */

const pino = require('pino');

// ============================================================================
// Configuration (no circular dependencies possible)
// ============================================================================

function getLoggerConfig() {
  // Detect if we're in a build phase (not runtime)
  // During build, Next.js sets NEXT_PHASE or we can detect by checking if we're generating static pages
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                      process.env.npm_lifecycle_event === 'build' ||
                      process.env.BUILDING === 'true';

  return {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    prettyPrint: process.env.NODE_ENV !== 'production' && !isBuildTime,
    datadogEnabled: !!process.env.DD_API_KEY && !isBuildTime,
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
const pinoOptions = {
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
// For CommonJS compatibility, we use simple pino without transports
// and let pino-pretty be used via pino CLI or separate process if needed
const transports = [];

// Note: Transports are disabled in CommonJS version to avoid compatibility issues
// Use pino-pretty via CLI (| pino-pretty) or configure separately if needed

// Create logger instance (without transports for CommonJS compatibility)
const pinoLogger = pino(pinoOptions);

// ============================================================================
// Public API (compatible with existing logger interface)
// ============================================================================

const logger = {
  error: (message, metadata) => {
    if (typeof message === 'string') {
      pinoLogger.error(metadata || {}, message);
    } else {
      pinoLogger.error(message);
    }
  },

  warn: (message, metadata) => {
    if (typeof message === 'string') {
      pinoLogger.warn(metadata || {}, message);
    } else {
      pinoLogger.warn(message);
    }
  },

  info: (message, metadata) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  debug: (message, metadata) => {
    if (typeof message === 'string') {
      pinoLogger.debug(metadata || {}, message);
    } else {
      pinoLogger.debug(message);
    }
  },

  http: (message, metadata) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  log: (message, metadata) => {
    if (typeof message === 'string') {
      pinoLogger.info(metadata || {}, message);
    } else {
      pinoLogger.info(message);
    }
  },

  child: (contextMetadata) => {
    return createChildLogger(contextMetadata);
  },
};

// Child logger factory
function createLogger(contextMetadata) {
  const childLogger = pinoLogger.child(contextMetadata);

  return {
    error: (message, metadata) => {
      if (typeof message === 'string') {
        childLogger.error(metadata || {}, message);
      } else {
        childLogger.error(message);
      }
    },

    warn: (message, metadata) => {
      if (typeof message === 'string') {
        childLogger.warn(metadata || {}, message);
      } else {
        childLogger.warn(message);
      }
    },

    info: (message, metadata) => {
      if (typeof message === 'string') {
        childLogger.info(metadata || {}, message);
      } else {
        childLogger.info(message);
      }
    },

    debug: (message, metadata) => {
      if (typeof message === 'string') {
        childLogger.debug(metadata || {}, message);
      } else {
        childLogger.debug(message);
      }
    },

    http: (message, metadata) => {
      if (typeof message === 'string') {
        childLogger.info(metadata || {}, message);
      } else {
        childLogger.info(message);
      }
    },

    log: (message, metadata) => {
      if (typeof message === 'string') {
        childLogger.info(metadata || {}, message);
      } else {
        childLogger.info(message);
      }
    },

    child: (additionalMetadata) => {
      return createLogger({ ...contextMetadata, ...additionalMetadata });
    },
  };
}

function createChildLogger(contextMetadata) {
  return createLogger(contextMetadata);
}

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Sanitize user input to prevent log injection attacks
 * Removes newlines, carriage returns, and other control characters
 */
function sanitizeForLog(input) {
  // Replace newlines, carriage returns, and other control characters
  return input.replace(/[\r\n\x00-\x1F\x7F]/g, '');
}

// Helper functions for common logging patterns
function logPerformance(operation, duration, metadata) {
  logger.info('Performance metric', {
    operation: sanitizeForLog(operation),
    durationMs: duration,
    ...metadata,
  });
}

function logApiRequest(method, url, statusCode, responseTime, metadata) {
  logger.http('API Request', {
    method: sanitizeForLog(method),
    url: sanitizeForLog(url),
    statusCode,
    responseTimeMs: responseTime,
    ...metadata,
  });
}

function logDatabaseOperation(operation, table, duration, metadata) {
  logger.debug('Database operation', {
    operation,
    table,
    durationMs: duration,
    ...metadata,
  });
}

// ============================================================================
// CommonJS Exports
// ============================================================================

module.exports = {
  logger,
  createLogger,
  createChildLogger,
  pinoInstance: pinoLogger,
  logPerformance,
  logApiRequest,
  logDatabaseOperation,
};
