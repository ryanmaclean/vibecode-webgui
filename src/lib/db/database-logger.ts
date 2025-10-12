// Database operation logging utilities
// Provides consistent logging for database operations with performance tracking

import { PrismaClient } from '@prisma/client';
import { 
  LogLevel, 
  LogCategory, 
  LogOptions,
  DbLogger, 
  DbOperationTimer, 
  LoggerOptions
} from './db-types';
import { logger } from '@/lib/logger';

/**
 * Class for logging database operations
 */
export class DatabaseLogger implements DbLogger {
  private currentLogLevel: LogLevel;
  private defaultCategory: LogCategory;
  private logToConsole: boolean;
  private logToFile: boolean;
  private logToMetrics: boolean;
  private logFilePath?: string;
  private serviceName: string;
  private environment: string;
  
  constructor(options: LoggerOptions = {}) {
    this.currentLogLevel = options.logLevel || 
      (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
    
    this.defaultCategory = options.defaultCategory || LogCategory.QUERY;
    this.logToConsole = options.logToConsole !== false;
    this.logToFile = !!options.logToFile && !!options.logFilePath;
    this.logToMetrics = !!options.logToMetrics;
    this.logFilePath = options.logFilePath;
    this.serviceName = options.serviceName || 'database';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
  }
  
  public setDefaultCategory(category: LogCategory): void {
    this.defaultCategory = category;
  }
  
  public shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const currentIndex = levels.indexOf(this.currentLogLevel);
    const levelIndex = levels.indexOf(level);
    
    return levelIndex <= currentIndex;
  }
  
  public log(message: string, options: LogOptions = {}): void {
    const level = options.level || LogLevel.INFO;
    
    if (!this.shouldLog(level)) {
      return;
    }
    
    const timestamp = options.timestamp || new Date();
    const category = options.category || this.defaultCategory;
    
    // Build log entry object for potential storage/metrics
    const logEntry = {
      timestamp: timestamp.toISOString(),
      level,
      category,
      message,
      elapsed: options.elapsed,
      operation: options.operation,
      sql: options.sql,
      params: options.params,
      metadata: options.metadata,
      error: options.error ? {
        name: options.error.name,
        message: options.error.message,
        stack: options.error.stack
      } : undefined,
      service: this.serviceName,
      environment: this.environment
    };
    
    // Send to file/metrics systems if configured
    if (this.logToFile && this.logFilePath) {
      // Append to log file (to be implemented)
      this.writeToLogFile(logEntry);
    }
    
    if (this.logToMetrics) {
      // Send to metrics system (to be implemented)
      this.sendToMetrics(logEntry);
    }
    
    // Log to console if enabled
    if (this.logToConsole) {
      this.writeToConsole(message, level, category, timestamp, options);
    }
  }
  
  private writeToConsole(
    message: string, 
    level: LogLevel, 
    category: LogCategory, 
    timestamp: Date,
    options: LogOptions
  ): void {
    // Select console method based on level
    let consoleMethod: (...data: any[]) => void;
    switch (level) {
      case LogLevel.ERROR:
        consoleMethod = console.error;
        break;
      case LogLevel.WARN:
        consoleMethod = console.warn;
        break;
      case LogLevel.DEBUG:
        consoleMethod = console.debug;
        break;
      case LogLevel.TRACE:
        consoleMethod = console.trace;
        break;
      case LogLevel.INFO:
      default:
        consoleMethod = console.info;
        break;
    }
    
    // Format the log message
    const logPrefix = `[${timestamp.toISOString()}] [${level.toUpperCase()}] [${category}]`;
    
    if (level === LogLevel.ERROR && options.error) {
      consoleMethod(`${logPrefix} ${message}`, options.error);
    } else {
      if (options.elapsed) {
        consoleMethod(`${logPrefix} ${message} (${options.elapsed.toFixed(2)}ms)`);
      } else {
        consoleMethod(`${logPrefix} ${message}`);
      }
      
      // Log additional details at debug level
      if (this.shouldLog(LogLevel.DEBUG) && (options.sql || options.params || options.metadata)) {
        logger.debug('Details:', {
          sql: options.sql,
          params: options.params,
          metadata: options.metadata
        });
      }
    }
  }
  
  private writeToLogFile(logEntry: any): void {
    // To be implemented
  }
  
  private sendToMetrics(logEntry: any): void {
    // To be implemented
  }
  
  public error(message: string, errorOrMetadata?: Error | Record<string, any>, metadata?: Record<string, any>): void {
    // Handle overloaded method signature
    let error: Error | undefined;
    let combinedMetadata: Record<string, any> | undefined;
    
    if (errorOrMetadata instanceof Error) {
      error = errorOrMetadata;
      combinedMetadata = metadata;
    } else {
      error = undefined;
      combinedMetadata = errorOrMetadata;
    }
    
    this.log(message, {
      level: LogLevel.ERROR,
      error,
      metadata: combinedMetadata
    });
  }
  
  public warn(message: string, metadata?: Record<string, any>): void {
    this.log(message, {
      level: LogLevel.WARN,
      metadata
    });
  }
  
  public info(message: string, metadata?: Record<string, any>): void {
    this.log(message, {
      level: LogLevel.INFO,
      metadata
    });
  }
  
  public debug(message: string, metadata?: Record<string, any>): void {
    this.log(message, {
      level: LogLevel.DEBUG,
      metadata
    });
  }
  
  public trace(message: string, metadata?: Record<string, any>): void {
    this.log(message, {
      level: LogLevel.TRACE,
      metadata
    });
  }
  
  public createTimer(operation: string): DbOperationTimer {
    let startTime = 0;
    let endTime = 0;
    
    return {
      start: () => {
        startTime = Date.now();
      },
      end: (message?: string, additionalMetadata?: Record<string, any>) => {
        endTime = Date.now();
        const elapsed = endTime - startTime;
        
        if (message) {
          this.log(message, {
            elapsed,
            operation,
            metadata: additionalMetadata
          });
        }
        
        return elapsed;
      },
      elapsed: () => {
        return endTime > 0 ? endTime - startTime : Date.now() - startTime;
      }
    };
  }
}

// Create a singleton instance
let loggerInstance: DatabaseLogger | null = null;

/**
 * Get the database logger instance
 */
export function getDatabaseLogger(options?: LoggerOptions): DatabaseLogger {
  if (!loggerInstance) {
    loggerInstance = new DatabaseLogger(options);
  }
  return loggerInstance;
}

/**
 * Create a Prisma client with query logging
 */
export function createPrismaWithLogging(connectionUrl?: string, loggerOptions?: LoggerOptions): PrismaClient {
  const logger = getDatabaseLogger(loggerOptions);
  
  // Create prisma client with logging middleware
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl || process.env.DATABASE_URL,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });
  
  // Log queries
  prisma.$on('query', (e) => {
    logger.log(e.query, {
      level: LogLevel.DEBUG,
      category: LogCategory.QUERY,
      operation: 'query',
      sql: e.query,
      params: e.params,
      elapsed: e.duration,
    });
  });
  
  // Log errors
  prisma.$on('error', (e) => {
    logger.error(`Database error: ${e.message}`, new Error(e.message), {
      target: e.target,
    });
  });
  
  // Log info messages
  prisma.$on('info', (e) => {
    logger.info(e.message, {
      target: e.target,
    });
  });
  
  // Log warnings
  prisma.$on('warn', (e) => {
    logger.warn(e.message, {
      target: e.target,
    });
  });
  
  return prisma;
}

// Removed createRobustConnectionWithLogging to resolve circular dependencies.
// This function has been moved to db-connectivity.ts.