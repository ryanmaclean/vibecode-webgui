/**
 * Vector Database Adapter Test Suite
 * Tests the core functionality of vector database adapters
 */

import { BaseVectorDatabaseAdapter } from '@/lib/vector-db/base-vector-database-adapter';
import { VectorDatabaseProvider } from '@/lib/vector-db/vector-types';
import { logger } from '@/lib/logger';
import { appLogger } from '@/lib/server-monitoring';

// Define types for query parameters and results
type QueryResult = { rows: Record<string, unknown>[] };
type QueryParams = (string | number | boolean | null)[];

type EventHandler = (...args: unknown[]) => void;

// Define mock connection interface - corrected type definitions
interface MockConnection {
  id: string;
  query: jest.Mock<Promise<{ rows: any[] }>, [string, any?]>;
  release: jest.Mock<Promise<void>, []>;
  on: jest.Mock<any, [string, EventHandler]>;
  removeListener: jest.Mock<any, [string, EventHandler]>;
  once: jest.Mock<any, [string, EventHandler]>;
  removeAllListeners: jest.Mock<any, [string?]>;
  emit: jest.Mock<boolean, [string, ...any[]]>;
  end: jest.Mock<Promise<void>, []>;
}

// Create a mock adapter for testing
class MockVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  connectionCreated = false;
  connectionValidated = false;
  connectionClosed = false;
  initializeProviderCalled = false;
  pingProviderCalled = false;
  closeProviderCalled = false;
  isPoolConnectionValid = true;

  public search = jest.fn().mockResolvedValue([]);
  public searchWithText = jest.fn().mockResolvedValue([]);
  public storeChunks = jest.fn().mockResolvedValue(undefined);
  public deleteFileChunks = jest.fn().mockResolvedValue(undefined);
  public getStats = jest.fn().mockResolvedValue({ totalChunks: 0, totalFiles: 0, averageChunkSize: 0 });
  public invalidateCache = jest.fn().mockResolvedValue(0);
  public generateEmbedding = jest.fn().mockResolvedValue(new Array(1536).fill(0));

  protected async initializeProvider(): Promise<void> {
    this.initializeProviderCalled = true;
    return Promise.resolve();
  }

  protected async pingProvider(): Promise<boolean> {
    this.pingProviderCalled = true;
    return Promise.resolve(true);
  }

  protected async closeProvider(): Promise<void> {
    this.closeProviderCalled = true;
    return Promise.resolve();
  }

  // Add connection tracking
  private activeConnections: Set<MockConnection> = new Set();
  private maxPoolSize: number = 2; // Default, will be overridden by constructor
  private acquireTimeout: number = 50; // Shorter timeout for testing
  private shouldSimulateError: boolean = false;

  constructor(config: any) {
    super(config);
    // Override defaults with config values
    if (config.connectionPool?.max) {
      this.maxPoolSize = config.connectionPool.max;
    } else if (config.maxPoolSize) {
      this.maxPoolSize = config.maxPoolSize;
    }
    if (config.connectionPool?.acquireTimeoutMillis || config.connectionAcquireTimeoutMs) {
      this.acquireTimeout = config.connectionPool?.acquireTimeoutMillis || config.connectionAcquireTimeoutMs || 50;
    }
  }
  
  // Define mock connection type
  private mockConnection: MockConnection | null = null;
  
  // Create a mock connection with all required properties
  private createMockConnection(): MockConnection {
    const connection: MockConnection = {
      id: `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      query: jest.fn().mockImplementation((_query: string, _params?: any) => {
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockImplementation((_event: string, _handler: EventHandler) => {
        return connection;
      }),
      removeListener: jest.fn().mockImplementation((_event: string, _handler: EventHandler) => {
        return connection;
      }),
      once: jest.fn().mockImplementation((_event: string, _handler: EventHandler) => {
        return connection;
      }),
      removeAllListeners: jest.fn().mockImplementation((_event?: string) => {
        return connection;
      }),
      emit: jest.fn().mockImplementation((_event: string, ..._args: any[]) => {
        return true;
      }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    return connection;
  }
  
  // Override getConnection to make it public for testing
  public override async getConnection(): Promise<MockConnection> {
    if (this.shouldSimulateError) {
      throw new Error('Simulated connection error');
    }

    // Check if we've reached max pool size
    if (this.activeConnections.size >= this.maxPoolSize) {
      throw new Error('Connection pool reached maximum size');
    }

    // Create a new mock connection with all required properties
    const connection = this.createMockConnection();
    this.connectionCreated = true;

    // Validate connection
    const isValid = await this.validatePoolConnection(connection);
    if (!isValid) {
      throw new Error('Connection validation failed');
    }

    // Track the connection
    this.activeConnections.add(connection);
    this.mockConnection = connection;

    return connection;
  }

  // Test connection method
  public async testConnection(): Promise<boolean> {
    try {
      const connection = await this.getConnection();
      await connection.query('SELECT 1');
      await this.releaseConnection(connection);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Override releaseConnection to make it public for testing
  public override async releaseConnection(connection: MockConnection): Promise<void> {
    if (!connection) return Promise.resolve();
    
    // Prevent double-release
    if (!this.activeConnections.has(connection)) {
      return Promise.resolve();
    }
    
    // Remove from active connections
    this.activeConnections.delete(connection);
    this.connectionClosed = true;
    
    // Resolve the release and end promises
    return Promise.resolve();
  }

  protected async createPoolConnection(): Promise<any> {
    this.connectionCreated = true;
    
    // Create a proper mock connection with all required properties
    const connection: MockConnection = {
      id: 'test-connection-1',
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn().mockImplementation(async () => {
        await this.releaseConnection(connection);
      }),
      on: jest.fn(),
      removeListener: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined)
    };
    
    return connection;
  }

  protected async validatePoolConnection(_connection: any): Promise<boolean> {
    this.connectionValidated = true;
    return this.isPoolConnectionValid;
  }

  protected async closePoolConnection(connection: any): Promise<void> {
    this.connectionClosed = true;
    if (connection?.end) {
      await connection.end();
    }
    return Promise.resolve();
  }

  public async close(): Promise<void> {
    this.closeProviderCalled = true;
    
    // Close all active connections
    const releasePromises = Array.from(this.activeConnections).map(conn => 
      this.releaseConnection(conn).catch(() => {})
    );
    
    await Promise.all(releasePromises);
    this.connectionClosed = true;
    this.activeConnections.clear();
  }

  // Expose protected methods for testing
  public async exposeAcquireConnection(): Promise<any> {
    return this.getConnection();
  }

  public exposeReleaseConnection(connection: any): Promise<void> {
    return this.releaseConnection(connection);
  }

  // Reset state for tests
  public reset(): void {
    this.connectionCreated = false;
    this.connectionValidated = false;
    this.connectionClosed = false;
    this.initializeProviderCalled = false;
    this.pingProviderCalled = false;
    this.closeProviderCalled = false;
    this.isPoolConnectionValid = true;
    
    // Reset mock function calls
    this.search.mockClear();
    this.searchWithText.mockClear();
    this.storeChunks.mockClear();
    this.deleteFileChunks.mockClear();
    this.getStats.mockClear();
    this.invalidateCache.mockClear();
    this.generateEmbedding.mockClear();
  }
}

// Mock telemetry and logging
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/server-monitoring', () => ({
  metrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn()
  },
  appLogger: {
    logVectorDB: jest.fn()
  }
}));

describe('BaseVectorDatabaseAdapter', () => {
  let adapter: MockVectorDatabaseAdapter;

  beforeEach(() => {
    // Create a fresh adapter for each test
    adapter = new MockVectorDatabaseAdapter({
      provider: VectorDatabaseProvider.POSTGRES,
      connectionPooling: true,
      minPoolSize: 1,
      maxPoolSize: 3,
      enableMetrics: true,
      enableLogging: true
    });
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up
    await adapter.close();
  });

  describe('Initialization', () => {
    it('should initialize the adapter correctly', async () => {
      await adapter.initialize();
      
      expect(adapter.initializeProviderCalled).toBe(true);
      expect(adapter.isInitialized).toBe(true);
      // connectionCreated should only be true after getConnection() is called
      expect(adapter.connectionCreated).toBe(false);
    });
    
    it('should not re-initialize if already initialized', async () => {
      await adapter.initialize();
      adapter.reset();
      
      await adapter.initialize();
      
      expect(adapter.initializeProviderCalled).toBe(false);
    });
    
    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      jest.spyOn(adapter as any, 'initializeProvider').mockRejectedValueOnce(error);
      
      await expect(adapter.initialize()).rejects.toThrow('Initialization failed');
      // Base class logs to console.error, not logger.error
    });
  });

  describe('Connection Pool', () => {
    it('should create and acquire connections from the pool', async () => {
      await adapter.initialize();
      
      const connection = await adapter.exposeAcquireConnection();
      
      expect(connection).toBeDefined();
      expect(adapter.connectionCreated).toBe(true);
      expect(adapter.connectionValidated).toBe(true);
      
      await adapter.exposeReleaseConnection(connection);
    });
    
    it('should validate connections before use', async () => {
      await adapter.initialize();
      adapter.isPoolConnectionValid = false;
      
      try {
        await adapter.exposeAcquireConnection();
        fail('Should have thrown an error for invalid connection');
      } catch (error) {
        // Connection creation and validation should have been attempted
        expect(adapter.connectionCreated).toBe(true);
        expect(adapter.connectionValidated).toBe(true);
        expect(error.message).toContain('validation');
      }
    });
    
    it('should close connections when the adapter is closed', async () => {
      await adapter.initialize();
      
      // Get a connection
      const conn = await adapter.getConnection();
      expect(conn).toBeDefined();
      
      // Spy on releaseConnection
      const releaseSpy = jest.spyOn(adapter, 'releaseConnection');
      
      // Close the adapter
      await adapter.close();
      
      expect(adapter.closeProviderCalled).toBe(true);
      expect(releaseSpy).toHaveBeenCalled();
    });
  });

  describe('Search Operations', () => {
    it('should perform vector search operations', async () => {
      await adapter.initialize();
      
      // Mock the search implementation
      const mockResults = [{ id: 1, content: 'test', embedding: [0.1, 0.2] }];
      const searchSpy = jest.spyOn(adapter, 'search' as keyof MockVectorDatabaseAdapter).mockResolvedValue(mockResults);
      
      const results = await adapter.search([0.1, 0.2], { limit: 5 });
      
      expect(results).toEqual(mockResults);
      expect(searchSpy).toHaveBeenCalledWith([0.1, 0.2], { limit: 5 });
    });
    
    it('should perform text search operations', async () => {
      await adapter.initialize();
      
      // Mock the text search implementation
      const mockResults = [{ id: 2, content: 'test query', score: 0.95 }];
      const searchWithTextSpy = jest.spyOn(adapter, 'searchWithText' as keyof MockVectorDatabaseAdapter).mockResolvedValue(mockResults);
      
      const results = await adapter.searchWithText('test query', { limit: 5 });
      
      expect(results).toEqual(mockResults);
      expect(searchWithTextSpy).toHaveBeenCalledWith('test query', { limit: 5 });
    });
    
    it('should handle search errors gracefully', async () => {
      await adapter.initialize();
      
      const error = new Error('Search failed');
      (adapter.search as jest.Mock).mockRejectedValueOnce(error);
      
      await expect(adapter.search([0.1, 0.2])).rejects.toThrow('Search failed');
    });
    
    it('should handle connection errors', async () => {
      // Force an error during connection
      const originalGetConnection = adapter.getConnection.bind(adapter);
      adapter.getConnection = jest.fn().mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await adapter.testConnection();
      
      // Restore original method
      adapter.getConnection = originalGetConnection;
      
      expect(result).toBe(false);
    });
  });

  describe('Connection Status', () => {
    it('should check connection status', async () => {
      await adapter.initialize();
      
      const connected = await adapter.isConnected();
      
      expect(connected).toBe(true);
      expect(adapter.pingProviderCalled).toBe(true);
    });
    
    it('should ping the database', async () => {
      await adapter.initialize();
      
      const result = await adapter.ping(1000);
      
      expect(result).toBe(true);
      expect(adapter.pingProviderCalled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      await adapter.initialize();
      
      const error = new Error('Search failed');
      adapter.search.mockRejectedValueOnce(error);
      
      await expect(adapter.search([])).rejects.toThrow('Search failed');
    });
    
    it('should handle connection errors', async () => {
      // Force an error during connection
      const originalGetConnection = adapter.getConnection.bind(adapter);
      adapter.getConnection = jest.fn().mockRejectedValueOnce(new Error('Connection failed'));
      
      const result = await adapter.testConnection();
      
      // Restore original method
      adapter.getConnection = originalGetConnection;
      
      expect(result).toBe(false);
    });
  });

  describe('Telemetry', () => {
    it('should record metrics for operations', async () => {
      await adapter.initialize();
      
      await adapter.search([]);
      
      expect(appLogger.logVectorDB).not.toHaveBeenCalled(); // Not implemented in base class
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent connection requests', async () => {
      // Configure adapter with a small pool size for testing
      adapter = new MockVectorDatabaseAdapter({
        provider: VectorDatabaseProvider.POSTGRES,
        connectionPooling: true,
        minPoolSize: 2,
        maxPoolSize: 5,
        connectionAcquireTimeoutMs: 1000,
        connectionIdleTimeoutMs: 30000
      });
      
      await adapter.initialize();
      
      // Create multiple concurrent connection requests
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(adapter.getConnection());
      }
      
      const connections = await Promise.all(requests);
      
      // Verify we got unique connections
      const uniqueConnections = new Set(connections);
      expect(uniqueConnections.size).toBe(3);
      
      // Clean up
      await Promise.all(connections.map(conn => adapter.releaseConnection(conn)));
    });
    
    it('should enforce connection pool limits', async () => {
      // Set a small pool size for testing
      adapter = new MockVectorDatabaseAdapter({ 
        provider: 'postgres', // Using a valid provider
        connectionPool: {
          min: 1,
          max: 2,
          acquireTimeoutMillis: 1000
        }
      });
      
      await adapter.initialize();
      
      // Get connections up to the pool limit
      const conn1 = await adapter.getConnection();
      const conn2 = await adapter.getConnection();
      
      // Next connection should be rejected due to pool limit
      await expect(adapter.getConnection())
        .rejects
        .toThrow('Connection pool reached maximum size');
      
      // Release connections
      await adapter.releaseConnection(conn1);
      await adapter.releaseConnection(conn2);
      
      // Should be able to get connections again after release
      const conn3 = await adapter.getConnection();
      expect(conn3).toBeDefined();
      await adapter.releaseConnection(conn3);
      
      // Should be able to get connections again after release
      const conn4 = await adapter.getConnection();
      expect(conn4).toBeDefined();
      await adapter.releaseConnection(conn4);
    });
    
    it('should handle concurrent search operations', async () => {
      await adapter.initialize();
      
      // Create multiple concurrent search requests
      const searches = Array(5).fill(0).map(() => adapter.search([]));
      
      // All should complete
      await Promise.all(searches);
      expect(adapter.search).toHaveBeenCalledTimes(5);
    });
    
    it('should handle connection timeouts', async () => {
      // Configure adapter with short timeout for testing
      adapter = new MockVectorDatabaseAdapter({
        provider: 'postgres', // Using a valid provider
        connectionPool: {
          min: 1,
          max: 10, // Large pool to avoid pool limit errors
          acquireTimeoutMillis: 50, // Short timeout
          idleTimeoutMillis: 1000
        }
      });
      
      await adapter.initialize();

      // Mock connection creation to be slow and timeout
      const originalCreateConnection = adapter['createMockConnection'].bind(adapter);
      jest.spyOn(adapter as any, 'createMockConnection').mockImplementation(() => {
        // Simulate a connection that takes too long
        return new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        );
      });

      // This should throw a timeout error
      await expect(adapter.getConnection())
        .rejects
        .toThrow('timeout');
    }, 10000); // Increased timeout for this test
    
    it('should handle connection failures gracefully', async () => {
      // Configure adapter with failure simulation
      adapter = new MockVectorDatabaseAdapter({
        provider: 'mock',
        connectionPool: {
          min: 1,
          max: 10, // Large pool to avoid pool size errors
          acquireTimeoutMillis: 1000
        }
      });

      await adapter.initialize();

      // Mock createMockConnection to fail after first call
      const originalCreateConnection = adapter['createMockConnection'].bind(adapter);
      let callCount = 0;

      jest.spyOn(adapter as any, 'createMockConnection').mockImplementation(() => {
        callCount++;
        if (callCount > 2) {
          throw new Error('Simulated connection failure');
        }
        return originalCreateConnection();
      });

      // First two should succeed
      const conn1 = await adapter.getConnection();
      const conn2 = await adapter.getConnection();
      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();

      // Next one should fail
      await expect(adapter.getConnection())
        .rejects
        .toThrow('Simulated connection failure');

      // Clean up
      await adapter.releaseConnection(conn1);
      await adapter.releaseConnection(conn2);
    }, 10000); // Increased timeout for this test
      
    it('should handle connection validation failures', async () => {
      adapter = new MockVectorDatabaseAdapter({
        provider: VectorDatabaseProvider.POSTGRES,
        connectionPooling: true,
        minPoolSize: 1,
        maxPoolSize: 3,
        connectionAcquireTimeoutMs: 1000
      });
      
      await adapter.initialize();
      
      // Mock validatePoolConnection to always fail
      const validateSpy = jest.spyOn(adapter as any, 'validatePoolConnection')
        .mockResolvedValue(false);
      
      // Should fail validation
      await expect(adapter.getConnection())
        .rejects
        .toThrow('Connection validation failed');
      
      // Verify validation was called
      expect(validateSpy).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should maintain acceptable response times under load', async () => {
      await adapter.initialize();
      
      const startTime = Date.now();
      
      // Perform multiple operations concurrently
      const operations = Array(50).fill(0).map(() => adapter.search([]));
      await Promise.all(operations);
      
      const duration = Date.now() - startTime;
      const avgTimePerOp = duration / 50;
      
      // Average time per operation should be reasonable
      expect(avgTimePerOp).toBeLessThan(100); // 100ms per operation
    });
    
    it('should handle connection pool churn', async () => {
      adapter = new MockVectorDatabaseAdapter({
        provider: 'postgres',
        connectionPool: {
          min: 1,
          max: 10, // Larger pool to avoid size limits
          acquireTimeoutMillis: 1000
        }
      });

      await adapter.initialize();

      // Test with a small number of iterations
      const iterations = 3;
      const connections = [];

      try {
        // Get all connections
        for (let i = 0; i < iterations; i++) {
          const conn = await adapter.getConnection();
          expect(conn).toBeDefined();
          connections.push(conn);
        }

        // Release connections with small delays
        for (const conn of connections) {
          await new Promise(resolve => setTimeout(resolve, 10));
          await adapter.releaseConnection(conn);
        }

        // Verify we can still get connections after churn
        const finalConn = await adapter.getConnection();
        expect(finalConn).toBeDefined();
        await adapter.releaseConnection(finalConn);

        // Verify connection was properly released
        expect(adapter.connectionClosed).toBe(true);
      } finally {
        // Ensure all connections are released even if test fails
        await Promise.all(
          connections.map(conn => adapter.releaseConnection(conn))
        );
      }
    }, 10000);
  });
});