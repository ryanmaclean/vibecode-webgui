/**
 * Structured Logger with Winston
 *
 * Production-ready logger that:
 * - Eliminates console.log data leakage in production
 * - Provides structured JSON logging
 * - Supports log levels (error, warn, info, debug)
 * - Includes metadata for monitoring/debugging
 */

import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Winston logger configuration
const winstonLogger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'vibecode-webgui' },
  transports: [
    // Write all logs to console in structured JSON format
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

// If we're in production, don't allow console.log
if (isProduction) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

export const logger = {
  error: (message: any, metadata?: Record<string, unknown>) => {
    winstonLogger.error(message, metadata || {});
  },
  warn: (message: any, metadata?: Record<string, unknown>) => {
    winstonLogger.warn(message, metadata || {});
  },
  info: (message: any, metadata?: Record<string, unknown>) => {
    winstonLogger.info(message, metadata || {});
  },
  debug: (message: any, metadata?: Record<string, unknown>) => {
    winstonLogger.debug(message, metadata || {});
  },
};
