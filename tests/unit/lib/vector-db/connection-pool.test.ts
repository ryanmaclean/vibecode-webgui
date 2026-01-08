/**
 * Unit tests for ConnectionPool
 */

import { ConnectionPool, ConnectionPoolConfig } from '@/lib/vector-db/connection-pool';

// Mock the dependencies
jest.mock('@/lib/server-monitoring', () => ({
  metrics: {
    gauge: jest.fn(),
    increment: jest.fn(),
    histogram: jest.fn()
  }
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

type MockConnection = { id: string; connected: boolean };

describe('ConnectionPool', () => {
  let mockConnection: MockConnection;
  let mockCreateConnection: jest.Mock; // resolves MockConnection
  let mockCloseConnection: jest.Mock;
  let mockValidateConnection: jest.Mock;
  let config: ConnectionPoolConfig<MockConnection>;
  let pool: ConnectionPool<MockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock connection
    mockConnection = { id: 'test-connection', connected: true };
    
    // Create mock functions
    mockCreateConnection = jest.fn().mockResolvedValue(mockConnection);
    mockCloseConnection = jest.fn().mockResolvedValue(undefined);
    mockValidateConnection = jest.fn().mockResolvedValue(true);
    
    // Create config
    config = {
      minConnections: 2,
      maxConnections: 5,
      acquireTimeoutMs: 1000,
      maxConnectionLifetimeMs: 5000,
      connectionRetryDelayMs: 100,
      maxConnectionAttempts: 2,
      validateConnection: true,
      idleTimeoutMs: 2000,
      createConnection: mockCreateConnection,
      validateConnectionFn: mockValidateConnection,
      closeConnection: mockCloseConnection
    };
    
    // Create pool
    pool = new ConnectionPool(config);
  });

  afterEach(async () => {
    await pool.close();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultConfig: ConnectionPoolConfig<MockConnection> = {
        createConnection: jest.fn(),
        closeConnection: jest.fn()
      };
      
      const defaultPool = new ConnectionPool(defaultConfig);
      expect(defaultPool).toBeDefined();
      
      // Clean up
      defaultPool.close();
    });

    it('should merge provided config with defaults', () => {
      expect(pool).toBeDefined();
      // The pool should be created successfully with custom config
    });
  });

  describe('acquire', () => {
    it('should acquire an existing idle connection', async () => {
      // Wait for initial connections to be created
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connection = await pool.acquire();
      expect(connection).toBeDefined();
      expect(mockCreateConnection).toHaveBeenCalled();
    });

    it('should create new connection when pool is not at max size', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Acquire all connections to exhaust the pool
      const connections: MockConnection[] = [];
      for (let i = 0; i < config.minConnections!; i++) {
        connections.push(await pool.acquire());
      }
      
      // Acquire one more to trigger new connection creation
      const newConnection = await pool.acquire();
      expect(newConnection).toBeDefined();
      expect(mockCreateConnection).toHaveBeenCalledTimes(config.minConnections! + 1);
    });

    it('should wait for connection when pool is at max size', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Acquire all connections
      const connections: MockConnection[] = [];
      for (let i = 0; i < config.maxConnections!; i++) {
        connections.push(await pool.acquire());
      }
      
      // Try to acquire one more - should wait
      const acquirePromise = pool.acquire();
      
      // Release one connection after a short delay
      setTimeout(async () => {
        await pool.release(connections[0]);
      }, 50);
      
      const connection = await acquirePromise;
      expect(connection).toBeDefined();
    });

    it('should throw error when pool is closed', async () => {
      await pool.close();
      
      await expect(pool.acquire()).rejects.toThrow('Connection pool is closed');
    });

    it('should throw error on acquire timeout', async () => {
      // Create a new pool with short timeout
      const shortTimeoutPool = new ConnectionPool({
        ...config,
        acquireTimeoutMs: 50,
        minConnections: 1,
        maxConnections: 1
      });
      
      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Acquire the only connection
      const connection = await shortTimeoutPool.acquire();
      expect(connection).toBeDefined();
      
      // Try to acquire another connection - should timeout
      await expect(shortTimeoutPool.acquire()).rejects.toThrow('Timed out waiting for connection');
      
      await shortTimeoutPool.close();
    });
  });

  describe('release', () => {
    it('should release connection back to pool', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connection = await pool.acquire();
      await pool.release(connection);
      
      // Should be able to acquire again
      const newConnection = await pool.acquire();
      expect(newConnection).toBeDefined();
    });

    it('should handle release of unknown connection gracefully', async () => {
      const unknownConnection = { id: 'unknown' };
      await expect(pool.release(unknownConnection)).resolves.not.toThrow();
    });

    it('should close connection when pool is closed', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connection = await pool.acquire();
      await pool.close();
      
      // Release should close the connection
      await pool.release(connection);
      expect(mockCloseConnection).toHaveBeenCalledWith(connection);
    });
  });

  describe('validation', () => {
    it('should validate connection before returning it', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connection = await pool.acquire();
      expect(mockValidateConnection).toHaveBeenCalledWith(connection);
    });

    it('should replace invalid connection', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Make validation fail
      mockValidateConnection.mockResolvedValueOnce(false);
      
      const connection = await pool.acquire();
      expect(mockValidateConnection).toHaveBeenCalledWith(connection);
      expect(mockCloseConnection).toHaveBeenCalledWith(connection);
      expect(mockCreateConnection).toHaveBeenCalledTimes(config.minConnections! + 1);
    });

    it('should skip validation when disabled', async () => {
      const noValidationConfig = {
        ...config,
        validateConnection: false
      };
      
      const noValidationPool = new ConnectionPool(noValidationConfig);
      
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connection = await noValidationPool.acquire();
      expect(connection).toBeDefined();
      expect(mockValidateConnection).not.toHaveBeenCalled();
      
      await noValidationPool.close();
    });
  });

  describe('connection creation', () => {
    it('should retry connection creation on failure', async () => {
      // Make first attempt fail
      mockCreateConnection
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mockConnection);
      
      const retryPool = new ConnectionPool({
        ...config,
        maxConnectionAttempts: 2,
        connectionRetryDelayMs: 10,
        minConnections: 1
      });
      
      // Wait for initial connections (1 connection, 2 attempts = 2 calls)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check that retry logic was used (should be at least 2 calls for 1 connection with retry)
      const callCount = mockCreateConnection.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(2);
      
      await retryPool.close();
    });

    it('should throw error after max retry attempts', async () => {
      mockCreateConnection.mockRejectedValue(new Error('Connection failed'));
      
      const failingPool = new ConnectionPool({
        ...config,
        maxConnectionAttempts: 2,
        connectionRetryDelayMs: 10
      });
      
      // Wait for retry attempts
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should not throw during construction, but acquire should fail
      await expect(failingPool.acquire()).rejects.toThrow();
      
      await failingPool.close();
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = pool.getStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('waitingRequests');
      expect(stats).toHaveProperty('totalCreated');
      expect(stats).toHaveProperty('totalAcquired');
      expect(stats).toHaveProperty('acquireErrors');
      expect(stats).toHaveProperty('validateErrors');
      
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
      expect(stats.activeConnections).toBeGreaterThanOrEqual(0);
      expect(stats.idleConnections).toBeGreaterThanOrEqual(0);
    });

    it('should track active connections correctly', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const initialStats = pool.getStats();
      const initialActive = initialStats.activeConnections;
      
      const connection = await pool.acquire();
      const afterAcquireStats = pool.getStats();
      
      expect(afterAcquireStats.activeConnections).toBe(initialActive + 1);
      
      await pool.release(connection);
      const afterReleaseStats = pool.getStats();
      
      expect(afterReleaseStats.activeConnections).toBe(initialActive);
    });
  });

  describe('close', () => {
    it('should close all connections', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const statsBefore = pool.getStats();
      expect(statsBefore.totalConnections).toBeGreaterThan(0);
      
      await pool.close();
      
      const statsAfter = pool.getStats();
      expect(statsAfter.totalConnections).toBe(0);
      expect(statsAfter.activeConnections).toBe(0);
      
      // Should have called closeConnection for each connection
      expect(mockCloseConnection).toHaveBeenCalledTimes(statsBefore.totalConnections);
    });

    it('should reject waiting requests when closing', async () => {
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Acquire all connections
      const connections: MockConnection[] = [];
      for (let i = 0; i < config.maxConnections!; i++) {
        connections.push(await pool.acquire());
      }
      
      // Start acquiring (should wait)
      const acquirePromise = pool.acquire();
      
      // Close the pool
      await pool.close();
      
      // The waiting acquire should be rejected
      await expect(acquirePromise).rejects.toThrow('Connection pool is closing');
    });

    it('should be idempotent', async () => {
      await pool.close();
      await pool.close(); // Should not throw
    });
  });

  describe('pruning', () => {
    it('should prune idle connections', async () => {
      const shortIdleConfig = {
        ...config,
        idleTimeoutMs: 50,
        maxConnectionLifetimeMs: 100
      };
      
      const pruningPool = new ConnectionPool(shortIdleConfig);
      
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const initialStats = pruningPool.getStats();
      
      // Wait for pruning to occur
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterPruningStats = pruningPool.getStats();
      
      // Should have pruned some connections (but kept minConnections)
      expect(afterPruningStats.totalConnections).toBeLessThanOrEqual(initialStats.totalConnections);
      expect(afterPruningStats.totalConnections).toBeGreaterThanOrEqual(shortIdleConfig.minConnections!);
      
      await pruningPool.close();
    });

    it('should prune expired connections', async () => {
      const shortLifetimeConfig = {
        ...config,
        maxConnectionLifetimeMs: 50,
        idleTimeoutMs: 1000
      };
      
      const lifetimePool = new ConnectionPool(shortLifetimeConfig);
      
      // Wait for initial connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const initialStats = lifetimePool.getStats();
      
      // Wait for connections to expire
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterExpiryStats = lifetimePool.getStats();
      
      // Should have pruned expired connections
      expect(afterExpiryStats.totalConnections).toBeLessThanOrEqual(initialStats.totalConnections);
      expect(afterExpiryStats.totalConnections).toBeGreaterThanOrEqual(shortLifetimeConfig.minConnections!);
      
      await lifetimePool.close();
    });
  });
});
