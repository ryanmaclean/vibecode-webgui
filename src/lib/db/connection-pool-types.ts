/**
 * Connection Pool Types
 * Type definitions for connection pool management
 */

export interface ConnectionBudget {
  granted: number;
  available: number;
  total: number;
}

/**
 * Extended connection budget for pool configuration
 */
export interface PoolConnectionBudget {
  min: number;
  max: number;
  priority: number;
  canBorrow: boolean;
  borrowed: number;
}

export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  acquiredConnections: number;
  pendingAcquires: number;
  errors: number;
  averageAcquireTime: number;
  averageHoldTime: number;
  poolSize?: number;
  waitingClients?: number;
  totalTimeouts?: number;
}

export enum PoolState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  DRAINING = 'draining',
  CLOSED = 'closed',
  ERROR = 'error'
}

// Keep PoolStatus as alias for backward compatibility
export type PoolStatus = PoolState;
export const PoolStatus = PoolState;

export interface PoolStatusInfo {
  name: string;
  size: number;
  available: number;
  inUse: number;
  maxSize: number;
  minSize: number;
  utilization: number;
  waitingClients: number;
  idleConnections: number;
  lastHealthCheck: Date;
}

export interface ManagedConnectionPool {
  name: string;
  status: PoolState;
  getMetrics(): PoolMetrics;
  drain(): Promise<void>;
  close(): Promise<void>;
}

export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  validationIntervalMs?: number;
}
