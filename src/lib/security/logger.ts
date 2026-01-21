// import { logger } from '@/lib/logger';


/**
 * Security-focused logger for Keychain operations
 */

export interface LoggerOptions {
  module?: string
  scope?: string
}

export interface Logger {
  error(message: string, metadata?: Record<string, unknown>): void
  warn(message: string, metadata?: Record<string, unknown>): void
  info(message: string, metadata?: Record<string, unknown>): void
  debug(message: string, metadata?: Record<string, unknown>): void
}

// Store reference to global console to avoid shadowing
const globalConsole = globalThis.console;

export function createLogger(options: LoggerOptions): Logger {
  const prefix = `[${options.module}:${options.scope}]`

  return {
    error(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        globalConsole.error(prefix, 'ERROR', message, metadata)
      } else {
        globalConsole.error(prefix, 'ERROR', message)
      }
    },
    warn(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        globalConsole.warn(prefix, 'WARN', message, metadata)
      } else {
        globalConsole.warn(prefix, 'WARN', message)
      }
    },
    info(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        globalConsole.info(prefix, 'INFO', message, metadata)
      } else {
        globalConsole.info(prefix, 'INFO', message)
      }
    },
    debug(message: string, metadata?: Record<string, unknown>) {
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGGING === 'true') {
        if (metadata) {
          globalConsole.debug(prefix, 'DEBUG', message, metadata)
        } else {
          globalConsole.debug(prefix, 'DEBUG', message)
        }
      }
    },
  }
}

// Export console as an alias for backward compatibility
export { createLogger as console };
