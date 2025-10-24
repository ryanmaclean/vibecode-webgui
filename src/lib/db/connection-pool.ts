/**
 * Database Connection Pooling
 * Provides efficient connection management for vector database operations
 */

import { PrismaClient } from '@prisma/client';
import { getDatabaseMetricsCollector } from './db-metrics';
import { ConnectionPoolStatus } from './db-types';

// Connection pool configuration interface
export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  validationIntervalMs: number;
  logErrors: boolean;
}

// Connection with metadata
interface PoolConnection {
  prisma: PrismaClient;
  isInUse: boolean;
  lastUsed: number;
  createdAt: number;
}

/**
 * Database Connection Pool
 * Manages a pool of Prisma connections for efficient resource utilization
 */
export class ConnectionPool {
  private connections: Map<string, PoolConnection> = new Map();
  private config: ConnectionPoolConfig;
  private metrics: ConnectionPoolStatus;
  private validationTimer: NodeJS.Timeout | null = null;

  /**
   * Constructor for ConnectionPool
   * 
   * @param config - Connection pool configuration
   */
  constructor(config?: Partial<ConnectionPoolConfig>) {
    // Default configuration values
    this.config = {
      min: config?.min ?? 2,
      max: config?.max ?? 10,
      acquireTimeoutMs: config?.acquireTimeoutMs ?? 5000,
      idleTimeoutMs: config?.idleTimeoutMs ?? 30000,
      validationIntervalMs: config?.validationIntervalMs ?? 60000,
      logErrors: config?.logErrors ?? true
    };

    // Initialize metrics
    this.metrics = {
      size: 0,
      inUse: 0,
      available: 0,
      maxSize: this.config.max,
      minSize: this.config.min,
      utilization: 0,
      configuration: {
        idleTimeout: this.config.idleTimeoutMs,
        connectionTimeout: 0,
        acquireTimeout: this.config.acquireTimeoutMs,
        enableDynamicSizing: true,
        enableConnectionValidation: true
      },
      metrics: {
        totalConnections: 0,
        peakConnections: 0,
        totalAcquires: 0,
        acquireSuccesses: 0,
        acquireFailures: 0,
        acquireTimeAvg: 0,
        connectionValidations: 0,
        connectionValidationFailures: 0,
        dynamicPoolAdjustments: 0
      }
    };

    // Initialize the pool with minimum connections
    this.initializePool();

    // Start validation timer
    this.startValidationTimer();
  }

  /**
   * Initialize the connection pool with minimum connections
   */
  private async initializePool(): Promise<void> {
    try {
      // Create minimum number of connections
      for (let i = 0; i < this.config.min; i++) {
        const prisma = new PrismaClient();
        
        // Initialize the connection
        await prisma.$connect();
        
        // Add to the pool
        const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.connections.set(id, {
          prisma,
          isInUse: false,
          lastUsed: Date.now(),
          createdAt: Date.now()
        });

        this.metrics.metrics.totalConnections++;
      }
      
      // Update metrics
      this.updateMetrics();
      
      console.log(`Connection pool initialized with ${this.config.min} connections`);
    } catch (error) {
      console.error('Error initializing connection pool:', error);
    }
  }

  /**
   * Start the connection validation timer
   */
  private startValidationTimer(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }
    
    this.validationTimer = setInterval(() => {
      this.validateConnections();
    }, this.config.validationIntervalMs);
  }

  /**
   * Validate and clean up idle connections
   */
  private async validateConnections(): Promise<void> {
    const now = Date.now();
    const idsToRemove: string[] = [];
    
    // Track number of available connections
    let availableCount = 0;
    
    // Check each connection
    for (const [id, conn] of this.connections.entries()) {
      // Skip in-use connections
      if (conn.isInUse) continue;
      
      // Count available connections
      availableCount++;
      
      // Check if connection is idle for too long
      const idleTime = now - conn.lastUsed;
      if (idleTime > this.config.idleTimeoutMs && this.connections.size > this.config.min) {
        // Close and remove idle connection
        try {
          await conn.prisma.$disconnect();
          idsToRemove.push(id);
          this.metrics.metrics.dynamicPoolAdjustments++;
        } catch (error) {
          if (this.config.logErrors) {
            console.error(`Error closing idle connection ${id}:`, error);
          }
          idsToRemove.push(id);
        }
      } else {
        // Validate the connection
        this.metrics.metrics.connectionValidations++;
        try {
          // Simple validation query
          await conn.prisma.$queryRaw`SELECT 1`;
        } catch (error) {
          // Connection is invalid, close and remove it
          this.metrics.metrics.connectionValidationFailures++;
          try {
            await conn.prisma.$disconnect();
          } catch (disconnectError) {
            if (this.config.logErrors) {
              console.error(`Error disconnecting invalid connection ${id}:`, disconnectError);
            }
          }
          idsToRemove.push(id);
        }
      }
    }
    
    // Remove invalid or idle connections
    for (const id of idsToRemove) {
      this.connections.delete(id);
    }
    
    // Create new connections if below minimum
    if (this.connections.size < this.config.min) {
      const connectionsToAdd = this.config.min - this.connections.size;
      for (let i = 0; i < connectionsToAdd; i++) {
        try {
          const prisma = new PrismaClient();
          await prisma.$connect();
          
          const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          this.connections.set(id, {
            prisma,
            isInUse: false,
            lastUsed: Date.now(),
            createdAt: Date.now()
          });
          
          this.metrics.metrics.totalConnections++;
          this.metrics.metrics.dynamicPoolAdjustments++;
        } catch (error) {
          if (this.config.logErrors) {
            console.error('Error creating new connection during validation:', error);
          }
        }
      }
    }
    
    // Update metrics
    this.updateMetrics();
  }

  /**
   * Update connection pool metrics
   */
  private updateMetrics(): void {
    let inUseCount = 0;
    let availableCount = 0;
    
    for (const conn of this.connections.values()) {
      if (conn.isInUse) {
        inUseCount++;
      } else {
        availableCount++;
      }
    }
    
    this.metrics.size = this.connections.size;
    this.metrics.inUse = inUseCount;
    this.metrics.available = availableCount;
    this.metrics.utilization = this.connections.size > 0 ? (inUseCount / this.connections.size) * 100 : 0;
    
    // Update peak connections
    if (this.connections.size > this.metrics.metrics.peakConnections) {
      this.metrics.metrics.peakConnections = this.connections.size;
    }
    
    // Record metrics if collector is available
    const collector = getDatabaseMetricsCollector();
    if (collector) {
      // Record a simple marker for pool metrics update
      collector.recordQuery(
        `CONNECTION_POOL_METRICS`,
        0,
        true,
        { type: 'POOL', table: 'connection-pool' }
      );
    }
  }

  /**
   * Acquire a connection from the pool
   * 
   * @param acquireTimeout - Optional timeout override
   * @returns Promise resolving to a Prisma client
   */
  public async acquire(acquireTimeout?: number): Promise<PrismaClient> {
    const timeout = acquireTimeout || this.config.acquireTimeoutMs;
    this.metrics.metrics.totalAcquires++;
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      // Set a timeout for connection acquisition
      const timeoutId = setTimeout(() => {
        this.metrics.metrics.acquireFailures++;
        reject(new Error(`Connection acquisition timed out after ${timeout}ms`));
      }, timeout);
      
      // Try to get an available connection
      const acquireConnection = async () => {
        try {
          // First, try to find an available connection
          for (const [id, conn] of this.connections.entries()) {
            if (!conn.isInUse) {
              // Mark as in use
              conn.isInUse = true;
              conn.lastUsed = Date.now();
              
              // Update metrics
              this.updateMetrics();
              this.metrics.metrics.acquireSuccesses++;
              
              // Update average acquisition time
              const acquireTime = Date.now() - startTime;
              const totalAcquires = this.metrics.metrics.acquireSuccesses + this.metrics.metrics.acquireFailures;
              this.metrics.metrics.acquireTimeAvg = 
                (this.metrics.metrics.acquireTimeAvg * (totalAcquires - 1) + acquireTime) / totalAcquires;
              
              // Clear timeout and resolve
              clearTimeout(timeoutId);
              return resolve(conn.prisma);
            }
          }
          
          // If no available connection and below max size, create a new one
          if (this.connections.size < this.config.max) {
            const prisma = new PrismaClient();
            await prisma.$connect();
            
            const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            this.connections.set(id, {
              prisma,
              isInUse: true,
              lastUsed: Date.now(),
              createdAt: Date.now()
            });
            
            this.metrics.metrics.totalConnections++;
            
            // Update metrics
            this.updateMetrics();
            this.metrics.metrics.acquireSuccesses++;
            
            // Update average acquisition time
            const acquireTime = Date.now() - startTime;
            const totalAcquires = this.metrics.metrics.acquireSuccesses + this.metrics.metrics.acquireFailures;
            this.metrics.metrics.acquireTimeAvg = 
              (this.metrics.metrics.acquireTimeAvg * (totalAcquires - 1) + acquireTime) / totalAcquires;
            
            // Clear timeout and resolve
            clearTimeout(timeoutId);
            return resolve(prisma);
          }
          
          // If all connections are in use and at max size, throw error
          if (this.connections.size >= this.config.max) {
            clearTimeout(timeoutId);
            this.metrics.metrics.acquireFailures++;
            return reject(new Error('Connection pool reached maximum size and all connections are in use'));
          }
        } catch (error) {
          clearTimeout(timeoutId);
          this.metrics.metrics.acquireFailures++;
          return reject(error);
        }
      };
      
      acquireConnection().catch(reject);
    });
  }

  /**
   * Release a connection back to the pool
   * 
   * @param prisma - Prisma client to release
   */
  public async release(prisma: PrismaClient): Promise<void> {
    let found = false;
    
    for (const [, conn] of this.connections.entries()) {
      if (conn.prisma === prisma) {
        // Mark as available
        conn.isInUse = false;
        conn.lastUsed = Date.now();
        found = true;
        break;
      }
    }
    
    // If the connection wasn't found in the pool, just disconnect it
    if (!found) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        if (this.config.logErrors) {
          console.error('Error disconnecting unknown connection:', error);
        }
      }
    }
    
    // Update metrics
    this.updateMetrics();
  }

  /**
   * Get the current connection pool status
   * 
   * @returns ConnectionPoolStatus object with current metrics
   */
  public getStatus(): ConnectionPoolStatus {
    return { ...this.metrics };
  }

  /**
   * Get detailed information about all connections in the pool
   * 
   * @returns Array of connection details
   */
  public getDetailedInfo(): { 
    connections: Array<{ 
      key: string; 
      inUse: boolean; 
      ageMs: number; 
      idleTimeMs: number;
      timeSinceValidationMs: number;
    }> 
  } {
    const now = Date.now();
    const connections = Array.from(this.connections.entries()).map(([id, conn]) => ({
      key: id,
      inUse: conn.isInUse,
      ageMs: now - conn.createdAt,
      idleTimeMs: conn.isInUse ? 0 : now - conn.lastUsed,
      timeSinceValidationMs: 0 // Not tracking this yet
    }));
    
    return { connections };
  }

  /**
   * Close all connections and shutdown the pool
   */
  public async close(): Promise<void> {
    // Stop validation timer
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
    
    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(async (conn) => {
      try {
        await conn.prisma.$disconnect();
      } catch (error) {
        if (this.config.logErrors) {
          console.error('Error closing connection during pool shutdown:', error);
        }
      }
    });
    
    // Wait for all connections to close
    await Promise.all(closePromises);
    
    // Clear connections map
    this.connections.clear();
    
    // Update metrics
    this.updateMetrics();
    
    console.log('Connection pool closed');
  }
}

// Singleton instance of the connection pool
let globalConnectionPool: ConnectionPool | null = null;

/**
 * Get or create the global connection pool
 * 
 * @param config - Optional configuration for the pool
 * @returns The global connection pool instance
 */
export function getConnectionPool(config?: Partial<ConnectionPoolConfig>): ConnectionPool {
  if (!globalConnectionPool) {
    globalConnectionPool = new ConnectionPool(config);
  }
  return globalConnectionPool;
}

/**
 * Reset the global connection pool (mainly for testing)
 */
export async function resetConnectionPool(): Promise<void> {
  if (globalConnectionPool) {
    await globalConnectionPool.close();
    globalConnectionPool = null;
  }
}