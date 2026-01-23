/**
 * Enhanced logging for ValKey operations in VibeCode WebGUI
 * Provides detailed logging for ValKey/Redis operations with context
 */

// import { logger } from '../server-monitoring';

// Log levels for ValKey operations
export enum ValKeyLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// ValKey operation types
export enum ValKeyOperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
  CONNECTION = 'connection',
  TRANSACTION = 'transaction',
  OTHER = 'other'
}

// Interface for ValKey operation context
interface ValKeyLogContext {
  command?: string;
  duration?: number;
  key?: string;
  keys?: string[];
  keyCount?: number;
  source?: string;
  result?: 'success' | 'error' | 'timeout';
  error?: Error | string;
  statusCode?: number;
  valueSize?: number;
  connectionId?: string;
  operationType?: ValKeyOperationType;
  cacheHit?: boolean;
  serverInfo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  environment?: string;
  service?: string;
  component?: string;
  serviceName?: string;
  ttl?: number;
  detailedLogging?: boolean;
  logSlowOperations?: boolean;
  slowOperationThresholdMs?: number;
}

/**
 * ValKey Logger for enhanced operation logging
 */
export class ValKeyLogger {
  private readonly environment: string;
  private readonly serviceName: string;
  private readonly component: string;
  private readonly logErrors: boolean;
  private readonly logSlowOperations: boolean;
  private readonly slowOperationThresholdMs: number;
  private readonly detailedLogging: boolean;
  
  constructor(options?: {
    serviceName?: string;
    component?: string;
    logErrors?: boolean;
    logSlowOperations?: boolean;
    slowOperationThresholdMs?: number;
    detailedLogging?: boolean;
  }) {
    this.environment = process.env.NODE_ENV || 'development';
    this.serviceName = options?.serviceName || 'vibecode-webgui';
    this.component = options?.component || 'valkey';
    this.logErrors = options?.logErrors !== false;
    this.logSlowOperations = options?.logSlowOperations !== false;
    this.slowOperationThresholdMs = options?.slowOperationThresholdMs || 50;
    this.detailedLogging = options?.detailedLogging || this.environment === 'development';
    
    // Log initialization
    this.info('ValKey logger initialized', {
      command: 'init',
      environment: this.environment,
      serviceName: this.serviceName,
      component: this.component,
      detailedLogging: this.detailedLogging,
      logSlowOperations: this.logSlowOperations,
      slowOperationThresholdMs: this.slowOperationThresholdMs
    });
  }
  
  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: ValKeyLogContext): void {
    if (!this.detailedLogging) return;

    this.log(ValKeyLogLevel.DEBUG, message, context);
  }

  /**
   * Log at INFO level
   */
  info(message: string, context?: ValKeyLogContext): void {
    this.log(ValKeyLogLevel.INFO, message, context);
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: ValKeyLogContext): void {
    this.log(ValKeyLogLevel.WARN, message, context);
  }

  /**
   * Log at ERROR level
   */
  error(message: string, context?: ValKeyLogContext): void {
    if (!this.logErrors) return;

    this.log(ValKeyLogLevel.ERROR, message, context);
  }
  
  /**
   * Log a ValKey operation
   */
  logOperation(
    command: string,
    result: 'success' | 'error' | 'timeout',
    duration: number,
    context?: Omit<ValKeyLogContext, 'command' | 'result' | 'duration'>
  ): void {
    // Determine operation type
    let operationType = ValKeyOperationType.OTHER;
    const cmdLower = command.toLowerCase();
    
    if (['get', 'mget', 'keys', 'scan', 'exists', 'ttl'].includes(cmdLower)) {
      operationType = ValKeyOperationType.READ;
    } else if (['set', 'mset', 'setex', 'setnx', 'incr'].includes(cmdLower)) {
      operationType = ValKeyOperationType.WRITE;
    } else if (['del', 'unlink', 'expire'].includes(cmdLower)) {
      operationType = ValKeyOperationType.DELETE;
    } else if (['info', 'config', 'slowlog', 'monitor'].includes(cmdLower)) {
      operationType = ValKeyOperationType.ADMIN;
    } else if (['connect', 'disconnect', 'ping'].includes(cmdLower)) {
      operationType = ValKeyOperationType.CONNECTION;
    } else if (['multi', 'exec', 'discard', 'watch'].includes(cmdLower)) {
      operationType = ValKeyOperationType.TRANSACTION;
    }
    
    // Determine log level based on result and duration
    let level = ValKeyLogLevel.DEBUG;
    
    if (result === 'error') {
      level = ValKeyLogLevel.ERROR;
    } else if (result === 'timeout') {
      level = ValKeyLogLevel.WARN;
    } else if (this.logSlowOperations && duration > this.slowOperationThresholdMs) {
      level = ValKeyLogLevel.WARN;
    }
    
    // Create log message
    let message = `ValKey ${operationType} operation: ${command}`;
    
    if (result === 'error') {
      message = `ValKey ${operationType} operation failed: ${command}`;
    } else if (result === 'timeout') {
      message = `ValKey ${operationType} operation timed out: ${command}`;
    } else if (duration > this.slowOperationThresholdMs) {
      message = `Slow ValKey ${operationType} operation: ${command} (${duration}ms)`;
    }
    
    // Log the operation
    this.log(level, message, {
      command,
      result,
      duration,
      operationType,
      ...context
    });
  }
  
  /**
   * Log connection events
   */
  logConnection(
    event: 'connect' | 'disconnect' | 'reconnect' | 'error',
    context?: Omit<ValKeyLogContext, 'command' | 'operationType'>
  ): void {
    const level = event === 'error' ? ValKeyLogLevel.ERROR : 
                  event === 'reconnect' ? ValKeyLogLevel.WARN : 
                  ValKeyLogLevel.INFO;
    
    const message = `ValKey connection ${event}`;
    
    this.log(level, message, {
      command: event,
      operationType: ValKeyOperationType.CONNECTION,
      ...context
    });
  }
  
  /**
   * Base log method
   */
  private log(level: ValKeyLogLevel, message: string, context?: ValKeyLogContext): void {
    // Create log context with proper type
    const logContext: ValKeyLogContext & { cache_type: string } = {
      cache_type: 'valkey',
      component: this.component,
      service: this.serviceName,
      environment: this.environment,
      ...(context || {})
    };

    // Add default operation type if not specified
    if (context?.command && !context?.operationType) {
      logContext.operationType = this.determineOperationType(context.command);
    }

    // Sanitize keys for logging if present
    if (logContext.key && typeof logContext.key === 'string' && logContext.key.length > 100) {
      logContext.key = `${logContext.key.substring(0, 97)}...`;
    }
    
    // Log based on level
    switch (level) {
      case ValKeyLogLevel.DEBUG:
        console.debug(message, logContext);
        break;
      case ValKeyLogLevel.INFO:
        console.info(message, logContext);
        break;
      case ValKeyLogLevel.WARN:
        console.warn(message, logContext);
        break;
      case ValKeyLogLevel.ERROR:
        console.error(message, logContext);
        break;
    }
  }
  
  /**
   * Determine operation type from command
   */
  private determineOperationType(command: string): ValKeyOperationType {
    const cmdLower = command.toLowerCase();
    
    if (['get', 'mget', 'keys', 'scan', 'exists', 'ttl'].includes(cmdLower)) {
      return ValKeyOperationType.READ;
    } else if (['set', 'mset', 'setex', 'setnx', 'incr'].includes(cmdLower)) {
      return ValKeyOperationType.WRITE;
    } else if (['del', 'unlink', 'expire'].includes(cmdLower)) {
      return ValKeyOperationType.DELETE;
    } else if (['info', 'config', 'slowlog', 'monitor'].includes(cmdLower)) {
      return ValKeyOperationType.ADMIN;
    } else if (['connect', 'disconnect', 'ping'].includes(cmdLower)) {
      return ValKeyOperationType.CONNECTION;
    } else if (['multi', 'exec', 'discard', 'watch'].includes(cmdLower)) {
      return ValKeyOperationType.TRANSACTION;
    }
    
    return ValKeyOperationType.OTHER;
  }
}

// Export singleton instance
export const valkeyLogger = new ValKeyLogger();
export default valkeyLogger;