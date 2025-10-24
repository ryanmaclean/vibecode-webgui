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
  
  return {
    level: process.env.LOG_LEVEL || process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    prettyPrint: process.env.NODE_ENV !== 'production',
    datadogEnabled: isServer && !!process.env.DD_API_KEY,
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
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
};

// Transport configuration
const transports: pino.TransportMultiOptions['targets'] = [];

// Pretty print for development
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

// Datadog transport for production
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
  };
}

export function createChildLogger(contextMetadata: Record<string, unknown>) {
  return createLogger(contextMetadata);
}

// Direct access to Pino instance for advanced usage
export const pinoInstance = pinoLogger;

// Type exports for consumers
export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof createLogger>;
