import { PoolStatus } from '../vector-db/pool-status';

/**
 * Adapter for different pool status formats
 * This is a temporary solution to fix type errors
 */
export function adaptPoolStatus(status: any): PoolStatus {
  return {
    size: status.size || 0,
    available: status.available || 0,
    inUse: status.inUse || 0,
    maxSize: status.maxSize || 0,
    waitingClients: status.waitingClients || 0,
    idleConnections: status.idleConnections || 0
  };
}