/**
 * Vector Database Pool Status
 * Defines status types for connection pools
 */

export enum PoolStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  DRAINING = 'draining',
  CLOSED = 'closed',
  ERROR = 'error'
}

export interface PoolStatusInfo {
  status: PoolStatus;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  errors: number;
  lastHealthCheck?: Date;
}

export function isPoolHealthy(status: PoolStatusInfo): boolean {
  return status.status === PoolStatus.ACTIVE && status.errors === 0;
}
