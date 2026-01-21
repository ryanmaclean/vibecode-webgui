/**
 * Lazy Logger Implementation
 * Avoids circular dependency issues by deferring logger initialization
 */

type LogMethod = (message: unknown, metadata?: Record<string, unknown>) => void;

interface StructuredLogger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
}

// Lazy logger instance
let loggerInstance: StructuredLogger | null = null;

function getLogger(): StructuredLogger {
  if (!loggerInstance) {
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
    
    // Simple console-based logger to avoid Winston circular dependencies
    // Use globalThis.console to avoid shadowing by the exported 'console' function
    loggerInstance = {
      error: (message: unknown, metadata?: Record<string, unknown>) => {
        if (logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error') {
          globalThis.console.error(`[ERROR] ${message}`, metadata ? JSON.stringify(metadata) : '');
        }
      },
      warn: (message: unknown, metadata?: Record<string, unknown>) => {
        if (logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn') {
          globalThis.console.warn(`[WARN] ${message}`, metadata ? JSON.stringify(metadata) : '');
        }
      },
      info: (message: unknown, metadata?: Record<string, unknown>) => {
        if (logLevel === 'debug' || logLevel === 'info') {
          globalThis.console.info(`[INFO] ${message}`, metadata ? JSON.stringify(metadata) : '');
        }
      },
      debug: (message: unknown, metadata?: Record<string, unknown>) => {
        if (logLevel === 'debug') {
          globalThis.console.debug(`[DEBUG] ${message}`, metadata ? JSON.stringify(metadata) : '');
        }
      }
    };
  }
  return loggerInstance;
}

// Export lazy logger
export const logger = {
  error: (message: unknown, metadata?: Record<string, unknown>) => getLogger().error(message, metadata),
  warn: (message: unknown, metadata?: Record<string, unknown>) => getLogger().warn(message, metadata),
  info: (message: unknown, metadata?: Record<string, unknown>) => getLogger().info(message, metadata),
  debug: (message: unknown, metadata?: Record<string, unknown>) => getLogger().debug(message, metadata),
};

// Create child logger function
export function console(options: { module?: string; scope?: string }): StructuredLogger {
  const { module = 'unknown', scope = 'unknown' } = options;
  
  return {
    error: (message: unknown, metadata?: Record<string, unknown>) => {
      getLogger().error(`[${module}:${scope}] ${message}`, metadata);
    },
    warn: (message: unknown, metadata?: Record<string, unknown>) => {
      getLogger().warn(`[${module}:${scope}] ${message}`, metadata);
    },
    info: (message: unknown, metadata?: Record<string, unknown>) => {
      getLogger().info(`[${module}:${scope}] ${message}`, metadata);
    },
    debug: (message: unknown, metadata?: Record<string, unknown>) => {
      getLogger().debug(`[${module}:${scope}] ${message}`, metadata);
    }
  };
}
