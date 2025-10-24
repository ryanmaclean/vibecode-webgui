/**
 * Runtime-aware logger.
 *
 * Uses Winston when running in the Node.js runtime (server/Edge-disabled routes),
 * and falls back to a lightweight console-based shim when executing in Edge
 * environments where Node primitives are unavailable.
 */

const isEdgeRuntime = typeof (globalThis as any).EdgeRuntime !== 'undefined';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  service?: string;
  component?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  operation?: string;
  [key: string]: unknown;
}

type LogMethod = (message: unknown, metadata?: LogContext) => void;

interface StructuredLogger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  
  // Convenience methods for common use cases
  http: (method: string, url: string, status: number, duration?: number, metadata?: LogContext) => void;
  security: (event: string, metadata?: LogContext) => void;
  performance: (operation: string, duration: number, metadata?: LogContext) => void;
  api: (endpoint: string, method: string, status: number, metadata?: LogContext) => void;
}

let baseLogger: StructuredLogger;
let createChildLoggerImpl: (metadata: Record<string, unknown>) => StructuredLogger;

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

  const createLoggerMethods = (winston: any) => ({
    error: (message: unknown, metadata?: LogContext) => winston.error(message, metadata || {}),
    warn: (message: unknown, metadata?: LogContext) => winston.warn(message, metadata || {}),
    info: (message: unknown, metadata?: LogContext) => winston.info(message, metadata || {}),
    debug: (message: unknown, metadata?: LogContext) => winston.debug(message, metadata || {}),
    
    http: (method: string, url: string, status: number, duration?: number, metadata?: LogContext) => {
      const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      winston[logLevel]('HTTP Request', {
        http: { method, url, status, duration },
        ...metadata
      });
    },
    
    security: (event: string, metadata?: LogContext) => {
      winston.warn('Security Event', {
        security: { event },
        ...metadata
      });
    },
    
    performance: (operation: string, duration: number, metadata?: LogContext) => {
      const logLevel = duration > 5000 ? 'warn' : 'info';
      winston[logLevel]('Performance Metric', {
        performance: { operation, duration, unit: 'ms' },
        ...metadata
      });
    },
    
    api: (endpoint: string, method: string, status: number, metadata?: LogContext) => {
      const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      winston[logLevel]('API Call', {
        api: { endpoint, method, status },
        ...metadata
      });
    }
  });

  baseLogger = createLoggerMethods(winstonLogger);

  createChildLoggerImpl = (metadata: Record<string, unknown>) => {
    const childWinston = {
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
    };
    
    return createLoggerMethods(childWinston);
  };
} else {
  const edgeLog = (
    level: 'error' | 'warn' | 'info' | 'debug',
    message: unknown,
    metadata?: Record<string, unknown>
  ) => {
    const payload = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
    (console[level] ?? console.log).call(console, message, payload);
  };

  const createEdgeLoggerMethods = (logFn: typeof edgeLog) => ({
    error: (message: unknown, metadata?: LogContext) => logFn('error', message, metadata),
    warn: (message: unknown, metadata?: LogContext) => logFn('warn', message, metadata),
    info: (message: unknown, metadata?: LogContext) => logFn('info', message, metadata),
    debug: (message: unknown, metadata?: LogContext) => logFn('debug', message, metadata),
    
    http: (method: string, url: string, status: number, duration?: number, metadata?: LogContext) => {
      const logLevel: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logFn(logLevel, 'HTTP Request', {
        http: { method, url, status, duration },
        ...metadata
      });
    },
    
    security: (event: string, metadata?: LogContext) => {
      logFn('warn', 'Security Event', {
        security: { event },
        ...metadata
      });
    },
    
    performance: (operation: string, duration: number, metadata?: LogContext) => {
      const logLevel: LogLevel = duration > 5000 ? 'warn' : 'info';
      logFn(logLevel, 'Performance Metric', {
        performance: { operation, duration, unit: 'ms' },
        ...metadata
      });
    },
    
    api: (endpoint: string, method: string, status: number, metadata?: LogContext) => {
      const logLevel: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logFn(logLevel, 'API Call', {
        api: { endpoint, method, status },
        ...metadata
      });
    }
  });

  baseLogger = createEdgeLoggerMethods(edgeLog);

  createChildLoggerImpl = (metadata: Record<string, unknown>) => {
    const childEdgeLog = (level: LogLevel, message: unknown, additional?: Record<string, unknown>) => {
      edgeLog(level, message, { ...metadata, ...additional });
    };
    
    return createEdgeLoggerMethods(childEdgeLog);
  };
}

export const logger: StructuredLogger = baseLogger;

export function createChildLogger(metadata: Record<string, unknown>): StructuredLogger {
  return createChildLoggerImpl(metadata);
}
