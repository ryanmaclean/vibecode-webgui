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

export function createLogger(options: LoggerOptions): Logger {
  const prefix = `[${options.module}:${options.scope}]`

  return {
    error(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        console.error(prefix, 'ERROR', message, metadata)
      } else {
        console.error(prefix, 'ERROR', message)
      }
    },
    warn(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        console.warn(prefix, 'WARN', message, metadata)
      } else {
        console.warn(prefix, 'WARN', message)
      }
    },
    info(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        console.log(prefix, 'INFO', message, metadata)
      } else {
        console.log(prefix, 'INFO', message)
      }
    },
    debug(message: string, metadata?: Record<string, unknown>) {
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGGING === 'true') {
        if (metadata) {
          console.log(prefix, 'DEBUG', message, metadata)
        } else {
          console.log(prefix, 'DEBUG', message)
        }
      }
    },
  }
}
