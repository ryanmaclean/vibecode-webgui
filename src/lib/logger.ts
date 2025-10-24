/**
 * Runtime-aware structured console.
 * Uses Winston when running in a Node.js runtime, and a lightweight console-only shim
 * when executing in Edge environments where Node primitives are unavailable.
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
  const { default: winston } = await import('winston');

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
    error: (message: unknown, additional?: Record<string, unknown>) => {
      winstonLogger.error(message, { ...metadata, ...additional });
    },
    warn: (message: unknown, additional?: Record<string, unknown>) => {
      winstonLogger.warn(message, { ...metadata, ...additional });
    },
    info: (message: unknown, additional?: Record<string, unknown>) => {
      winstonLogger.info(message, { ...metadata, ...additional });
    },
    debug: (message: unknown, additional?: Record<string, unknown>) => {
      winstonLogger.debug(message, { ...metadata, ...additional });
    },
  });
} else {
  const edgeLog = (
    level: 'error' | 'warn' | 'info' | 'debug',
    message: unknown,
    metadata?: Record<string, unknown>
  ) => {
    const payload = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
    (console[level] ?? console.log).call(console, message, payload);
  };

  baseLogger = {
    error: (message, metadata) => edgeLog('error', message, metadata),
    warn: (message, metadata) => edgeLog('warn', message, metadata),
    info: (message, metadata) => edgeLog('info', message, metadata),
    debug: (message, metadata) => edgeLog('debug', message, metadata),
  };

  consoleImpl = (metadata: Record<string, unknown>) => ({
    error: (message: unknown, additional?: Record<string, unknown>) => {
      edgeLog('error', message, { ...metadata, ...additional });
    },
    warn: (message: unknown, additional?: Record<string, unknown>) => {
      edgeLog('warn', message, { ...metadata, ...additional });
    },
    info: (message: unknown, additional?: Record<string, unknown>) => {
      edgeLog('info', message, { ...metadata, ...additional });
    },
    debug: (message: unknown, additional?: Record<string, unknown>) => {
      edgeLog('debug', message, { ...metadata, ...additional });
    },
  });
}

export const logger: StructuredLogger = baseLogger;

export function createLogger(metadata: Record<string, unknown>): StructuredLogger {
  return consoleImpl(metadata);
}

export function createChildLogger(metadata: Record<string, unknown>): StructuredLogger {
  return consoleImpl(metadata);
}
