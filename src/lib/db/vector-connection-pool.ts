import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import { EventEmitter } from 'events';
import { PoolStatus } from '../vector-db/pool-status';
import { logger } from '@/lib/logger';
// Use a simple logger implementation
const createLogger = (name: string) => ({
  info: (message: string, ...args: any[]) => logger.info(`[${name}] INFO: ${message}`, ...args),
  error: (message: string, ...args: any[]) => logger.error(`[${name}] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(`[${name}] WARN: ${message}`, ...args),
  debug: (message: string, ...args: any[]) => logger.debug(`[${name}] DEBUG: ${message}`, ...args),
});

/**
 * Default pool configuration options
 */
const DEFAULT_POOL_CONFIG = {
  min: 1,                        // Minimum number of connections
  max: 10,                       // Maximum number of connections
  acquireTimeoutMillis: 30000,   // Maximum time to wait for a connection
  idleTimeoutMillis: 30000,      // Time before idle connections are closed
  createTimeoutMillis: 30000,    // Maximum time to spend creating a connection
  createRetryIntervalMillis: 200, // Time between connection creation retries
  maxCreateRetries: 10,          // Maximum number of connection creation retries
  testOnBorrow: true,            // Test connections before providing them
  testOnReturn: false,           // Test connections when they are returned
  fifo: true,                    // Use First-In-First-Out when allocating
  priorityRange: 1,              // Priority range for connection requests
  evictionRunIntervalMillis: 0,  // Disable automatic eviction runs
  numTestsPerEvictionRun: 3,     // Number of connections to check per eviction run
  softIdleTimeoutMillis: -1,     // Disable soft idle timeout
  connectionTtlMillis: 0         // Disable connection time-to-live
};

/**
 * Events emitted by the connection pool
 */
export enum PoolEvent {
  CREATED = 'connection-created',
  ACQUIRED = 'connection-acquired',
  RELEASED = 'connection-released',
  DESTROYED = 'connection-destroyed',
  ERROR = 'error',
  EXHAUSTED = 'pool-exhausted',
  TIMEOUT = 'acquire-timeout',
  IDLE_TIMEOUT = 'idle-timeout'
}

/**
 * Enhanced connection pool for vector database connections with detailed metrics
 * and dynamic scaling capabilities.
 */
export class VectorConnectionPool extends EventEmitter {
  private pool: Pool;
  private readonly logger = createLogger('VectorConnectionPool');
  private readonly options: any;
  private readonly name: string;
  
  // Metrics
  private totalCreated: number = 0;
  private totalAcquired: number = 0;
  private totalReleased: number = 0;
  private totalDestroyed: number = 0;
  private totalErrors: number = 0;
  private totalTimeouts: number = 0;
  private totalExhausted: number = 0;
  private acquireTimeTotal: number = 0;
  private activeConnections: number = 0;
  private poolSize: number;
  private isShuttingDown: boolean = false;
  private waitingClients: number = 0;
  private lastHealthCheck: Date = new Date();

  /**
   * Creates a new VectorConnectionPool with the specified configuration
   * @param config PostgreSQL pool configuration
   * @param options Additional pool options
   * @param name Optional name for the pool
   */
  constructor(
    config: PoolConfig,
    options: Partial<typeof DEFAULT_POOL_CONFIG> = {},
    name: string = 'vector-db-pool'
  ) {
    super();
    
    this.name = name;
    this.options = { ...DEFAULT_POOL_CONFIG, ...options };
    this.poolSize = this.options.max;
    
    // Create the underlying PostgreSQL pool
    this.pool = new Pool({
      ...config,
      max: this.options.max,
      idleTimeoutMillis: this.options.idleTimeoutMillis,
      connectionTimeoutMillis: this.options.acquireTimeoutMillis
    });
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.logger.info(`Created VectorConnectionPool "${name}" with max size ${this.options.max}`);
  }

  /**
   * Sets up event listeners for the pool
   */
  private setupEventListeners(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.totalCreated++;
      this.emit(PoolEvent.CREATED, { poolName: this.name, totalCreated: this.totalCreated });
      this.logger.debug(`New connection created, total created: ${this.totalCreated}`);
    });
    
    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.totalErrors++;
      this.emit(PoolEvent.ERROR, { 
        poolName: this.name, 
        error: err, 
        totalErrors: this.totalErrors 
      });
      this.logger.error(`Pool error: ${err.message}`);
    });
    
    this.pool.on('remove', (client: PoolClient) => {
      this.totalDestroyed++;
      this.emit(PoolEvent.DESTROYED, { 
        poolName: this.name, 
        totalDestroyed: this.totalDestroyed 
      });
      this.logger.debug(`Connection removed from pool, total destroyed: ${this.totalDestroyed}`);
    });
  }

  /**
   * Acquires a client from the pool
   * @returns A pool client
   */
  public async acquire(): Promise<PoolClient> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }
    
    this.waitingClients++;
    const startTime = Date.now();
    
    try {
      // Check if the pool is exhausted
      if (this.activeConnections >= this.options.max) {
        this.totalExhausted++;
        this.emit(PoolEvent.EXHAUSTED, { 
          poolName: this.name, 
          activeConnections: this.activeConnections,
          maxConnections: this.options.max
        });
        this.logger.warn(`Pool exhausted, ${this.activeConnections}/${this.options.max} connections in use`);
      }
      
      // Acquire a client from the pool
      const client = await this.pool.connect();
      
      // Update metrics
      this.activeConnections++;
      this.totalAcquired++;
      this.waitingClients--;
      const acquireTime = Date.now() - startTime;
      this.acquireTimeTotal += acquireTime;
      
      // Emit event
      this.emit(PoolEvent.ACQUIRED, { 
        poolName: this.name, 
        activeConnections: this.activeConnections,
        acquireTime,
        totalAcquired: this.totalAcquired
      });
      
      this.logger.debug(`Acquired connection, active: ${this.activeConnections}/${this.poolSize}, acquire time: ${acquireTime}ms`);
      
      // Wrap the release method to track metrics
      const originalRelease = client.release;
      client.release = (err?: Error) => {
        this.activeConnections--;
        this.totalReleased++;
        
        this.emit(PoolEvent.RELEASED, { 
          poolName: this.name, 
          activeConnections: this.activeConnections,
          totalReleased: this.totalReleased,
          error: err
        });
        
        this.logger.debug(`Released connection, active: ${this.activeConnections}/${this.poolSize}`);
        
        return originalRelease.call(client, err);
      };
      
      return client;
    } catch (error) {
      this.waitingClients--;
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        this.totalTimeouts++;
        this.emit(PoolEvent.TIMEOUT, { 
          poolName: this.name, 
          error, 
          totalTimeouts: this.totalTimeouts 
        });
        this.logger.error(`Connection acquisition timed out after ${Date.now() - startTime}ms`);
      }
      
      this.totalErrors++;
      this.emit(PoolEvent.ERROR, { 
        poolName: this.name, 
        error, 
        totalErrors: this.totalErrors 
      });
      
      this.logger.error(`Failed to acquire connection: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Executes a query using a connection from the pool
   * @param text The SQL query to execute
   * @param params Query parameters
   * @returns Query result
   */
  public async query(text: string, params: any[] = []): Promise<QueryResult> {
    const client = await this.acquire();
    
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Executes a query with a transaction
   * @param callback Function that receives a client and executes queries
   * @returns The result of the callback
   */
  public async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.acquire();
    
    try {
      await client.query('BEGIN');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        this.logger.error('Error rolling back transaction', rollbackError);
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Changes the maximum size of the pool
   * @param newSize The new maximum pool size
   */
  public setMaxPoolSize(newSize: number): void {
    if (newSize < this.options.min) {
      throw new Error(`New max size (${newSize}) must be greater than or equal to min size (${this.options.min})`);
    }
    
    this.poolSize = newSize;
    this.options.max = newSize;
    this.pool.options.max = newSize;
    
    this.logger.info(`Pool size changed to ${newSize}`);
  }

  /**
   * Gets the current status of the pool
   * @returns Pool status information
   */
  public getStatus(): PoolStatus {
    return {
      size: this.poolSize,
      available: this.poolSize - this.activeConnections,
      inUse: this.activeConnections,
      maxSize: this.options.max,
      waitingClients: this.waitingClients,
      idleConnections: this.poolSize - this.activeConnections
    };
  }

  /**
   * Gets detailed metrics about the pool
   */
  public getMetrics() {
    const avgAcquireTime = this.totalAcquired > 0 
      ? this.acquireTimeTotal / this.totalAcquired 
      : 0;
    
    return {
      name: this.name,
      poolSize: this.poolSize,
      minSize: this.options.min,
      maxSize: this.options.max,
      activeConnections: this.activeConnections,
      availableConnections: this.poolSize - this.activeConnections,
      waitingClients: this.waitingClients,
      utilization: this.poolSize > 0 ? (this.activeConnections / this.poolSize) * 100 : 0,
      totalCreated: this.totalCreated,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      totalDestroyed: this.totalDestroyed,
      totalErrors: this.totalErrors,
      totalTimeouts: this.totalTimeouts,
      totalExhausted: this.totalExhausted,
      avgAcquireTime,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Performs a health check on the pool
   * @returns True if the pool is healthy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      const result = await this.query('SELECT 1 as health_check');
      
      const endTime = Date.now();
      this.lastHealthCheck = new Date();
      
      const isHealthy = result.rows.length === 1 && result.rows[0].health_check === 1;
      
      this.logger.info(`Health check completed in ${endTime - startTime}ms, result: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      
      return isHealthy;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Closes the pool and all active connections
   */
  public async close(): Promise<void> {
    this.isShuttingDown = true;
    
    this.logger.info(`Shutting down pool "${this.name}"...`);
    
    try {
      await this.pool.end();
      this.logger.info(`Pool "${this.name}" successfully shut down`);
    } catch (error) {
      this.logger.error(`Error shutting down pool "${this.name}"`, error);
      throw error;
    }
  }
}

/**
 * Factory for creating and managing vector database connection pools
 */
export class VectorConnectionPoolFactory {
  private static pools: Map<string, VectorConnectionPool> = new Map();
  private static readonly logger = createLogger('VectorConnectionPoolFactory');

  /**
   * Creates a new connection pool or returns an existing one with the same name
   * @param config PostgreSQL pool configuration
   * @param options Additional pool options
   * @param name Pool name
   * @returns A connection pool
   */
  public static createPool(
    config: PoolConfig,
    options: Partial<typeof DEFAULT_POOL_CONFIG> = {},
    name: string = 'default'
  ): VectorConnectionPool {
    // If a pool with this name already exists, return it
    if (this.pools.has(name)) {
      this.logger.info(`Returning existing pool "${name}"`);
      return this.pools.get(name)!;
    }
    
    // Create a new pool
    const pool = new VectorConnectionPool(config, options, name);
    
    // Store the pool
    this.pools.set(name, pool);
    
    this.logger.info(`Created new pool "${name}"`);
    
    return pool;
  }

  /**
   * Gets an existing pool by name
   * @param name Pool name
   * @returns The requested pool or undefined if it doesn't exist
   */
  public static getPool(name: string = 'default'): VectorConnectionPool | undefined {
    return this.pools.get(name);
  }

  /**
   * Gets all available pools
   * @returns A map of pool names to pools
   */
  public static getAllPools(): Map<string, VectorConnectionPool> {
    return new Map(this.pools);
  }

  /**
   * Closes all pools
   */
  public static async closeAllPools(): Promise<void> {
    this.logger.info(`Closing all pools (${this.pools.size})...`);
    
    const closePromises = Array.from(this.pools.values()).map(pool => pool.close());
    
    await Promise.all(closePromises);
    
    this.pools.clear();
    
    this.logger.info('All pools closed');
  }

  /**
   * Checks the health of all pools
   * @returns A map of pool names to health status
   */
  public static async checkAllPoolsHealth(): Promise<Map<string, boolean>> {
    this.logger.info(`Checking health of all pools (${this.pools.size})...`);
    
    const healthPromises = Array.from(this.pools.entries()).map(
      async ([name, pool]) => [name, await pool.healthCheck()] as [string, boolean]
    );
    
    const results = await Promise.all(healthPromises);
    
    return new Map(results);
  }
}