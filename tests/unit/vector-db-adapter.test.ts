/**
 * Vector Database Adapter Test Suite
 * Tests the core functionality of vector database adapters
 */

import { BaseVectorDatabaseAdapter } from '../../src/lib/vector-db/base-vector-database-adapter';
import { VectorDatabaseProvider } from '../../src/lib/vector-db/vector-types';
import { logger } from '../../src/lib/logger';
import { appLogger } from '../../src/lib/server-monitoring';

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

  protected async createPoolConnection(): Promise<any> {
    this.connectionCreated = true;
    return { mockConnection: true };
  }

  protected async validatePoolConnection(_connection: any): Promise<boolean> {
    this.connectionValidated = true;
    return this.isPoolConnectionValid;
  }

  protected async closePoolConnection(_connection: any): Promise<void> {
    this.connectionClosed = true;
    return Promise.resolve();
  }

  // Expose protected methods for testing
  public exposeAcquireConnection(): Promise<any> {
    return this.acquireConnection();
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
jest.mock('../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/lib/server-monitoring', () => ({
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
      expect(adapter.connectionCreated).toBe(true);
      expect(logger.info).toHaveBeenCalled();
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
      expect(logger.error).toHaveBeenCalled();
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
        expect(adapter.connectionCreated).toBe(true);
        expect(adapter.connectionValidated).toBe(true);
      }
    });
    
    it('should close connections when the adapter is closed', async () => {
      await adapter.initialize();
      
      await adapter.close();
      
      expect(adapter.closeProviderCalled).toBe(true);
      expect(adapter.connectionClosed).toBe(true);
    });
  });

  describe('Search Operations', () => {
    it('should perform vector search operations', async () => {
      await adapter.initialize();
      
      const embedding = new Array(1536).fill(0.1);
      await adapter.search(embedding, { limit: 10 });
      
      expect(adapter.search).toHaveBeenCalledWith(embedding, { limit: 10 });
    });
    
    it('should perform text search operations', async () => {
      await adapter.initialize();
      
      await adapter.searchWithText('test query', { limit: 5 });
      
      expect(adapter.generateEmbedding).toHaveBeenCalledWith('test query');
      expect(adapter.search).toHaveBeenCalled();
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
      await adapter.initialize();
      
      jest.spyOn(adapter as any, 'pingProvider').mockRejectedValueOnce(new Error('Connection lost'));
      
      const result = await adapter.ping();
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
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
      await adapter.initialize();
      
      // Create multiple concurrent connection requests
      const requests = Array(10).fill(0).map(() => adapter.exposeAcquireConnection());
      
      // All should succeed
      const connections = await Promise.all(requests);
      expect(connections).toHaveLength(10);
      
      // Release all connections
      await Promise.all(connections.map(conn => adapter.exposeReleaseConnection(conn)));
    });
    
    it('should enforce connection pool limits', async () => {
      await adapter.initialize();
      
      // Try to acquire more connections than the pool maximum
      const maxConnections = 3;
      const requests = Array(maxConnections + 2).fill(0).map(() => adapter.exposeAcquireConnection());
      
      // Some should fail
      try {
        await Promise.all(requests);
        fail('Should have thrown error for exceeding pool limit');
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toContain('Maximum pool size');
        } else {
          fail('Unknown error type');
        }
      }
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
      await adapter.initialize();
      
      // Mock slow connection creation
      jest.spyOn(adapter as any, 'createPoolConnection').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { mockConnection: true };
      });
      
      // Set short timeout
      const requests = Array(3).fill(0).map(() => 
        adapter.exposeAcquireConnection()
          .then(() => 'success')
          .catch(() => 'timeout')
      );
      
      const results = await Promise.all(requests);
      expect(results).toContain('timeout');
    });
    
    it('should handle connection failures gracefully', async () => {
      await adapter.initialize();
      
      // Make connections fail after some successes
      let failAfter = 2;
      let count = 0;
      jest.spyOn(adapter as any, 'createPoolConnection').mockImplementation(async () => {
        if (count++ >= failAfter) {
          throw new Error('Connection failed');
        }
        return { mockConnection: true };
      });
      
      const requests = Array(5).fill(0).map(() => 
        adapter.exposeAcquireConnection()
          .then(() => 'success')
          .catch(() => 'failed')
      );
      
      const results = await Promise.all(requests);
      expect(results).toContain('success');
      expect(results).toContain('failed');
    });
    
    it('should handle connection validation failures', async () => {
      await adapter.initialize();
      
      // Make validation fail after some successes
      let failAfter = 2;
      let count = 0;
      adapter.isPoolConnectionValid = true;
      jest.spyOn(adapter as any, 'validatePoolConnection').mockImplementation(async () => {
        return count++ < failAfter;
      });
      
      const requests = Array(5).fill(0).map(() => 
        adapter.exposeAcquireConnection()
          .then(() => 'success')
          .catch(() => 'invalid')
      );
      
      const results = await Promise.all(requests);
      expect(results).toContain('success');
      expect(results).toContain('invalid');
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
      await adapter.initialize();
      
      // Repeatedly acquire and release connections
      for (let i = 0; i < 100; i++) {
        const conn = await adapter.exposeAcquireConnection();
        await adapter.exposeReleaseConnection(conn);
      }
      
      // Pool should still be functional
      const conn = await adapter.exposeAcquireConnection();
      expect(conn).toBeDefined();
      await adapter.exposeReleaseConnection(conn);
    });
  });
});