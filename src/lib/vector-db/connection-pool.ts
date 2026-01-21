/**
 * Vector Database Connection Pool
 * Generic connection pool for vector database adapters with advanced features
 */

import { PoolStatus } from './pool-status';

export interface ConnectionPoolConfig<T> {
  minConnections?: number;
  maxConnections?: number;
  acquireTimeoutMs?: number;
  maxConnectionLifetimeMs?: number;
  connectionRetryDelayMs?: number;
  maxConnectionAttempts?: number;
  validateConnection?: boolean;
  idleTimeoutMs?: number;
  createConnection: () => Promise<T>;
  validateConnectionFn?: (conn: T) => Promise<boolean>;
  closeConnection: (conn: T) => Promise<void>;
}

export interface PoolConnection<T> {
  connection: T;
  isInUse: boolean;
  lastUsed: number;
  createdAt: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalCreated: number;
  totalAcquired: number;
  acquireErrors: number;
  validateErrors: number;
}

export class ConnectionPool<T> {
  private connections: PoolConnection<T>[] = [];
  private config: Required<Omit<ConnectionPoolConfig<T>, 'validateConnectionFn'>>;
  private validateConnectionFn?: (conn: T) => Promise<boolean>;
  private status: PoolStatus = PoolStatus.INITIALIZING;
  private waitingQueue: Array<{
    resolve: (conn: T) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private pruneInterval?: NodeJS.Timeout;

  // Statistics
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalCreated: 0,
    totalAcquired: 0,
    acquireErrors: 0,
    validateErrors: 0
  };

  constructor(config: ConnectionPoolConfig<T>) {
    // Apply defaults
    this.config = {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 10,
      acquireTimeoutMs: config.acquireTimeoutMs ?? 5000,
      maxConnectionLifetimeMs: config.maxConnectionLifetimeMs ?? 60000,
      connectionRetryDelayMs: config.connectionRetryDelayMs ?? 500,
      maxConnectionAttempts: config.maxConnectionAttempts ?? 3,
      validateConnection: config.validateConnection ?? false,
      idleTimeoutMs: config.idleTimeoutMs ?? 30000,
      createConnection: config.createConnection,
      closeConnection: config.closeConnection
    };

    this.validateConnectionFn = config.validateConnectionFn;

    // Initialize pool
    this.initialize();

    // Start pruning idle connections
    this.startPruning();
  }

  private async initialize(): Promise<void> {
    try {
      // Create minimum connections
      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        promises.push(this.createNewConnection());
      }
      await Promise.all(promises);
      this.status = PoolStatus.ACTIVE;
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      this.status = PoolStatus.ERROR;
    }
  }

  private async createNewConnection(): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.maxConnectionAttempts) {
      try {
        const conn = await this.config.createConnection();
        this.connections.push({
          connection: conn,
          isInUse: false,
          lastUsed: Date.now(),
          createdAt: Date.now()
        });
        this.stats.totalCreated++;
        this.stats.totalConnections++;
        this.stats.idleConnections++;
        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;
        if (attempts < this.config.maxConnectionAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.connectionRetryDelayMs));
        }
      }
    }

    throw lastError || new Error('Failed to create connection after max attempts');
  }

  async acquire(): Promise<T> {
    if (this.status === PoolStatus.CLOSED) {
      this.stats.acquireErrors++;
      throw new Error('Connection pool is closed');
    }

    this.stats.totalAcquired++;

    // Try to get an available connection
    const availableConn = this.connections.find(c => !c.isInUse);

    if (availableConn) {
      // Validate if needed
      if (this.config.validateConnection && this.validateConnectionFn) {
        const isValid = await this.validateConnectionFn(availableConn.connection);
        if (!isValid) {
          this.stats.validateErrors++;
          // Close invalid connection
          await this.config.closeConnection(availableConn.connection);
          const index = this.connections.indexOf(availableConn);
          this.connections.splice(index, 1);
          this.stats.totalConnections--;
          this.stats.idleConnections--;

          // Create a new one
          await this.createNewConnection();

          // Try again
          return this.acquire();
        }
      }

      availableConn.isInUse = true;
      availableConn.lastUsed = Date.now();
      this.stats.activeConnections++;
      this.stats.idleConnections--;
      return availableConn.connection;
    }

    // Try to create a new connection if we haven't reached max
    if (this.connections.length < this.config.maxConnections) {
      await this.createNewConnection();
      const newConn = this.connections[this.connections.length - 1];
      newConn.isInUse = true;
      newConn.lastUsed = Date.now();
      this.stats.activeConnections++;
      this.stats.idleConnections--;
      return newConn.connection;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
        }
        this.stats.acquireErrors++;
        reject(new Error('Timed out waiting for connection'));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({ resolve, reject, timeout });
      this.stats.waitingRequests++;
    });
  }

  async release(connection: T): Promise<void> {
    const poolConn = this.connections.find(c => c.connection === connection);

    if (!poolConn) {
      // Unknown connection, just ignore
      return;
    }

    if (this.status === PoolStatus.CLOSED || this.status === PoolStatus.DRAINING) {
      // Close the connection if pool is closed
      await this.config.closeConnection(connection);
      const index = this.connections.indexOf(poolConn);
      this.connections.splice(index, 1);
      this.stats.totalConnections--;
      this.stats.activeConnections--;
      return;
    }

    poolConn.isInUse = false;
    poolConn.lastUsed = Date.now();
    this.stats.activeConnections--;
    this.stats.idleConnections++;

    // Check if anyone is waiting
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        this.stats.waitingRequests--;

        poolConn.isInUse = true;
        this.stats.activeConnections++;
        this.stats.idleConnections--;
        waiter.resolve(connection);
      }
    }
  }

  getStats(): PoolStats {
    return {
      ...this.stats,
      totalConnections: this.connections.length,
      activeConnections: this.connections.filter(c => c.isInUse).length,
      idleConnections: this.connections.filter(c => !c.isInUse).length,
      waitingRequests: this.waitingQueue.length
    };
  }

  private startPruning(): void {
    this.pruneInterval = setInterval(() => {
      this.pruneConnections();
    }, Math.min(this.config.idleTimeoutMs, this.config.maxConnectionLifetimeMs) / 2);
  }

  private async pruneConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: PoolConnection<T>[] = [];

    for (const conn of this.connections) {
      if (conn.isInUse) continue;

      const idleTime = now - conn.lastUsed;
      const lifetime = now - conn.createdAt;

      // Remove if idle too long or lifetime exceeded, but keep minimum connections
      if ((idleTime > this.config.idleTimeoutMs || lifetime > this.config.maxConnectionLifetimeMs) &&
          this.connections.length > this.config.minConnections) {
        connectionsToRemove.push(conn);
      }
    }

    for (const conn of connectionsToRemove) {
      await this.config.closeConnection(conn.connection);
      const index = this.connections.indexOf(conn);
      this.connections.splice(index, 1);
      this.stats.totalConnections--;
      this.stats.idleConnections--;
    }

    // Ensure we have minimum connections
    while (this.connections.length < this.config.minConnections) {
      try {
        await this.createNewConnection();
      } catch (error) {
        console.error('Failed to maintain minimum connections:', error);
        break;
      }
    }
  }

  async close(): Promise<void> {
    if (this.status === PoolStatus.CLOSED) {
      return; // Already closed
    }

    this.status = PoolStatus.CLOSED;

    // Clear pruning interval
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Connection pool is closing'));
    }
    this.waitingQueue = [];
    this.stats.waitingRequests = 0;

    // Close all connections
    await Promise.all(
      this.connections.map(c => this.config.closeConnection(c.connection))
    );

    this.connections = [];
    this.stats.totalConnections = 0;
    this.stats.activeConnections = 0;
    this.stats.idleConnections = 0;
  }

  async drain(): Promise<void> {
    this.status = PoolStatus.DRAINING;
    await this.close();
  }

  getStatus(): PoolStatus {
    return this.status;
  }
}
