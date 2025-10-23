/**
 * Connection Pool for Vector Database Adapters
 * Provides connection pooling functionality for database connections
 */

import { metrics } from '../server-monitoring';
// import { logger } from '../logger';

/**
 * Configuration for connection pool
 */
export interface ConnectionPoolConfig {
  /**
   * Minimum number of connections to keep in the pool
   * Default: 2
   */
  minConnections?: number;

  /**
   * Maximum number of connections allowed in the pool
   * Default: 10
   */
  maxConnections?: number;

  /**
   * Acquire timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  acquireTimeoutMs?: number;

  /**
   * Maximum lifetime of a connection in milliseconds
   * Default: 3600000 (1 hour)
   */
  maxConnectionLifetimeMs?: number;

  /**
   * Time to wait between connection attempts in milliseconds
   * Default: 500
   */
  connectionRetryDelayMs?: number;

  /**
   * Maximum number of connection attempts
   * Default: 3
   */
  maxConnectionAttempts?: number;

  /**
   * Whether to validate connections before use
   * Default: true
   */
  validateConnection?: boolean;

  /**
   * Timeout for idle connections in milliseconds
   * Default: 300000 (5 minutes)
   */
  idleTimeoutMs?: number;

  /**
   * Function to create a new connection
   */
  createConnection: () => Promise<any>;

  /**
   * Function to validate a connection
   */
  validateConnectionFn?: (connection: any) => Promise<boolean>;

  /**
   * Function to close a connection
   */
  closeConnection: (connection: any) => Promise<void>;
}

/**
 * Connection with metadata
 */
interface PoolConnection<T> {
  connection: T;
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
  id: string;
}

/**
 * Generic connection pool implementation
 */
export class ConnectionPool<T> {
  private pool: PoolConnection<T>[] = [];
  private waiting: Array<{
    resolve: (connection: T) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = [];
  private config: Required<ConnectionPoolConfig>;
  private pruneTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private activeConnections = 0;
  private totalCreated = 0;
  private totalAcquired = 0;
  private acquireErrors = 0;
  private validateErrors = 0;

  /**
   * Default configuration
   */
  private static readonly DEFAULT_CONFIG: Partial<ConnectionPoolConfig> = {
    minConnections: 2,
    maxConnections: 10,
    acquireTimeoutMs: 30000,
    maxConnectionLifetimeMs: 3600000,
    connectionRetryDelayMs: 500,
    maxConnectionAttempts: 3,
    validateConnection: true,
    idleTimeoutMs: 300000
  };

  /**
   * Create a new connection pool
   */
  constructor(config: ConnectionPoolConfig) {
    this.config = {
      ...ConnectionPool.DEFAULT_CONFIG,
      ...config
    } as Required<ConnectionPoolConfig>;

    // Start pruning timer
    this.startPruneTimer();

    // Initialize minimum connections
    this.initializeMinConnections();
  }

  /**
   * Initialize minimum connections
   */
  private async initializeMinConnections(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Create initial connections
      const initialConnections = Math.min(this.config.minConnections, this.config.maxConnections);
      
      console.log(`Initializing connection pool with ${initialConnections} connections`);
      
      const connectionPromises = Array(initialConnections)
        .fill(0)
        .map(() => this.createNewConnection());
      
      // Wait for all connections to be created
      await Promise.all(connectionPromises);
      
      console.log(`Connection pool initialized with ${this.pool.length} connections`, {
        duration: Date.now() - startTime
      });
    } catch (error) {
      console.error('Failed to initialize minimum connections in pool', { error });
    }
  }

  /**
   * Start the prune timer
   */
  private startPruneTimer(): void {
    // Clear any existing timer
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }
    
    // Create new prune timer (runs every minute)
    this.pruneTimer = setInterval(() => {
      this.pruneConnections();
    }, 60000);
    
    // Make sure timer doesn't prevent process exit
    if (this.pruneTimer.unref) {
      this.pruneTimer.unref();
    }
  }

  /**
   * Prune idle and expired connections
   */
  private async pruneConnections(): Promise<void> {
    if (this.closed) return;
    
    const now = Date.now();
    const idleThreshold = this.config.idleTimeoutMs;
    const lifetimeThreshold = this.config.maxConnectionLifetimeMs;
    let prunedCount = 0;
    
    // Identify connections to prune
    const connectionsToPrune: PoolConnection<T>[] = [];
    
    for (const conn of this.pool) {
      // Skip connections in use
      if (conn.inUse) continue;
      
      // Check if connection is idle for too long
      const idleTime = now - conn.lastUsed;
      
      // Check if connection has exceeded max lifetime
      const lifetime = now - conn.createdAt;
      
      // Prune if idle for too long or exceeded lifetime
      // But always keep at least minConnections
      if ((idleTime > idleThreshold || lifetime > lifetimeThreshold) && 
          this.pool.length - connectionsToPrune.length > this.config.minConnections) {
        connectionsToPrune.push(conn);
        prunedCount++;
      }
    }
    
    // Close and remove pruned connections
    for (const conn of connectionsToPrune) {
      try {
        // Remove from pool
        this.pool = this.pool.filter(c => c.id !== conn.id);
        
        // Close connection
        await this.config.closeConnection(conn.connection);
        
        // Update metrics
        metrics.gauge('vector_db.pool.connections', this.pool.length);
      } catch (error) {
        console.error('Error closing pruned connection', { 
          connectionId: conn.id,
          error 
        });
      }
    }
    
    if (prunedCount > 0) {
      console.log(`Pruned ${prunedCount} connections from pool`, {
        remaining: this.pool.length,
        minRequired: this.config.minConnections
      });
    }
  }

  /**
   * Create a new connection
   */
  private async createNewConnection(): Promise<PoolConnection<T>> {
    if (this.closed) {
      throw new Error('Connection pool is closed');
    }
    
    // Enforce maximum connections
    if (this.pool.length >= this.config.maxConnections) {
      throw new Error(`Maximum pool size (${this.config.maxConnections}) reached`);
    }
    
    let attempts = 0;
    let lastError: Error | null = null;
    
    // Try to create connection with retries
    while (attempts < this.config.maxConnectionAttempts) {
      try {
        const startTime = Date.now();
        
        // Attempt to create new connection
        const connection = await this.config.createConnection();
        
        // Create connection object with metadata
        const pooledConnection: PoolConnection<T> = {
          connection,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          inUse: false,
          id: `conn-${Date.now()}-${this.totalCreated++}`
        };
        
        // Add to pool
        this.pool.push(pooledConnection);
        
        // Update metrics
        metrics.increment('vector_db.pool.connections');
        metrics.histogram('vector_db.pool.connection_create_time', Date.now() - startTime);
        
        console.log('Created new connection in pool', { 
          connectionId: pooledConnection.id,
          poolSize: this.pool.length 
        });
        
        return pooledConnection;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update metrics
        metrics.increment('vector_db.pool.connection_errors');
        
        // Log the error
        console.warn('Failed to create connection, retrying...', { 
          attempt: attempts + 1,
          maxAttempts: this.config.maxConnectionAttempts,
          error: lastError
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.connectionRetryDelayMs));
        
        attempts++;
      }
    }
    
    // Throw error if all attempts failed
    throw lastError || new Error('Failed to create connection after multiple attempts');
  }

  /**
   * Acquire a connection from the pool
   */
  public async acquire(): Promise<T> {
    if (this.closed) {
      throw new Error('Connection pool is closed');
    }
    
    const startTime = Date.now();
    
    try {
      // First try to get an existing idle connection
      const idleConnection = this.pool.find(conn => !conn.inUse);
      
      if (idleConnection) {
        return await this.validateAndAcquire(idleConnection);
      }
      
      // If pool not at max size, create a new connection
      if (this.pool.length < this.config.maxConnections) {
        try {
          const newConn = await this.createNewConnection();
          return await this.validateAndAcquire(newConn);
        } catch (error) {
          // If creation fails, we'll wait for an existing connection
          console.warn('Failed to create new connection, waiting for existing one', { error });
        }
      }
      
      // Otherwise wait for a connection to become available
      return await this.waitForConnection(startTime);
    } catch (error) {
      // Update metrics
      this.acquireErrors++;
      metrics.increment('vector_db.pool.acquire_errors');
      
      console.error('Error acquiring connection from pool', { error });
      throw error;
    }
  }

  /**
   * Validate and acquire a connection
   */
  private async validateAndAcquire(pooledConnection: PoolConnection<T>): Promise<T> {
    // Mark as in use
    pooledConnection.inUse = true;
    pooledConnection.lastUsed = Date.now();
    
    // Update metrics
    this.activeConnections++;
    this.totalAcquired++;
    metrics.gauge('vector_db.pool.active_connections', this.activeConnections);
    
    try {
      // Validate if needed
      if (this.config.validateConnection && this.config.validateConnectionFn) {
        const isValid = await this.config.validateConnectionFn(pooledConnection.connection);
        
        if (!isValid) {
          // Connection is invalid, remove it and create a new one
          console.warn('Connection validation failed, replacing connection', { 
            connectionId: pooledConnection.id
          });
          
          // Update metrics
          this.validateErrors++;
          metrics.increment('vector_db.pool.validation_errors');
          
          // Remove from pool
          this.pool = this.pool.filter(c => c.id !== pooledConnection.id);
          
          // Close connection
          try {
            await this.config.closeConnection(pooledConnection.connection);
          } catch (error) {
            console.error('Error closing invalid connection', { error });
          }
          
          // Create a new connection
          const newConn = await this.createNewConnection();
          newConn.inUse = true;
          newConn.lastUsed = Date.now();
          
          return newConn.connection;
        }
      }
      
      // Connection is valid
      console.log('Acquired connection from pool', { 
        connectionId: pooledConnection.id,
        activeConnections: this.activeConnections,
        poolSize: this.pool.length
      });
      
      return pooledConnection.connection;
    } catch (error) {
      // Mark as not in use in case of error
      pooledConnection.inUse = false;
      this.activeConnections--;
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Wait for an available connection
   */
  private waitForConnection(startTime: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from waiting queue
        this.waiting = this.waiting.filter(w => w.resolve !== resolve);
        
        // Reject with timeout error
        reject(new Error(`Timed out waiting for connection after ${this.config.acquireTimeoutMs}ms`));
        
        // Update metrics
        metrics.increment('vector_db.pool.acquire_timeouts');
      }, this.config.acquireTimeoutMs);
      
      // Add to waiting queue
      this.waiting.push({
        resolve: (connection: T) => {
          clearTimeout(timeoutId);
          resolve(connection);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        startTime
      });
      
      console.log('Waiting for connection', { 
        waitingCount: this.waiting.length,
        poolSize: this.pool.length,
        activeConnections: this.activeConnections
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  public async release(connection: T): Promise<void> {
    if (this.closed) {
      // If pool is closed, just close the connection
      try {
        await this.config.closeConnection(connection);
      } catch (error) {
        console.error('Error closing connection after pool closed', { error });
      }
      return;
    }
    
    // Find the connection in the pool
    const pooledConnection = this.pool.find(conn => conn.connection === connection);
    
    if (!pooledConnection) {
      console.warn('Attempted to release a connection not managed by this pool');
      return;
    }
    
    // Update connection metadata
    pooledConnection.inUse = false;
    pooledConnection.lastUsed = Date.now();
    
    // Update metrics
    this.activeConnections--;
    metrics.gauge('vector_db.pool.active_connections', this.activeConnections);
    
    console.log('Released connection back to pool', { 
      connectionId: pooledConnection.id,
      activeConnections: this.activeConnections,
      poolSize: this.pool.length
    });
    
    // If anyone is waiting for a connection, give them this one
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      
      if (waiter) {
        try {
          const conn = await this.validateAndAcquire(pooledConnection);
          
          // Calculate wait time
          const waitTime = Date.now() - waiter.startTime;
          metrics.histogram('vector_db.pool.wait_time', waitTime);
          
          // Resolve the waiting promise
          waiter.resolve(conn);
          
          console.log('Provided released connection to waiting request', { 
            connectionId: pooledConnection.id,
            waitTime
          });
        } catch (error) {
          // If validation fails, reject the waiting promise
          waiter.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  /**
   * Get current pool statistics
   */
  public getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalCreated: number;
    totalAcquired: number;
    acquireErrors: number;
    validateErrors: number;
  } {
    return {
      totalConnections: this.pool.length,
      activeConnections: this.activeConnections,
      idleConnections: this.pool.length - this.activeConnections,
      waitingRequests: this.waiting.length,
      totalCreated: this.totalCreated,
      totalAcquired: this.totalAcquired,
      acquireErrors: this.acquireErrors,
      validateErrors: this.validateErrors
    };
  }

  /**
   * Close the connection pool
   */
  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    
    this.closed = true;
    
    // Stop the prune timer
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    
    // Reject any waiting requests
    for (const waiter of this.waiting) {
      waiter.reject(new Error('Connection pool is closing'));
    }
    
    this.waiting = [];
    
    // Close all connections
    const closePromises = this.pool.map(async conn => {
      try {
        await this.config.closeConnection(conn.connection);
      } catch (error) {
        console.error('Error closing connection during pool shutdown', { 
          connectionId: conn.id,
          error 
        });
      }
    });
    
    await Promise.all(closePromises);
    
    // Clear the pool
    const closedCount = this.pool.length;
    this.pool = [];
    this.activeConnections = 0;
    
    console.log(`Connection pool closed, ${closedCount} connections terminated`);
    
    // Update metrics
    metrics.gauge('vector_db.pool.connections', 0);
    metrics.gauge('vector_db.pool.active_connections', 0);
  }
}