/**
 * Performance Logger
 *
 * Provides utilities for timing operations and logging performance metrics.
 */

import { logger } from '@/lib/logger';
import { formatDuration, sanitizeLogData, LogMetadata } from './format';

/**
 * Performance timer interface
 */
export interface PerformanceTimer {
  /**
   * Stop the timer and log the duration
   * @param metadata - Additional metadata to include in the log
   * @returns Duration in milliseconds
   */
  stop(metadata?: LogMetadata): number;

  /**
   * Get elapsed time without stopping
   * @returns Elapsed time in milliseconds
   */
  elapsed(): number;

  /**
   * Create a checkpoint (lap time) without stopping
   * @param name - Checkpoint name
   * @param metadata - Additional metadata
   * @returns Elapsed time at checkpoint
   */
  checkpoint(name: string, metadata?: LogMetadata): number;
}

/**
 * Result of a timed operation
 */
export interface TimingResult<T> {
  result: T;
  duration: number;
  formattedDuration: string;
}

/**
 * Create a performance timer
 *
 * @param operation - Name of the operation being timed
 * @param metadata - Base metadata to include in logs
 * @returns PerformanceTimer instance
 *
 * @example
 * ```typescript
 * const timer = createPerformanceTimer('database-query', { table: 'users' });
 * await db.query('SELECT * FROM users');
 * timer.stop({ rowCount: 100 });
 * ```
 */
export function createPerformanceTimer(
  operation: string,
  metadata?: LogMetadata
): PerformanceTimer {
  const startTime = performance.now();
  const checkpoints: Array<{ name: string; time: number }> = [];

  return {
    stop(additionalMetadata?: LogMetadata): number {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const logData: Record<string, unknown> = {
        operation,
        durationMs: Math.round(duration * 100) / 100,
        formattedDuration: formatDuration(duration),
        ...(metadata ? sanitizeLogData(metadata) : {}),
        ...(additionalMetadata ? sanitizeLogData(additionalMetadata) : {})
      };

      if (checkpoints.length > 0) {
        logData.checkpoints = checkpoints.map((cp, idx) => ({
          name: cp.name,
          elapsed: Math.round(cp.time * 100) / 100,
          delta:
            idx === 0
              ? Math.round(cp.time * 100) / 100
              : Math.round((cp.time - checkpoints[idx - 1].time) * 100) / 100
        }));
      }

      // Log at different levels based on duration
      if (duration > 5000) {
        logger.warn(`Slow operation: ${operation}`, logData);
      } else if (duration > 1000) {
        logger.info(`Performance: ${operation}`, logData);
      } else {
        logger.debug(`Performance: ${operation}`, logData);
      }

      return duration;
    },

    elapsed(): number {
      return performance.now() - startTime;
    },

    checkpoint(name: string, additionalMetadata?: LogMetadata): number {
      const elapsed = performance.now() - startTime;
      checkpoints.push({ name, time: elapsed });

      logger.debug(`Checkpoint: ${operation} - ${name}`, {
        operation,
        checkpoint: name,
        elapsedMs: Math.round(elapsed * 100) / 100,
        ...(metadata ? sanitizeLogData(metadata) : {}),
        ...(additionalMetadata ? sanitizeLogData(additionalMetadata) : {})
      });

      return elapsed;
    }
  };
}

/**
 * Log a performance metric directly
 *
 * @param operation - Name of the operation
 * @param duration - Duration in milliseconds
 * @param metadata - Additional metadata
 *
 * @example
 * ```typescript
 * const start = Date.now();
 * await processData();
 * logPerformanceMetric('process-data', Date.now() - start, { items: 100 });
 * ```
 */
export function logPerformanceMetric(
  operation: string,
  duration: number,
  metadata?: LogMetadata
): void {
  const logData: Record<string, unknown> = {
    operation,
    durationMs: Math.round(duration * 100) / 100,
    formattedDuration: formatDuration(duration),
    ...(metadata ? sanitizeLogData(metadata) : {})
  };

  if (duration > 5000) {
    logger.warn(`Slow operation: ${operation}`, logData);
  } else if (duration > 1000) {
    logger.info(`Performance: ${operation}`, logData);
  } else {
    logger.debug(`Performance: ${operation}`, logData);
  }
}

/**
 * Wrap an async function with timing
 *
 * @param operation - Name of the operation
 * @param fn - Async function to time
 * @param metadata - Base metadata to include
 * @returns Result with timing information
 *
 * @example
 * ```typescript
 * const { result, duration } = await withTiming(
 *   'fetch-user',
 *   () => fetchUser(userId),
 *   { userId }
 * );
 * ```
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: LogMetadata
): Promise<TimingResult<T>> {
  const timer = createPerformanceTimer(operation, metadata);

  try {
    const result = await fn();
    const duration = timer.stop({ success: true });

    return {
      result,
      duration,
      formattedDuration: formatDuration(duration)
    };
  } catch (error) {
    timer.stop({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Wrap a sync function with timing
 *
 * @param operation - Name of the operation
 * @param fn - Sync function to time
 * @param metadata - Base metadata to include
 * @returns Result with timing information
 */
export function withTimingSync<T>(
  operation: string,
  fn: () => T,
  metadata?: LogMetadata
): TimingResult<T> {
  const timer = createPerformanceTimer(operation, metadata);

  try {
    const result = fn();
    const duration = timer.stop({ success: true });

    return {
      result,
      duration,
      formattedDuration: formatDuration(duration)
    };
  } catch (error) {
    timer.stop({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Create a performance logger for a specific component
 *
 * @param component - Component name
 * @returns Object with performance logging methods
 */
export function createPerformanceLogger(component: string) {
  return {
    /**
     * Start a timer for an operation
     */
    startTimer(operation: string, metadata?: LogMetadata): PerformanceTimer {
      return createPerformanceTimer(operation, { component, ...metadata });
    },

    /**
     * Log a metric directly
     */
    logMetric(
      operation: string,
      duration: number,
      metadata?: LogMetadata
    ): void {
      logPerformanceMetric(operation, duration, { component, ...metadata });
    },

    /**
     * Wrap an async function with timing
     */
    async time<T>(
      operation: string,
      fn: () => Promise<T>,
      metadata?: LogMetadata
    ): Promise<TimingResult<T>> {
      return withTiming(operation, fn, { component, ...metadata });
    }
  };
}
