import { logger } from '@/lib/logger';


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

export function createChildLogger(options: LoggerOptions): Logger {
  const prefix = `[${options.module}:${options.scope}]`

  return {
    error(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        logger.error(prefix, 'ERROR', message, metadata)
      } else {
        logger.error(prefix, 'ERROR', message)
      }
    },
    warn(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        logger.warn(prefix, 'WARN', message, metadata)
      } else {
        logger.warn(prefix, 'WARN', message)
      }
    },
    info(message: string, metadata?: Record<string, unknown>) {
      if (metadata) {
        logger.info(prefix, 'INFO', message, metadata)
      } else {
        logger.info(prefix, 'INFO', message)
      }
    },
    debug(message: string, metadata?: Record<string, unknown>) {
      if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGGING === 'true') {
        if (metadata) {
          logger.debug(prefix, 'DEBUG', message, metadata)
        } else {
          logger.debug(prefix, 'DEBUG', message)
        }
      }
    },
  }
}
