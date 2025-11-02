export interface Logger {
  info(message: unknown, metadata?: Record<string, unknown>): void;
  error(message: unknown, metadata?: Record<string, unknown>): void;
  warn(message: unknown, metadata?: Record<string, unknown>): void;
  debug(message: unknown, metadata?: Record<string, unknown>): void;
}

export const logger: Logger;
