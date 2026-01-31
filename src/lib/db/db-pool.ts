/**
 * Database Connection Pool Management Module
 *
 * Provides centralized connection pool management for database connections using Prisma.
 * Supports dynamic pool sizing, connection validation, and comprehensive metrics tracking.
 *
 * @module db-pool
 *
 * @example
 * ```typescript
 * import { connectionPool, getConnectionPoolStatus } from '@/lib/db/db-pool';
 *
 * // Check pool status
 * const status = getConnectionPoolStatus();
 * console.log(`Pool utilization: ${status.utilization * 100}%`);
 *
 * // Find LRU connection for eviction
 * const lruKey = findLeastRecentlyUsedConnection();
 * ```
 */

import { PrismaClient } from '@prisma/client';
import { ConnectionPoolStatus, DetailedConnectionPoolInfo } from './db-types';

/** Default minimum number of connections in the pool */
const DEFAULT_POOL_MIN = 2;
/** Default maximum number of connections in the pool */
const DEFAULT_POOL_MAX = 10;
/** Default idle timeout in milliseconds (30 seconds) */
const DEFAULT_IDLE_TIMEOUT = 30000;
/** Default connection timeout in milliseconds (10 seconds) */
const DEFAULT_CONNECTION_TIMEOUT = 10000;
/** Default acquire timeout in milliseconds (60 seconds) */
const DEFAULT_ACQUIRE_TIMEOUT = 60000;
/** Default setting for dynamic pool sizing */
const DEFAULT_ENABLE_DYNAMIC_SIZING = true;
/** Default setting for connection validation */
const DEFAULT_ENABLE_CONNECTION_VALIDATION = true;

/**
 * Parses an environment variable as an integer with a fallback default value.
 *
 * @param value - The environment variable value to parse
 * @param defaultValue - The default value to use if parsing fails or value is undefined
 * @returns The parsed integer or the default value
 *
 * @example
 * ```typescript
 * const poolSize = parseEnvInt(process.env.DB_POOL_MAX, 10);
 * ```
 */
const parseEnvInt = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parses an environment variable as a boolean with a fallback default value.
 * Recognizes 'true' (case-insensitive) and '1' as truthy values.
 *
 * @param value - The environment variable value to parse
 * @param defaultValue - The default value to use if value is undefined
 * @returns The parsed boolean or the default value
 *
 * @example
 * ```typescript
 * const enableValidation = parseEnvBool(process.env.DB_POOL_ENABLE_VALIDATION, true);
 * ```
 */
const parseEnvBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

const resolvePoolMin = () =>
  parseEnvInt(process.env.DB_POOL_MIN ?? process.env.DATABASE_POOL_MIN, DEFAULT_POOL_MIN);

const resolvePoolMax = () =>
  parseEnvInt(
    process.env.DB_POOL_MAX ?? process.env.DATABASE_POOL_MAX ?? process.env.DATABASE_POOL_SIZE,
    DEFAULT_POOL_MAX
  );

/**
 * Connection pool configuration loaded from environment variables.
 * All values have sensible defaults if environment variables are not set.
 *
 * @property minSize - Minimum number of connections (DB_POOL_MIN or DATABASE_POOL_MIN, default: 2)
 * @property maxSize - Maximum number of connections (DB_POOL_MAX, DATABASE_POOL_MAX, or DATABASE_POOL_SIZE, default: 10)
 * @property idleTimeout - Time in ms before idle connections are closed (DB_POOL_IDLE_TIMEOUT, default: 30000)
 * @property connectionTimeout - Time in ms to wait for a connection (DB_POOL_CONNECTION_TIMEOUT, default: 10000)
 * @property acquireTimeout - Time in ms to wait when acquiring from pool (DB_POOL_ACQUIRE_TIMEOUT, default: 60000)
 * @property enableDynamicSizing - Whether to dynamically adjust pool size (DB_POOL_ENABLE_DYNAMIC_SIZING, default: true)
 * @property enableConnectionValidation - Whether to validate connections before use (DB_POOL_ENABLE_CONNECTION_VALIDATION, default: true)
 */
export const poolConfig = {
  minSize: resolvePoolMin(),
  maxSize: resolvePoolMax(),
  idleTimeout: parseEnvInt(process.env.DB_POOL_IDLE_TIMEOUT, DEFAULT_IDLE_TIMEOUT),
  connectionTimeout: parseEnvInt(process.env.DB_POOL_CONNECTION_TIMEOUT, DEFAULT_CONNECTION_TIMEOUT),
  acquireTimeout: parseEnvInt(process.env.DB_POOL_ACQUIRE_TIMEOUT, DEFAULT_ACQUIRE_TIMEOUT),
  enableDynamicSizing: parseEnvBool(process.env.DB_POOL_ENABLE_DYNAMIC_SIZING, DEFAULT_ENABLE_DYNAMIC_SIZING),
  enableConnectionValidation: parseEnvBool(process.env.DB_POOL_ENABLE_CONNECTION_VALIDATION, DEFAULT_ENABLE_CONNECTION_VALIDATION),
};

/**
 * Connection pool state and metrics tracking object.
 * Maintains the state of all database connections and usage statistics.
 *
 * @property clients - Map of connection keys to PrismaClient instances
 * @property maxSize - Maximum allowed connections in the pool
 * @property minSize - Minimum connections to maintain in the pool
 * @property inUse - Number of connections currently in use
 * @property waitingAcquires - Number of requests waiting for a connection
 * @property lastValidated - Map of connection keys to their last validation timestamp
 * @property lastUsed - Map of connection keys to their last usage timestamp
 * @property creationTimes - Map of connection keys to their creation timestamp
 * @property usage - Aggregate usage metrics for monitoring and debugging
 */
export const connectionPool: {
  clients: Map<string, PrismaClient>;
  maxSize: number;
  minSize: number;
  inUse: number;
  inUseConnections: Map<string, number>; // Track usage count per connection
  waitingAcquires: number;
  lastValidated: Map<string, number>;
  lastUsed: Map<string, number>;
  creationTimes: Map<string, number>;
  usage: {
    totalConnections: number;
    peakConnections: number;
    totalAcquires: number;
    acquireSuccesses: number;
    acquireFailures: number;
    acquireTimeTotal: number;
    acquireTimeAvg: number;
    connectionValidations: number;
    connectionValidationFailures: number;
    dynamicPoolAdjustments: number;
    peakWaitingAcquires: number;
  };
} = {
  clients: new Map(),
  maxSize: poolConfig.maxSize,
  minSize: poolConfig.minSize,
  inUse: 0,
  inUseConnections: new Map(),
  waitingAcquires: 0,
  lastValidated: new Map(),
  lastUsed: new Map(),
  creationTimes: new Map(),
  usage: {
    totalConnections: 0,
    peakConnections: 0,
    totalAcquires: 0,
    acquireSuccesses: 0,
    acquireFailures: 0,
    acquireTimeTotal: 0,
    acquireTimeAvg: 0,
    connectionValidations: 0,
    connectionValidationFailures: 0,
    dynamicPoolAdjustments: 0,
    peakWaitingAcquires: 0,
  }
};

/**
 * Increments the waiting acquires counter when a request is waiting for a connection.
 * Also updates the peak waiting acquires metric if the current value exceeds the previous peak.
 *
 * @returns void
 *
 * @example
 * ```typescript
 * // Before attempting to acquire a connection
 * incrementWaitingAcquires();
 * try {
 *   const connection = await acquireConnection();
 * } finally {
 *   decrementWaitingAcquires();
 * }
 * ```
 */
export function incrementWaitingAcquires(): void {
  connectionPool.waitingAcquires++;
  if (connectionPool.waitingAcquires > connectionPool.usage.peakWaitingAcquires) {
    connectionPool.usage.peakWaitingAcquires = connectionPool.waitingAcquires;
  }
}

/**
 * Decrements the waiting acquires counter when a connection is acquired or the request times out.
 * Ensures the counter does not go below zero.
 *
 * @returns void
 *
 * @example
 * ```typescript
 * // After successfully acquiring a connection or on timeout
 * decrementWaitingAcquires();
 * ```
 */
export function decrementWaitingAcquires(): void {
  if (connectionPool.waitingAcquires > 0) {
    connectionPool.waitingAcquires--;
  }
}

/**
 * Gets the current number of requests waiting to acquire a connection from the pool.
 *
 * @returns The number of pending connection acquisition requests
 *
 * @example
 * ```typescript
 * const waiting = getWaitingAcquires();
 * if (waiting > 10) {
 *   console.warn('High connection contention detected');
 * }
 * ```
 */
export function getWaitingAcquires(): number {
  return connectionPool.waitingAcquires;
}

/**
 * Finds the least recently used (LRU) connection that is not currently in use.
 * Used for connection eviction when the pool needs to be reduced or when idle
 * connections should be cleaned up.
 *
 * @returns The key of the least recently used connection, or null if no eligible connection is found
 *
 * @example
 * ```typescript
 * const lruConnectionKey = findLeastRecentlyUsedConnection();
 * if (lruConnectionKey) {
 *   await evictConnection(lruConnectionKey);
 * }
 * ```
 */
export function findLeastRecentlyUsedConnection(): string | null {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, lastUsedTime] of connectionPool.lastUsed.entries()) {
    // Skip connections that are currently in use (check per-connection state)
    if ((connectionPool.inUseConnections.get(key) || 0) > 0) {
      continue;
    }

    if (lastUsedTime < oldestTime) {
      oldestTime = lastUsedTime;
      oldestKey = key;
    }
  }

  return oldestKey;
}

/**
 * Mark a connection as in use.
 */
export function markConnectionInUse(key: string): void {
  const currentCount = connectionPool.inUseConnections.get(key) || 0;
  connectionPool.inUseConnections.set(key, currentCount + 1);
  if (currentCount === 0) {
    connectionPool.inUse += 1;
  }
  connectionPool.lastUsed.set(key, Date.now());

  // Update peak connections
  if (connectionPool.inUse > connectionPool.usage.peakConnections) {
    connectionPool.usage.peakConnections = connectionPool.inUse;
  }
}

/**
 * Mark a connection as released/available.
 */
export function markConnectionReleased(key: string): void {
  const currentCount = connectionPool.inUseConnections.get(key) || 0;
  if (currentCount <= 1) {
    connectionPool.inUseConnections.delete(key);
    connectionPool.inUse = Math.max(0, connectionPool.inUse - 1);
    connectionPool.lastUsed.set(key, Date.now());
    return;
  }

  connectionPool.inUseConnections.set(key, currentCount - 1);
}

/**
 * Check if a specific connection is currently in use.
 */
export function isConnectionInUse(key: string): boolean {
  return (connectionPool.inUseConnections.get(key) || 0) > 0;
}

/**
 * Gets the current status of the connection pool including configuration and metrics.
 * Useful for monitoring, health checks, and debugging connection issues.
 *
 * @returns A ConnectionPoolStatus object containing:
 *   - size: Current number of connections in the pool
 *   - inUse: Number of connections currently being used
 *   - maxSize: Maximum allowed connections
 *   - minSize: Minimum connections to maintain
 *   - available: Number of connections that can still be created
 *   - utilization: Ratio of in-use connections to total connections (0-1)
 *   - configuration: Pool configuration settings
 *   - metrics: Aggregate usage statistics
 *
 * @example
 * ```typescript
 * const status = getConnectionPoolStatus();
 * console.log(`Pool: ${status.size}/${status.maxSize} connections`);
 * console.log(`Utilization: ${(status.utilization * 100).toFixed(1)}%`);
 * console.log(`Avg acquire time: ${status.metrics.acquireTimeAvg}ms`);
 * ```
 */
export function getConnectionPoolStatus(): ConnectionPoolStatus {
  return {
    size: connectionPool.clients.size,
    inUse: connectionPool.inUse,
    maxSize: connectionPool.maxSize,
    minSize: connectionPool.minSize,
    available: connectionPool.maxSize - connectionPool.clients.size,
    utilization: connectionPool.clients.size > 0 ? connectionPool.inUse / connectionPool.clients.size : 0,
    configuration: {
      idleTimeout: poolConfig.idleTimeout,
      connectionTimeout: poolConfig.connectionTimeout,
      acquireTimeout: poolConfig.acquireTimeout,
      enableDynamicSizing: poolConfig.enableDynamicSizing,
      enableConnectionValidation: poolConfig.enableConnectionValidation,
    },
    metrics: {
      totalConnections: connectionPool.usage.totalConnections,
      peakConnections: connectionPool.usage.peakConnections,
      totalAcquires: connectionPool.usage.totalAcquires,
      acquireSuccesses: connectionPool.usage.acquireSuccesses,
      acquireFailures: connectionPool.usage.acquireFailures,
      acquireTimeAvg: connectionPool.usage.acquireTimeAvg,
      connectionValidations: connectionPool.usage.connectionValidations,
      connectionValidationFailures: connectionPool.usage.connectionValidationFailures,
      dynamicPoolAdjustments: connectionPool.usage.dynamicPoolAdjustments,
    }
  };
}

/**
 * Gets detailed information about the connection pool including per-connection details.
 * Provides comprehensive data for advanced debugging and monitoring scenarios.
 *
 * @returns A DetailedConnectionPoolInfo object containing:
 *   - status: The standard connection pool status
 *   - connections: Array of per-connection details sorted by age (oldest first)
 *     - key: Unique identifier for the connection
 *     - ageMs: Time since connection was created in milliseconds
 *     - idleTimeMs: Time since connection was last used in milliseconds
 *     - timeSinceValidationMs: Time since connection was last validated in milliseconds
 *     - inUse: Whether the connection is currently in use
 *
 * @example
 * ```typescript
 * const info = getDetailedConnectionPoolInfo();
 *
 * // Find connections idle for more than 5 minutes
 * const staleConnections = info.connections.filter(
 *   conn => conn.idleTimeMs > 5 * 60 * 1000
 * );
 *
 * // Log oldest connection
 * if (info.connections.length > 0) {
 *   console.log(`Oldest connection age: ${info.connections[0].ageMs}ms`);
 * }
 * ```
 */
export function getDetailedConnectionPoolInfo(): DetailedConnectionPoolInfo {
  const now = Date.now();
  const status = getConnectionPoolStatus();
  const connections: {
    key: string;
    ageMs: number;
    idleTimeMs: number;
    timeSinceValidationMs: number;
    inUse: boolean;
  }[] = [];

  // Collect details for each connection
  for (const key of connectionPool.clients.keys()) {
    const creationTime = connectionPool.creationTimes.get(key) || now;
    const lastUsedTime = connectionPool.lastUsed.get(key) || creationTime;
    const lastValidatedTime = connectionPool.lastValidated.get(key) || creationTime;
    const inUse = (connectionPool.inUseConnections.get(key) || 0) > 0;

    connections.push({
      key,
      ageMs: now - creationTime,
      idleTimeMs: inUse ? 0 : now - lastUsedTime,
      timeSinceValidationMs: now - lastValidatedTime,
      inUse
    });
  }

  // Sort by age (oldest first)
  connections.sort((a, b) => b.ageMs - a.ageMs);

  return {
    status,
    connections
  };
}
