import { PoolStatus, PoolStatusInfo } from '../vector-db/pool-status';

/**
 * Adapter for different pool status formats
 * This is a temporary solution to fix type errors
 */
export function adaptPoolStatus(status: any): PoolStatusInfo {
  return {
    status: PoolStatus.ACTIVE,
    activeConnections: status.inUse || 0,
    idleConnections: status.idleConnections || status.available || 0,
    totalConnections: status.size || 0,
    errors: 0
  };
}