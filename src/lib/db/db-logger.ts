// Database logging utility
// Provides structured logging for database operations

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

// Create a default logger
const defaultLogger: Logger = {
  debug: (...args: any[]) => logger.debug('[DB]', ...args),
  info: (...args: any[]) => logger.info('[DB]', ...args),
  warn: (...args: any[]) => logger.warn('[DB]', ...args),
  error: (...args: any[]) => logger.error('[DB]', ...args),
};

// Use default logger
let logger: Logger = defaultLogger;

// Set up optional external logger integration
function setupExternalLogger() {
  // Try to dynamically import at runtime - we can't statically check this
  // so we need to use dynamic imports and runtime type checking
  import('@/lib/logger')
    .then((loggerModule: any) => {
      if (typeof loggerModule.createLogger === 'function') {
        const externalLogger = loggerModule.createLogger('database');
        if (
          typeof externalLogger.debug === 'function' && 
          typeof externalLogger.info === 'function' && 
          typeof externalLogger.warn === 'function' && 
          typeof externalLogger.error === 'function'
        ) {
          logger = externalLogger;
        }
      } else if (
        typeof loggerModule.debug === 'function' && 
        typeof loggerModule.info === 'function' && 
        typeof loggerModule.warn === 'function' && 
        typeof loggerModule.error === 'function'
      ) {
        logger = loggerModule;
      }
    })
    .catch((err) => {
      logger.warn('[DB] Could not load external logger:', err.message);
    });
}

// Try to set up external logger in non-critical way
setTimeout(setupExternalLogger, 0);

// Log levels
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

// Database operation types
export enum DbOperationType {
  QUERY = 'query',
  EXECUTE = 'execute',
  TRANSACTION = 'transaction',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  POOL = 'pool',
  MODEL = 'model',
}

// Database logging options
export interface DbLoggingOptions {
  level?: LogLevel;
  logQueries?: boolean;
  logParams?: boolean;
  logResults?: boolean;
  logConnections?: boolean;
  slowQueryThreshold?: number; // in ms
  errorLogLevel?: LogLevel;
  warningLogLevel?: LogLevel;
  infoLogLevel?: LogLevel;
  debugLogLevel?: LogLevel;
}

// Default logging options
const defaultOptions: DbLoggingOptions = {
  level: LogLevel.INFO,
  logQueries: process.env.NODE_ENV !== 'production',
  logParams: process.env.NODE_ENV !== 'production',
  logResults: false, // Don't log results by default (too verbose)
  logConnections: true,
  slowQueryThreshold: 1000, // 1 second
  errorLogLevel: LogLevel.ERROR,
  warningLogLevel: LogLevel.WARN,
  infoLogLevel: LogLevel.INFO,
  debugLogLevel: LogLevel.DEBUG,
};

// Global options that can be set by the application
let globalOptions: DbLoggingOptions = { ...defaultOptions };

/**
 * Configure global database logging options
 */
export function configureDbLogging(options: Partial<DbLoggingOptions>) {
  globalOptions = { ...globalOptions, ...options };
  logger.info('Database logging configured', { options: globalOptions });
}

// Define Prisma event types
interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaLogEvent {
  timestamp: Date;
  message: string;
  target: string;
}

/**
 * Create a Prisma client with logging middleware
 */
export function createLoggingPrismaClient(options?: Partial<DbLoggingOptions>) {
  const loggingOptions = { ...globalOptions, ...options };
  
  const prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
  
  // Query logging
  if (loggingOptions.logQueries && loggingOptions.level! >= LogLevel.DEBUG) {
    prisma.$on('query', (e: PrismaQueryEvent) => {
      const durationMs = e.duration;
      
      // Determine log level based on query duration
      let logLevel = LogLevel.DEBUG;
      let logMethod = logger.debug;
      
      if (durationMs > loggingOptions.slowQueryThreshold!) {
        logLevel = LogLevel.WARN;
        logMethod = logger.warn;
      }
      
      // Only log if the level is enabled
      if (logLevel <= loggingOptions.level!) {
        const query = e.query;
        const params = loggingOptions.logParams ? e.params : '[hidden]';
        
        logMethod('Database query', {
          operation: DbOperationType.QUERY,
          query,
          params,
          duration: `${durationMs}ms`,
        });
      }
    });
  }
  
  // Error logging
  if (loggingOptions.level! >= LogLevel.ERROR) {
    prisma.$on('error', (e: PrismaLogEvent) => {
      logger.error('Database error', {
        operation: DbOperationType.QUERY,
        error: e.message,
        target: e.target,
      });
    });
  }
  
  // Info logging
  if (loggingOptions.level! >= LogLevel.INFO) {
    prisma.$on('info', (e: PrismaLogEvent) => {
      logger.info('Database info', {
        operation: DbOperationType.QUERY,
        message: e.message,
        target: e.target,
      });
    });
  }
  
  // Warning logging
  if (loggingOptions.level! >= LogLevel.WARN) {
    prisma.$on('warn', (e: PrismaLogEvent) => {
      logger.warn('Database warning', {
        operation: DbOperationType.QUERY,
        message: e.message,
        target: e.target,
      });
    });
  }
  
  return prisma;
}

/**
 * Log a database operation
 */
export function logDbOperation(
  type: DbOperationType,
  message: string,
  details?: Record<string, any>,
  level: LogLevel = LogLevel.INFO
) {
  if (level > globalOptions.level!) {
    return; // Skip logging if level is higher than configured
  }
  
  const logData = {
    operation: type,
    ...details,
  };
  
  switch (level) {
    case LogLevel.ERROR:
      logger.error(message, logData);
      break;
    case LogLevel.WARN:
      logger.warn(message, logData);
      break;
    case LogLevel.INFO:
      logger.info(message, logData);
      break;
    case LogLevel.DEBUG:
      logger.debug(message, logData);
      break;
  }
}

/**
 * Execute a database operation with logging
 */
export async function executeWithLogging<T>(
  type: DbOperationType,
  message: string,
  operation: () => Promise<T>,
  details?: Record<string, any>,
  level: LogLevel = LogLevel.INFO
): Promise<T> {
  const startTime = Date.now();
  
  try {
    // Log operation start if in debug mode
    if (globalOptions.level! >= LogLevel.DEBUG) {
      logDbOperation(type, `${message} - Started`, details, LogLevel.DEBUG);
    }
    
    // Execute the operation
    const result = await operation();
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Determine log level based on duration for queries
    let logLevel = level;
    if (
      type === DbOperationType.QUERY &&
      duration > globalOptions.slowQueryThreshold!
    ) {
      logLevel = LogLevel.WARN;
    }
    
    // Log operation completion
    logDbOperation(
      type,
      `${message} - Completed in ${duration}ms`,
      {
        ...details,
        duration: `${duration}ms`,
        result: globalOptions.logResults ? result : '[hidden]',
      },
      logLevel
    );
    
    return result;
  } catch (error) {
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Log operation error
    logDbOperation(
      type,
      `${message} - Failed after ${duration}ms`,
      {
        ...details,
        duration: `${duration}ms`,
        error: (error as Error).message,
        stack: (error as Error).stack,
      },
      LogLevel.ERROR
    );
    
    throw error;
  }
}

/**
 * Create a function wrapper that logs execution
 */
export function withDbLogging<T extends (...args: any[]) => Promise<any>>(
  type: DbOperationType,
  message: string,
  fn: T,
  details?: Record<string, any>,
  level: LogLevel = LogLevel.INFO
): T {
  return (async (...args: Parameters<T>) => {
    return executeWithLogging(
      type,
      message,
      () => fn(...args),
      {
        ...details,
        args: globalOptions.logParams ? args : '[hidden]',
      },
      level
    );
  }) as T;
}

/**
 * Log a database connection event
 */
export function logDbConnection(
  event: 'connect' | 'disconnect' | 'pool_add' | 'pool_remove',
  details?: Record<string, any>,
  level: LogLevel = LogLevel.INFO
) {
  if (!globalOptions.logConnections || level > globalOptions.level!) {
    return; // Skip logging if connections are not logged or level is higher than configured
  }
  
  logDbOperation(
    DbOperationType.CONNECT,
    `Database ${event}`,
    details,
    level
  );
}

/**
 * Log a database transaction
 */
export function logDbTransaction(
  event: 'begin' | 'commit' | 'rollback',
  details?: Record<string, any>,
  level: LogLevel = LogLevel.INFO
) {
  logDbOperation(
    DbOperationType.TRANSACTION,
    `Transaction ${event}`,
    details,
    level
  );
}

/**
 * Get current logging configuration
 */
export function getDbLoggingConfig(): DbLoggingOptions {
  return { ...globalOptions };
}

/**
 * Log a slow query warning
 */
export function logSlowQuery(
  query: string,
  duration: number,
  params?: any,
  threshold: number = globalOptions.slowQueryThreshold!
) {
  if (duration <= threshold) {
    return; // Not a slow query
  }
  
  logDbOperation(
    DbOperationType.QUERY,
    `Slow query detected (${duration}ms > ${threshold}ms)`,
    {
      query,
      params: globalOptions.logParams ? params : '[hidden]',
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
    },
    LogLevel.WARN
  );
}

/**
 * Enable logging for existing Prisma client
 */
export function enhancePrismaWithLogging(
  prisma: PrismaClient,
  options?: Partial<DbLoggingOptions>
): PrismaClient {
  const loggingOptions = { ...globalOptions, ...options };
  
  // Add event handlers if possible
  try {
    if (loggingOptions.logQueries && loggingOptions.level! >= LogLevel.DEBUG) {
      // @ts-expect-error - Adding event handlers to an existing client might not be supported
      prisma.$on('query', (e: PrismaQueryEvent) => {
        const durationMs = e.duration;
        
        // Determine log level based on query duration
        let logLevel = LogLevel.DEBUG;
        let logMethod = logger.debug;
        
        if (durationMs > loggingOptions.slowQueryThreshold!) {
          logLevel = LogLevel.WARN;
          logMethod = logger.warn;
        }
        
        // Only log if the level is enabled
        if (logLevel <= loggingOptions.level!) {
          const query = e.query;
          const params = loggingOptions.logParams ? e.params : '[hidden]';
          
          logMethod('Database query', {
            operation: DbOperationType.QUERY,
            query,
            params,
            duration: `${durationMs}ms`,
          });
        }
      });
    }
  } catch (error) {
    logger.warn('Could not add query logging to existing Prisma client', {
      error: (error as Error).message,
    });
  }
  
  return prisma;
}

export default {
  configureDbLogging,
  createLoggingPrismaClient,
  logDbOperation,
  executeWithLogging,
  withDbLogging,
  logDbConnection,
  logDbTransaction,
  getDbLoggingConfig,
  logSlowQuery,
  enhancePrismaWithLogging,
  LogLevel,
  DbOperationType,
};