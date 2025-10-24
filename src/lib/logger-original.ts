/**
 * Structured Logger with Winston
 *
 * Production-ready logger that:
 * - Eliminates console.log data leakage in production
 * - Provides structured JSON logging
 * - Supports log levels (error, warn, info, debug)
 * - Includes metadata for monitoring/debugging
 */

const isEdgeRuntime = typeof (globalThis as any).EdgeRuntime !== 'undefined';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

type LogMethod = (message: unknown, metadata?: Record<string, unknown>) => void;

interface StructuredLogger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
}

let baseLogger: StructuredLogger;
let consoleImpl: (metadata: Record<string, unknown>) => StructuredLogger;

if (!isEdgeRuntime) {
  const winstonModule = await import('winston');
  const winston = winstonModule.default;

  const winstonLogger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'vibecode-webgui' },
    transports: [
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

  if (isProduction) {
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
  }

  baseLogger = {
    error: (message, metadata) => winstonLogger.error(message, metadata || {}),
    warn: (message, metadata) => winstonLogger.warn(message, metadata || {}),
    info: (message, metadata) => winstonLogger.info(message, metadata || {}),
    debug: (message, metadata) => winstonLogger.debug(message, metadata || {}),
  };

  consoleImpl = (metadata: Record<string, unknown>) => ({
    error: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      winstonLogger.error(message, { ...metadata, ...additionalMeta });
    },
    warn: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      winstonLogger.warn(message, { ...metadata, ...additionalMeta });
    },
    info: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      winstonLogger.info(message, { ...metadata, ...additionalMeta });
    },
    debug: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      winstonLogger.debug(message, { ...metadata, ...additionalMeta });
    },
  });
} else {
  const edgeLog: (level: 'error' | 'warn' | 'info' | 'debug', message: unknown, metadata?: Record<string, unknown>) => void = (
    level,
    message,
    metadata
  ) => {
    const payload = metadata && Object.keys(metadata).length > 0 ? { metadata } : undefined;
    const logArgs = [message, payload].filter(Boolean);
    (console[level] ?? console.log).apply(console, logArgs as [unknown, ...unknown[]]);
  };

  baseLogger = {
    error: (message, metadata) => edgeLog('error', message, metadata),
    warn: (message, metadata) => edgeLog('warn', message, metadata),
    info: (message, metadata) => edgeLog('info', message, metadata),
    debug: (message, metadata) => edgeLog('debug', message, metadata),
  };

  consoleImpl = (metadata: Record<string, unknown>) => ({
    error: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      edgeLog('error', message, { ...metadata, ...additionalMeta });
    },
    warn: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      edgeLog('warn', message, { ...metadata, ...additionalMeta });
    },
    info: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      edgeLog('info', message, { ...metadata, ...additionalMeta });
    },
    debug: (message: unknown, additionalMeta?: Record<string, unknown>) => {
      edgeLog('debug', message, { ...metadata, ...additionalMeta });
    },
  });
}

export const logger: StructuredLogger = baseLogger;

export function console(metadata: Record<string, unknown>) {
  return consoleImpl(metadata);
}
