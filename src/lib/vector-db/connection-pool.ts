/**
 * Vector Database Connection Pool
<<<<<<< HEAD
 * Generic connection pool for vector database adapters with full lifecycle management
=======
 * Generic connection pool for vector database adapters with advanced features
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
 */

import { logger } from '@/lib/logger';
import { metrics } from '@/lib/server-monitoring';

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

interface PoolConnection<T> {
  connection: T;
  isInUse: boolean;
  lastUsed: number;
  createdAt: number;
}

<<<<<<< HEAD
interface AcquireRequest {
  resolve: (connection: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface PoolStats {
=======
export interface PoolStats {
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
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
<<<<<<< HEAD
  private config: Required<ConnectionPoolConfig<T>>;
  private isClosed = false;
  private isClosing = false;
  private waitingQueue: AcquireRequest[] = [];
  private pruneInterval?: NodeJS.Timeout;
  private initializationPromise?: Promise<void>;

  // Stats tracking
=======
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
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalCreated: 0,
    totalAcquired: 0,
    acquireErrors: 0,
<<<<<<< HEAD
    validateErrors: 0,
  };

  constructor(config: ConnectionPoolConfig<T>) {
    // Set defaults
    this.config = {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 10,
      acquireTimeoutMs: config.acquireTimeoutMs ?? 30000,
      maxConnectionLifetimeMs: config.maxConnectionLifetimeMs ?? 3600000,
      connectionRetryDelayMs: config.connectionRetryDelayMs ?? 1000,
      maxConnectionAttempts: config.maxConnectionAttempts ?? 3,
      validateConnection: config.validateConnection ?? true,
      idleTimeoutMs: config.idleTimeoutMs ?? 10000,
      createConnection: config.createConnection,
      validateConnectionFn: config.validateConnectionFn,
      closeConnection: config.closeConnection,
    };

    // Start pool initialization in background
    this.initializationPromise = this.initialize();

    // Start pruning interval
    this.pruneInterval = setInterval(() => {
      this.pruneConnections().catch(err => {
        logger.error('Error pruning connections', err);
      });
    }, 10000); // Prune every 10 seconds
=======
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
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
  }

  private async initialize(): Promise<void> {
    try {
      // Create minimum connections
<<<<<<< HEAD
      const connectionPromises: Promise<void>[] = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        connectionPromises.push(this.createNewConnection());
      }
      await Promise.allSettled(connectionPromises);
    } catch (error) {
      logger.error('Error initializing connection pool', error);
=======
      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        promises.push(this.createNewConnection());
      }
      await Promise.all(promises);
      this.status = PoolStatus.ACTIVE;
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      this.status = PoolStatus.ERRORED;
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    }
  }

  private async createNewConnection(): Promise<void> {
<<<<<<< HEAD
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxConnectionAttempts; attempt++) {
      try {
        const connection = await this.config.createConnection();
        const poolConn: PoolConnection<T> = {
          connection,
          isInUse: false,
          lastUsed: Date.now(),
          createdAt: Date.now(),
        };
        this.connections.push(poolConn);
        this.stats.totalCreated++;
        this.updateStats();
        metrics.gauge('connection_pool.size', this.connections.length);
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Connection attempt ${attempt} failed`, error);

        if (attempt < this.config.maxConnectionAttempts) {
=======
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
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
          await new Promise(resolve => setTimeout(resolve, this.config.connectionRetryDelayMs));
        }
      }
    }

<<<<<<< HEAD
    throw lastError || new Error('Failed to create connection');
  }

  async acquire(): Promise<T> {
    if (this.isClosed) {
      throw new Error('Connection pool is closed');
    }

    if (this.isClosing) {
      throw new Error('Connection pool is closing');
    }

    // Try to find an idle connection
    const idleConnection = await this.findValidIdleConnection();
    if (idleConnection) {
      idleConnection.isInUse = true;
      idleConnection.lastUsed = Date.now();
      this.stats.totalAcquired++;
      this.updateStats();
      metrics.increment('connection_pool.acquired');
      return idleConnection.connection;
    }

    // Create a new connection if we haven't reached max
    if (this.connections.length < this.config.maxConnections) {
      try {
        await this.createNewConnection();
        const newConn = this.connections[this.connections.length - 1];
        newConn.isInUse = true;
        newConn.lastUsed = Date.now();
        this.stats.totalAcquired++;
        this.updateStats();
        metrics.increment('connection_pool.acquired');
        return newConn.connection;
      } catch (error) {
        this.stats.acquireErrors++;
        throw error;
      }
    }

    // Wait for a connection to become available
    return this.waitForConnection();
  }

  private async findValidIdleConnection(): Promise<PoolConnection<T> | null> {
    for (const conn of this.connections) {
      if (!conn.isInUse) {
        // Validate connection if enabled
        if (this.config.validateConnection && this.config.validateConnectionFn) {
          try {
            const isValid = await this.config.validateConnectionFn(conn.connection);
            if (!isValid) {
              this.stats.validateErrors++;
              // Remove invalid connection
              await this.removeConnection(conn);
              // Create a new one
              await this.createNewConnection();
              continue;
            }
          } catch (error) {
            this.stats.validateErrors++;
            logger.warn('Connection validation failed', error);
            await this.removeConnection(conn);
            await this.createNewConnection();
            continue;
          }
        }
        return conn;
      }
    }
    return null;
  }

  private async removeConnection(conn: PoolConnection<T>): Promise<void> {
    const index = this.connections.indexOf(conn);
    if (index !== -1) {
      this.connections.splice(index, 1);
      try {
        await this.config.closeConnection(conn.connection);
      } catch (error) {
        logger.error('Error closing connection', error);
      }
      this.updateStats();
    }
  }

  private waitForConnection(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.waitingQueue.findIndex(r => r.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        this.stats.acquireErrors++;
        this.updateStats();
=======
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
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
        reject(new Error('Timed out waiting for connection'));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({ resolve, reject, timeout });
<<<<<<< HEAD
      this.updateStats();
=======
      this.stats.waitingRequests++;
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });
  }

  async release(connection: T): Promise<void> {
    const poolConn = this.connections.find(c => c.connection === connection);

    if (!poolConn) {
<<<<<<< HEAD
      // Unknown connection - just ignore
      return;
    }

    if (this.isClosed || this.isClosing) {
      // Pool is closed, close the connection
      await this.config.closeConnection(connection);
      return;
    }

    poolConn.isInUse = false;
    poolConn.lastUsed = Date.now();
    this.updateStats();
    metrics.increment('connection_pool.released');

    // Check if anyone is waiting
    if (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift()!;
      clearTimeout(request.timeout);

      poolConn.isInUse = true;
      poolConn.lastUsed = Date.now();
      this.stats.totalAcquired++;
      this.updateStats();
      request.resolve(poolConn.connection);
=======
      // Unknown connection, just ignore
      return;
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
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

<<<<<<< HEAD
  private async pruneConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToRemove: PoolConnection<T>[] = [];

    for (const conn of this.connections) {
      if (conn.isInUse) {
        continue;
      }

      // Check if connection has exceeded max lifetime
      if (now - conn.createdAt > this.config.maxConnectionLifetimeMs) {
        // Keep minimum connections
        if (this.connections.length - connectionsToRemove.length > this.config.minConnections) {
          connectionsToRemove.push(conn);
        }
        continue;
      }

      // Check if connection has been idle too long
      if (now - conn.lastUsed > this.config.idleTimeoutMs) {
        // Keep minimum connections
        if (this.connections.length - connectionsToRemove.length > this.config.minConnections) {
          connectionsToRemove.push(conn);
        }
      }
    }

    // Remove connections
    for (const conn of connectionsToRemove) {
      await this.removeConnection(conn);
    }

    // Ensure we maintain minimum connections
    while (this.connections.length < this.config.minConnections) {
      try {
        await this.createNewConnection();
      } catch (error) {
        logger.error('Failed to create connection during pruning', error);
        break;
      }
    }
  }

  getStats(): PoolStats {
    return { ...this.stats };
  }

  private updateStats(): void {
    this.stats.totalConnections = this.connections.length;
    this.stats.activeConnections = this.connections.filter(c => c.isInUse).length;
    this.stats.idleConnections = this.connections.filter(c => !c.isInUse).length;
    this.stats.waitingRequests = this.waitingQueue.length;

    metrics.gauge('connection_pool.active', this.stats.activeConnections);
    metrics.gauge('connection_pool.idle', this.stats.idleConnections);
    metrics.gauge('connection_pool.waiting', this.stats.waitingRequests);
  }

  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosing = true;

    // Clear pruning interval
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
    }

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift()!;
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool is closing'));
    }

    // Close all connections
    const closePromises = this.connections.map(conn =>
      this.config.closeConnection(conn.connection).catch(err => {
        logger.error('Error closing connection', err);
      })
    );

    await Promise.allSettled(closePromises);

    this.connections = [];
    this.isClosed = true;
    this.updateStats();
    metrics.gauge('connection_pool.size', 0);
=======
  async drain(): Promise<void> {
    this.status = PoolStatus.DRAINING;
    await this.close();
  }

  getStatus(): PoolStatus {
    return this.status;
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
  }
}
