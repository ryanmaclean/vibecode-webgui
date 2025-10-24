/**
 * Connection Pool Types
 * Type definitions for connection pool management
 */

export interface ConnectionBudget {
  granted: number;
  available: number;
  total: number;
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

export enum PoolStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  DRAINING = 'draining',
  CLOSED = 'closed',
  ERROR = 'error'
}

export interface ManagedConnectionPool {
  name: string;
  status: PoolStatus;
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
