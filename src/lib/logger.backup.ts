/**
 * Simple console-based logger without circular dependencies.
 * No Winston, no top-level await, just console wrappers.
 */

type LogMethod = (message: unknown, metadata?: Record<string, unknown>) => void;

interface StructuredLogger {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
}

function formatLog(level: string, message: unknown, metadata?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaStr = metadata && Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  const formattedMessage = `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'info':
      console.info(formattedMessage);
      break;
    case 'debug':
      console.debug(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

const baseLogger: StructuredLogger = {
  error: (message, metadata) => formatLog('error', message, metadata),
  warn: (message, metadata) => formatLog('warn', message, metadata),
  info: (message, metadata) => formatLog('info', message, metadata),
  debug: (message, metadata) => formatLog('debug', message, metadata),
};

export const logger: StructuredLogger = baseLogger;

export function createLogger(metadata: Record<string, unknown>): StructuredLogger {
  return {
    error: (message: unknown, additional?: Record<string, unknown>) =>
      formatLog('error', message, { ...metadata, ...additional }),
    warn: (message: unknown, additional?: Record<string, unknown>) =>
      formatLog('warn', message, { ...metadata, ...additional }),
    info: (message: unknown, additional?: Record<string, unknown>) =>
      formatLog('info', message, { ...metadata, ...additional }),
    debug: (message: unknown, additional?: Record<string, unknown>) =>
      formatLog('debug', message, { ...metadata, ...additional }),
  };
}

export function createChildLogger(metadata: Record<string, unknown>): StructuredLogger {
  return createLogger(metadata);
}
