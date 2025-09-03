/**
 * Pool status for vector database connections
 */
export interface PoolStatus {
  size: number;
  available: number;
  inUse: number;
  maxSize: number;
  waitingClients: number;
  idleConnections: number;
}