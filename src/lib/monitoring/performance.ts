/**
 * Performance Monitoring Utilities
 *
 * Provides comprehensive performance monitoring utilities including:
 * - Request timing middleware for API routes
 * - Memory usage tracking
 * - CPU utilization helpers
 * - Database query timing
 * - External API call timing
 *
 * Integrates with the existing logging infrastructure at src/lib/logging/
 * and the monitoring system for metrics submission.
 *
 * @example
 * ```typescript
 * import {
 *   requestTimingMiddleware,
 *   trackMemoryUsage,
 *   trackDatabaseQuery,
 *   trackExternalApiCall
 * } from '@/lib/monitoring/performance';
 *
 * // Use request timing middleware
 * export const GET = requestTimingMiddleware(async (req) => {
 *   // Your handler logic
 *   return Response.json({ data: 'result' });
 * });
 *
 * // Track a database query
 * const result = await trackDatabaseQuery('users.findMany', async () => {
 *   return prisma.user.findMany();
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger, createLogger, logPerformance } from '@/lib/logger';
import {
  createPerformanceTimer,
  withTiming,
  type PerformanceTimer,
  type TimingResult
} from '@/lib/logging/performance-logger';
import { sanitizeLogData, formatDuration, formatBytes, type LogMetadata } from '@/lib/logging/format';
import { monitoring } from './datadog-client';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for performance monitoring thresholds
 */
export interface PerformanceThresholds {
  /** Threshold in ms for slow requests (default: 1000) */
  slowRequestMs: number;
  /** Threshold in ms for very slow requests (default: 5000) */
  verySlowRequestMs: number;
  /** Threshold in ms for slow database queries (default: 500) */
  slowQueryMs: number;
  /** Threshold in ms for slow external API calls (default: 2000) */
  slowApiCallMs: number;
  /** Memory usage percentage threshold for warnings (default: 80) */
  memoryWarningPercent: number;
  /** CPU usage percentage threshold for warnings (default: 80) */
  cpuWarningPercent: number;
}

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  heapUsagePercent: number;
  timestamp: number;
}

/**
 * CPU usage snapshot
 */
export interface CpuSnapshot {
  user: number;
  system: number;
  total: number;
  idle: number;
  usagePercent: number;
  timestamp: number;
}

/**
 * Request timing result
 */
export interface RequestTimingResult {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  formattedDuration: string;
  memoryDelta: number;
  timestamp: number;
  traceId?: string;
  spanId?: string;
}

/**
 * Database query timing result
 */
export interface QueryTimingResult<T> {
  result: T;
  queryName: string;
  durationMs: number;
  formattedDuration: string;
  rowCount?: number;
  timestamp: number;
}

/**
 * External API call timing result
 */
export interface ApiCallTimingResult<T> {
  result: T;
  serviceName: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  durationMs: number;
  formattedDuration: string;
  timestamp: number;
}

/**
 * Handler function type for request timing middleware
 */
export type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<Response> | Response;

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  slowRequestMs: 1000,
  verySlowRequestMs: 5000,
  slowQueryMs: 500,
  slowApiCallMs: 2000,
  memoryWarningPercent: 80,
  cpuWarningPercent: 80
};

let currentThresholds: PerformanceThresholds = { ...DEFAULT_THRESHOLDS };

/**
 * Configure performance monitoring thresholds
 */
export function configureThresholds(thresholds: Partial<PerformanceThresholds>): void {
  currentThresholds = { ...currentThresholds, ...thresholds };
}

/**
 * Get current performance thresholds
 */
export function getThresholds(): PerformanceThresholds {
  return { ...currentThresholds };
}

// ============================================================================
// Request Timing Middleware
// ============================================================================

const requestLogger = createLogger({ component: 'request-timing' });

/**
 * Middleware wrapper for timing API route handlers
 *
 * Wraps a Next.js API route handler to automatically track:
 * - Request duration
 * - Memory usage delta
 * - Response status code
 * - Trace context (if available)
 *
 * @param handler - The API route handler function
 * @param options - Optional configuration
 * @returns Wrapped handler with timing
 *
 * @example
 * ```typescript
 * export const GET = requestTimingMiddleware(async (req) => {
 *   const data = await fetchData();
 *   return Response.json({ data });
 * });
 * ```
 */
export function requestTimingMiddleware(
  handler: ApiHandler,
  options?: {
    /** Custom name for the endpoint (default: extracted from URL) */
    endpointName?: string;
    /** Whether to log slow requests (default: true) */
    logSlowRequests?: boolean;
    /** Whether to submit metrics to Datadog (default: true) */
    submitMetrics?: boolean;
  }
): ApiHandler {
  const {
    endpointName,
    logSlowRequests = true,
    submitMetrics = true
  } = options ?? {};

  return async (
    request: NextRequest,
    context?: { params?: Record<string, string | string[]> }
  ): Promise<Response> => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const method = request.method;
    const url = new URL(request.url);
    const path = endpointName ?? url.pathname;

    // Extract trace context from headers
    const traceId = request.headers.get('x-trace-id') ??
      request.headers.get('x-datadog-trace-id') ??
      undefined;
    const spanId = request.headers.get('x-span-id') ??
      request.headers.get('x-datadog-span-id') ??
      undefined;

    let response: Response;
    let statusCode = 200;
    let error: Error | undefined;

    try {
      response = await handler(request, context);
      statusCode = response.status;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      statusCode = 500;
      response = new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    const result: RequestTimingResult = {
      method,
      path,
      statusCode,
      durationMs,
      formattedDuration: formatDuration(durationMs),
      memoryDelta,
      timestamp: Date.now(),
      traceId,
      spanId
    };

    // Log based on duration thresholds
    const logMetadata: LogMetadata = {
      method,
      path,
      statusCode,
      durationMs,
      formattedDuration: result.formattedDuration,
      memoryDelta,
      memoryDeltaMB: Math.round((memoryDelta / 1024 / 1024) * 100) / 100,
      traceId,
      spanId
    };

    if (error !== undefined) {
      requestLogger.error(`Request failed: ${method} ${path}`, {
        ...logMetadata,
        error: error.message,
        stack: error.stack
      });
    } else if (durationMs >= currentThresholds.verySlowRequestMs && logSlowRequests) {
      requestLogger.warn(`Very slow request: ${method} ${path}`, logMetadata);
    } else if (durationMs >= currentThresholds.slowRequestMs && logSlowRequests) {
      requestLogger.info(`Slow request: ${method} ${path}`, logMetadata);
    } else {
      requestLogger.debug(`Request completed: ${method} ${path}`, logMetadata);
    }

    // Submit metrics to Datadog
    if (submitMetrics) {
      const tags = [
        `endpoint:${path}`,
        `method:${method}`,
        `status:${statusCode}`,
        'service:vibecode-webgui'
      ];

      void monitoring.submitMetric({
        metric: 'vibecode.http.request.duration',
        value: durationMs,
        tags
      });

      if (statusCode >= 400) {
        void monitoring.submitMetric({
          metric: 'vibecode.http.request.errors',
          value: 1,
          tags
        });
      }
    }

    return response;
  };
}

/**
 * Create a request timer for manual timing in handlers
 *
 * @param request - The incoming request
 * @param metadata - Additional metadata
 * @returns Performance timer instance
 */
export function createRequestTimer(
  request: NextRequest,
  metadata?: LogMetadata
): PerformanceTimer {
  const url = new URL(request.url);
  return createPerformanceTimer(`request:${request.method}:${url.pathname}`, {
    method: request.method,
    path: url.pathname,
    ...metadata
  });
}

// ============================================================================
// Memory Usage Tracking
// ============================================================================

const memoryLogger = createLogger({ component: 'memory-tracking' });

/**
 * Get current memory usage snapshot
 *
 * @returns Memory usage snapshot with formatted values
 *
 * @example
 * ```typescript
 * const memory = getMemorySnapshot();
 * console.log(`Heap used: ${memory.heapUsedMB}MB (${memory.heapUsagePercent}%)`);
 * ```
 */
export function getMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100;
  const heapTotalMB = Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100;
  const rssMB = Math.round((usage.rss / 1024 / 1024) * 100) / 100;
  const heapUsagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 10000) / 100;

  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    rss: usage.rss,
    heapUsedMB,
    heapTotalMB,
    rssMB,
    heapUsagePercent,
    timestamp: Date.now()
  };
}

/**
 * Track memory usage and log/submit metrics
 *
 * @param label - Optional label for the measurement
 * @param submitMetrics - Whether to submit to Datadog (default: true)
 * @returns Memory snapshot
 *
 * @example
 * ```typescript
 * // Track memory before an operation
 * const before = trackMemoryUsage('before-processing');
 *
 * // ... perform operation ...
 *
 * // Track memory after
 * const after = trackMemoryUsage('after-processing');
 * const delta = after.heapUsedMB - before.heapUsedMB;
 * ```
 */
export function trackMemoryUsage(
  label?: string,
  submitMetrics = true
): MemorySnapshot {
  const snapshot = getMemorySnapshot();
  const logLabel = label ?? 'memory-snapshot';

  const logData: LogMetadata = {
    label: logLabel,
    heapUsedMB: snapshot.heapUsedMB,
    heapTotalMB: snapshot.heapTotalMB,
    rssMB: snapshot.rssMB,
    heapUsagePercent: snapshot.heapUsagePercent,
    heapUsedFormatted: formatBytes(snapshot.heapUsed),
    heapTotalFormatted: formatBytes(snapshot.heapTotal),
    rssFormatted: formatBytes(snapshot.rss)
  };

  if (snapshot.heapUsagePercent >= currentThresholds.memoryWarningPercent) {
    memoryLogger.warn(`High memory usage: ${logLabel}`, logData);
  } else {
    memoryLogger.debug(`Memory snapshot: ${logLabel}`, logData);
  }

  if (submitMetrics) {
    const tags = ['service:vibecode-webgui', `label:${logLabel}`];

    void monitoring.submitMetric({
      metric: 'vibecode.memory.heap_used',
      value: snapshot.heapUsedMB,
      tags
    });

    void monitoring.submitMetric({
      metric: 'vibecode.memory.heap_total',
      value: snapshot.heapTotalMB,
      tags
    });

    void monitoring.submitMetric({
      metric: 'vibecode.memory.rss',
      value: snapshot.rssMB,
      tags
    });

    void monitoring.submitMetric({
      metric: 'vibecode.memory.usage_percent',
      value: snapshot.heapUsagePercent,
      tags
    });
  }

  return snapshot;
}

/**
 * Track memory delta around an operation
 *
 * @param operation - Name of the operation
 * @param fn - Function to execute
 * @returns Result with memory delta information
 */
export async function withMemoryTracking<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<{ result: T; memoryDelta: number; memoryDeltaMB: number }> {
  const before = getMemorySnapshot();

  try {
    const result = await fn();
    const after = getMemorySnapshot();
    const memoryDelta = after.heapUsed - before.heapUsed;
    const memoryDeltaMB = Math.round((memoryDelta / 1024 / 1024) * 100) / 100;

    memoryLogger.debug(`Memory delta for ${operation}`, {
      operation,
      memoryDeltaMB,
      memoryDeltaFormatted: formatBytes(Math.abs(memoryDelta)),
      direction: memoryDelta >= 0 ? 'increase' : 'decrease'
    });

    return { result, memoryDelta, memoryDeltaMB };
  } catch (error) {
    const after = getMemorySnapshot();
    const memoryDelta = after.heapUsed - before.heapUsed;

    memoryLogger.error(`Memory tracking failed for ${operation}`, {
      operation,
      memoryDeltaMB: Math.round((memoryDelta / 1024 / 1024) * 100) / 100,
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

// ============================================================================
// CPU Utilization Helpers
// ============================================================================

const cpuLogger = createLogger({ component: 'cpu-tracking' });

// Store previous CPU usage for delta calculation
let previousCpuUsage: NodeJS.CpuUsage | undefined;
let previousCpuTime: number | undefined;

/**
 * Get current CPU usage snapshot
 *
 * Note: CPU usage is measured as delta from last call. First call returns zeros.
 *
 * @returns CPU usage snapshot
 *
 * @example
 * ```typescript
 * const cpu = getCpuSnapshot();
 * console.log(`CPU usage: ${cpu.usagePercent}%`);
 * ```
 */
export function getCpuSnapshot(): CpuSnapshot {
  const currentUsage = process.cpuUsage(previousCpuUsage);
  const currentTime = Date.now();

  let usagePercent = 0;
  let userPercent = 0;
  let systemPercent = 0;

  if (previousCpuTime !== undefined) {
    const elapsed = (currentTime - previousCpuTime) * 1000; // Convert to microseconds
    if (elapsed > 0) {
      userPercent = Math.round((currentUsage.user / elapsed) * 10000) / 100;
      systemPercent = Math.round((currentUsage.system / elapsed) * 10000) / 100;
      usagePercent = Math.min(100, userPercent + systemPercent);
    }
  }

  previousCpuUsage = process.cpuUsage();
  previousCpuTime = currentTime;

  return {
    user: currentUsage.user,
    system: currentUsage.system,
    total: currentUsage.user + currentUsage.system,
    idle: 0, // Not directly available in Node.js
    usagePercent,
    timestamp: currentTime
  };
}

/**
 * Track CPU usage and log/submit metrics
 *
 * @param label - Optional label for the measurement
 * @param submitMetrics - Whether to submit to Datadog (default: true)
 * @returns CPU snapshot
 */
export function trackCpuUsage(
  label?: string,
  submitMetrics = true
): CpuSnapshot {
  const snapshot = getCpuSnapshot();
  const logLabel = label ?? 'cpu-snapshot';

  const logData: LogMetadata = {
    label: logLabel,
    userMicroseconds: snapshot.user,
    systemMicroseconds: snapshot.system,
    totalMicroseconds: snapshot.total,
    usagePercent: snapshot.usagePercent
  };

  if (snapshot.usagePercent >= currentThresholds.cpuWarningPercent) {
    cpuLogger.warn(`High CPU usage: ${logLabel}`, logData);
  } else {
    cpuLogger.debug(`CPU snapshot: ${logLabel}`, logData);
  }

  if (submitMetrics) {
    const tags = ['service:vibecode-webgui', `label:${logLabel}`];

    void monitoring.submitMetric({
      metric: 'vibecode.cpu.usage_percent',
      value: snapshot.usagePercent,
      tags
    });

    void monitoring.submitMetric({
      metric: 'vibecode.cpu.user_microseconds',
      value: snapshot.user,
      tags
    });

    void monitoring.submitMetric({
      metric: 'vibecode.cpu.system_microseconds',
      value: snapshot.system,
      tags
    });
  }

  return snapshot;
}

/**
 * Track CPU usage around an operation
 *
 * @param operation - Name of the operation
 * @param fn - Function to execute
 * @returns Result with CPU usage information
 */
export async function withCpuTracking<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<{ result: T; cpuUsage: NodeJS.CpuUsage }> {
  const beforeCpu = process.cpuUsage();

  try {
    const result = await fn();
    const cpuUsage = process.cpuUsage(beforeCpu);

    cpuLogger.debug(`CPU usage for ${operation}`, {
      operation,
      userMicroseconds: cpuUsage.user,
      systemMicroseconds: cpuUsage.system,
      totalMicroseconds: cpuUsage.user + cpuUsage.system
    });

    return { result, cpuUsage };
  } catch (error) {
    const cpuUsage = process.cpuUsage(beforeCpu);

    cpuLogger.error(`CPU tracking failed for ${operation}`, {
      operation,
      userMicroseconds: cpuUsage.user,
      systemMicroseconds: cpuUsage.system,
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

// ============================================================================
// Database Query Timing
// ============================================================================

const dbLogger = createLogger({ component: 'database-timing' });

/**
 * Track database query timing
 *
 * @param queryName - Descriptive name for the query
 * @param fn - Function that executes the query
 * @param options - Optional configuration
 * @returns Query result with timing information
 *
 * @example
 * ```typescript
 * const { result, durationMs } = await trackDatabaseQuery(
 *   'users.findByEmail',
 *   async () => prisma.user.findUnique({ where: { email } }),
 *   { table: 'users', operation: 'findUnique' }
 * );
 * ```
 */
export async function trackDatabaseQuery<T>(
  queryName: string,
  fn: () => Promise<T>,
  options?: {
    /** Table name being queried */
    table?: string;
    /** Type of operation (select, insert, update, delete) */
    operation?: string;
    /** Whether to submit metrics (default: true) */
    submitMetrics?: boolean;
  }
): Promise<QueryTimingResult<T>> {
  const { table, operation, submitMetrics = true } = options ?? {};
  const startTime = performance.now();
  const timestamp = Date.now();

  try {
    const result = await fn();
    const endTime = performance.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;

    // Try to determine row count if result is an array
    let rowCount: number | undefined;
    if (Array.isArray(result)) {
      rowCount = result.length;
    }

    const logData: LogMetadata = {
      queryName,
      durationMs,
      formattedDuration: formatDuration(durationMs),
      table,
      operation,
      rowCount,
      success: true
    };

    if (durationMs >= currentThresholds.slowQueryMs) {
      dbLogger.warn(`Slow database query: ${queryName}`, logData);
    } else {
      dbLogger.debug(`Database query: ${queryName}`, logData);
    }

    if (submitMetrics) {
      const tags = [
        `query:${queryName}`,
        'service:vibecode-webgui',
        ...(table !== undefined ? [`table:${table}`] : []),
        ...(operation !== undefined ? [`operation:${operation}`] : [])
      ];

      void monitoring.submitMetric({
        metric: 'vibecode.database.query_duration',
        value: durationMs,
        tags
      });

      if (rowCount !== undefined) {
        void monitoring.submitMetric({
          metric: 'vibecode.database.rows_returned',
          value: rowCount,
          tags
        });
      }
    }

    return {
      result,
      queryName,
      durationMs,
      formattedDuration: formatDuration(durationMs),
      rowCount,
      timestamp
    };
  } catch (error) {
    const endTime = performance.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;

    dbLogger.error(`Database query failed: ${queryName}`, {
      queryName,
      durationMs,
      table,
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    const tags = [
      `query:${queryName}`,
      'service:vibecode-webgui',
      'status:error',
      ...(table !== undefined ? [`table:${table}`] : []),
      ...(operation !== undefined ? [`operation:${operation}`] : [])
    ];

    if (submitMetrics) {
      void monitoring.submitMetric({
        metric: 'vibecode.database.query_errors',
        value: 1,
        tags
      });
    }

    throw error;
  }
}

/**
 * Create a database query timer for manual timing
 *
 * @param queryName - Descriptive name for the query
 * @param metadata - Additional metadata
 * @returns Performance timer instance
 */
export function createDatabaseTimer(
  queryName: string,
  metadata?: LogMetadata
): PerformanceTimer {
  return createPerformanceTimer(`db:${queryName}`, {
    component: 'database',
    ...metadata
  });
}

// ============================================================================
// External API Call Timing
// ============================================================================

const apiLogger = createLogger({ component: 'external-api-timing' });

/**
 * Track external API call timing
 *
 * @param serviceName - Name of the external service
 * @param endpoint - API endpoint being called
 * @param fn - Function that makes the API call
 * @param options - Optional configuration
 * @returns API call result with timing information
 *
 * @example
 * ```typescript
 * const { result, durationMs } = await trackExternalApiCall(
 *   'openai',
 *   '/v1/chat/completions',
 *   async () => {
 *     const response = await fetch('https://api.openai.com/v1/chat/completions', {
 *       method: 'POST',
 *       body: JSON.stringify(payload)
 *     });
 *     return response.json();
 *   },
 *   { method: 'POST' }
 * );
 * ```
 */
export async function trackExternalApiCall<T>(
  serviceName: string,
  endpoint: string,
  fn: () => Promise<T>,
  options?: {
    /** HTTP method */
    method?: string;
    /** Whether to submit metrics (default: true) */
    submitMetrics?: boolean;
    /** Expected status code for success logging */
    expectedStatus?: number;
  }
): Promise<ApiCallTimingResult<T>> {
  const { method = 'GET', submitMetrics = true } = options ?? {};
  const startTime = performance.now();
  const timestamp = Date.now();

  try {
    const result = await fn();
    const endTime = performance.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;

    // Try to extract status code from response if it's a Response object
    let statusCode: number | undefined;
    if (result instanceof Response) {
      statusCode = result.status;
    } else if (
      typeof result === 'object' &&
      result !== null &&
      'status' in result &&
      typeof (result as { status: unknown }).status === 'number'
    ) {
      statusCode = (result as { status: number }).status;
    }

    const logData: LogMetadata = {
      serviceName,
      endpoint,
      method,
      statusCode,
      durationMs,
      formattedDuration: formatDuration(durationMs),
      success: true
    };

    if (durationMs >= currentThresholds.slowApiCallMs) {
      apiLogger.warn(`Slow external API call: ${serviceName}${endpoint}`, logData);
    } else {
      apiLogger.debug(`External API call: ${serviceName}${endpoint}`, logData);
    }

    if (submitMetrics) {
      const tags = [
        `service:${serviceName}`,
        `endpoint:${endpoint}`,
        `method:${method}`,
        'source:vibecode-webgui',
        ...(statusCode !== undefined ? [`status:${statusCode}`] : [])
      ];

      void monitoring.submitMetric({
        metric: 'vibecode.external_api.duration',
        value: durationMs,
        tags
      });
    }

    return {
      result,
      serviceName,
      endpoint,
      method,
      statusCode,
      durationMs,
      formattedDuration: formatDuration(durationMs),
      timestamp
    };
  } catch (error) {
    const endTime = performance.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;

    apiLogger.error(`External API call failed: ${serviceName}${endpoint}`, {
      serviceName,
      endpoint,
      method,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    const tags = [
      `service:${serviceName}`,
      `endpoint:${endpoint}`,
      `method:${method}`,
      'source:vibecode-webgui',
      'status:error'
    ];

    if (submitMetrics) {
      void monitoring.submitMetric({
        metric: 'vibecode.external_api.errors',
        value: 1,
        tags
      });
    }

    throw error;
  }
}

/**
 * Create a timed fetch wrapper for external API calls
 *
 * @param serviceName - Name of the external service
 * @param baseUrl - Base URL for the service
 * @returns Fetch wrapper with timing
 *
 * @example
 * ```typescript
 * const openaiClient = createTimedFetch('openai', 'https://api.openai.com');
 *
 * const response = await openaiClient('/v1/models', {
 *   headers: { Authorization: `Bearer ${apiKey}` }
 * });
 * ```
 */
export function createTimedFetch(
  serviceName: string,
  baseUrl: string
): (endpoint: string, init?: RequestInit) => Promise<ApiCallTimingResult<Response>> {
  return async (
    endpoint: string,
    init?: RequestInit
  ): Promise<ApiCallTimingResult<Response>> => {
    const method = init?.method ?? 'GET';
    const fullUrl = `${baseUrl}${endpoint}`;

    return trackExternalApiCall(
      serviceName,
      endpoint,
      async () => fetch(fullUrl, init),
      { method }
    );
  };
}

/**
 * Create an external API timer for manual timing
 *
 * @param serviceName - Name of the external service
 * @param endpoint - API endpoint
 * @param metadata - Additional metadata
 * @returns Performance timer instance
 */
export function createExternalApiTimer(
  serviceName: string,
  endpoint: string,
  metadata?: LogMetadata
): PerformanceTimer {
  return createPerformanceTimer(`api:${serviceName}:${endpoint}`, {
    component: 'external-api',
    serviceName,
    endpoint,
    ...metadata
  });
}

// ============================================================================
// Combined Performance Tracker
// ============================================================================

/**
 * Comprehensive performance tracker that combines timing, memory, and CPU tracking
 *
 * @example
 * ```typescript
 * const tracker = new PerformanceTracker('complex-operation');
 *
 * tracker.checkpoint('started');
 * await performStep1();
 * tracker.checkpoint('step1-complete');
 * await performStep2();
 *
 * const report = tracker.finish();
 * console.log(report);
 * ```
 */
export class PerformanceTracker {
  private readonly name: string;
  private readonly startTime: number;
  private readonly startMemory: MemorySnapshot;
  private readonly startCpu: NodeJS.CpuUsage;
  private readonly checkpoints: Array<{
    name: string;
    time: number;
    memory: MemorySnapshot;
  }> = [];
  private readonly logger = createLogger({ component: 'performance-tracker' });

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
    this.startMemory = getMemorySnapshot();
    this.startCpu = process.cpuUsage();
  }

  /**
   * Record a checkpoint in the operation
   */
  checkpoint(name: string): void {
    const elapsed = performance.now() - this.startTime;
    const memory = getMemorySnapshot();

    this.checkpoints.push({
      name,
      time: elapsed,
      memory
    });

    this.logger.debug(`Checkpoint: ${this.name} - ${name}`, {
      operation: this.name,
      checkpoint: name,
      elapsedMs: Math.round(elapsed * 100) / 100,
      memoryDeltaMB: Math.round(
        (memory.heapUsed - this.startMemory.heapUsed) / 1024 / 1024 * 100
      ) / 100
    });
  }

  /**
   * Finish tracking and generate report
   */
  finish(submitMetrics = true): {
    name: string;
    totalDurationMs: number;
    formattedDuration: string;
    memoryDeltaMB: number;
    cpuUsage: NodeJS.CpuUsage;
    checkpoints: Array<{
      name: string;
      elapsedMs: number;
      deltaMs: number;
      memoryMB: number;
    }>;
  } {
    const endTime = performance.now();
    const endMemory = getMemorySnapshot();
    const cpuUsage = process.cpuUsage(this.startCpu);

    const totalDurationMs = Math.round((endTime - this.startTime) * 100) / 100;
    const memoryDeltaMB = Math.round(
      (endMemory.heapUsed - this.startMemory.heapUsed) / 1024 / 1024 * 100
    ) / 100;

    const checkpointReport = this.checkpoints.map((cp, idx) => ({
      name: cp.name,
      elapsedMs: Math.round(cp.time * 100) / 100,
      deltaMs: idx === 0
        ? Math.round(cp.time * 100) / 100
        : Math.round((cp.time - this.checkpoints[idx - 1].time) * 100) / 100,
      memoryMB: cp.memory.heapUsedMB
    }));

    const report = {
      name: this.name,
      totalDurationMs,
      formattedDuration: formatDuration(totalDurationMs),
      memoryDeltaMB,
      cpuUsage,
      checkpoints: checkpointReport
    };

    this.logger.info(`Performance report: ${this.name}`, {
      ...report,
      cpuUserMicroseconds: cpuUsage.user,
      cpuSystemMicroseconds: cpuUsage.system
    });

    if (submitMetrics) {
      const tags = [`operation:${this.name}`, 'service:vibecode-webgui'];

      void monitoring.submitMetric({
        metric: 'vibecode.operation.duration',
        value: totalDurationMs,
        tags
      });

      void monitoring.submitMetric({
        metric: 'vibecode.operation.memory_delta',
        value: memoryDeltaMB,
        tags
      });

      void monitoring.submitMetric({
        metric: 'vibecode.operation.cpu_user',
        value: cpuUsage.user,
        tags
      });
    }

    return report;
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

// Re-export types and utilities from logging for convenience
export {
  type PerformanceTimer,
  type TimingResult,
  createPerformanceTimer,
  withTiming
};

// Export formatted duration utility
export { formatDuration, formatBytes };
