// Database connection pool management
// Provides centralized connection pool management for database connections

import { PrismaClient } from '@prisma/client';
import { ConnectionPoolStatus, DetailedConnectionPoolInfo } from './db-types';

// Load environment variables with defaults
const DEFAULT_POOL_MIN = 2;
const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT = 30000; // 30 seconds
const DEFAULT_CONNECTION_TIMEOUT = 10000; // 10 seconds
const DEFAULT_ACQUIRE_TIMEOUT = 60000; // 60 seconds
const DEFAULT_ENABLE_DYNAMIC_SIZING = true;
const DEFAULT_ENABLE_CONNECTION_VALIDATION = true;

// Parse environment variables with fallbacks
const parseEnvInt = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseEnvBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

// Connection pool configuration from environment
export const poolConfig = {
  minSize: parseEnvInt(process.env.DB_POOL_MIN, DEFAULT_POOL_MIN),
  maxSize: parseEnvInt(process.env.DB_POOL_MAX, DEFAULT_POOL_MAX),
  idleTimeout: parseEnvInt(process.env.DB_POOL_IDLE_TIMEOUT, DEFAULT_IDLE_TIMEOUT),
  connectionTimeout: parseEnvInt(process.env.DB_POOL_CONNECTION_TIMEOUT, DEFAULT_CONNECTION_TIMEOUT),
  acquireTimeout: parseEnvInt(process.env.DB_POOL_ACQUIRE_TIMEOUT, DEFAULT_ACQUIRE_TIMEOUT),
  enableDynamicSizing: parseEnvBool(process.env.DB_POOL_ENABLE_DYNAMIC_SIZING, DEFAULT_ENABLE_DYNAMIC_SIZING),
  enableConnectionValidation: parseEnvBool(process.env.DB_POOL_ENABLE_CONNECTION_VALIDATION, DEFAULT_ENABLE_CONNECTION_VALIDATION),
};

// Connection pool tracking
export const connectionPool: {
  clients: Map<string, PrismaClient>;
  maxSize: number;
  minSize: number;
  inUse: number;
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
  };
} = {
  clients: new Map(),
  maxSize: poolConfig.maxSize,
  minSize: poolConfig.minSize,
  inUse: 0,
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
  }
};

/**
 * Find the least recently used connection
 */
export function findLeastRecentlyUsedConnection(): string | null {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  
  for (const [key, lastUsedTime] of connectionPool.lastUsed.entries()) {
    // Skip connections that are currently in use
    if (connectionPool.inUse > 0) {
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
 * Get connection pool status
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
 * Get detailed connection pool information
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
    
    connections.push({
      key,
      ageMs: now - creationTime,
      idleTimeMs: now - lastUsedTime,
      timeSinceValidationMs: now - lastValidatedTime,
      inUse: false // We don't track per-connection usage, so this is always false currently
    });
  }
  
  // Sort by age (oldest first)
  connections.sort((a, b) => b.ageMs - a.ageMs);
  
  return {
    status,
    connections
  };
}