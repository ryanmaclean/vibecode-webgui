/**
 * Vector Database Connection Pool
 * Generic connection pool for vector database adapters
 */

import { PoolStatus } from './pool-status';

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  validationIntervalMs?: number;
}

export interface PoolConnection<T> {
  connection: T;
  isInUse: boolean;
  lastUsed: number;
  createdAt: number;
}

export class ConnectionPool<T> {
  private connections: PoolConnection<T>[] = [];
  private config: ConnectionPoolConfig;
  private status: PoolStatus = PoolStatus.INITIALIZING;

  constructor(
    config: ConnectionPoolConfig,
    private createConnection: () => Promise<T>,
    private validateConnection?: (conn: T) => Promise<boolean>,
    private destroyConnection?: (conn: T) => Promise<void>
  ) {
    this.config = config;
  }

  async acquire(): Promise<T> {
    // Find available connection or create new one
    const availableConn = this.connections.find(c => !c.isInUse);

    if (availableConn) {
      availableConn.isInUse = true;
      availableConn.lastUsed = Date.now();
      return availableConn.connection;
    }

    if (this.connections.length < this.config.max) {
      const newConn = await this.createConnection();
      const poolConn: PoolConnection<T> = {
        connection: newConn,
        isInUse: true,
        lastUsed: Date.now(),
        createdAt: Date.now()
      };
      this.connections.push(poolConn);
      return newConn;
    }

    throw new Error('Connection pool exhausted');
  }

  async release(connection: T): Promise<void> {
    const poolConn = this.connections.find(c => c.connection === connection);
    if (poolConn) {
      poolConn.isInUse = false;
      poolConn.lastUsed = Date.now();
    }
  }

  async drain(): Promise<void> {
    this.status = PoolStatus.DRAINING;
    // Wait for all connections to be released
    await this.close();
  }

  async close(): Promise<void> {
    if (this.destroyConnection) {
      await Promise.all(
        this.connections.map(c => this.destroyConnection!(c.connection))
      );
    }
    this.connections = [];
    this.status = PoolStatus.CLOSED;
  }

  getStatus(): PoolStatus {
    return this.status;
  }
}
