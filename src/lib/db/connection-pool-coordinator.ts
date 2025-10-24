/**
 * Global Connection Pool Coordinator
 * Manages connection pools across the application
 */

import { ConnectionBudget, ManagedConnectionPool } from './connection-pool-types';

class ConnectionPoolCoordinator {
  private pools: Map<string, ManagedConnectionPool> = new Map();
  private totalConnections = 0;
  private maxGlobalConnections = 100;

  registerPool(name: string, pool: ManagedConnectionPool): void {
    this.pools.set(name, pool);
  }

  unregisterPool(name: string): void {
    this.pools.delete(name);
  }

  requestConnectionBudget(poolName: string, requested: number): ConnectionBudget {
    const available = this.maxGlobalConnections - this.totalConnections;
    const granted = Math.min(requested, available);

    return {
      granted,
      available,
      total: this.maxGlobalConnections
    };
  }

  reportConnectionChange(poolName: string, delta: number): void {
    this.totalConnections += delta;
  }

  getGlobalMetrics() {
    return {
      totalPools: this.pools.size,
      totalConnections: this.totalConnections,
      maxConnections: this.maxGlobalConnections
    };
  }
}

let globalCoordinator: ConnectionPoolCoordinator | null = null;

export function getGlobalCoordinator(): ConnectionPoolCoordinator {
  if (!globalCoordinator) {
    globalCoordinator = new ConnectionPoolCoordinator();
  }
  return globalCoordinator;
}
