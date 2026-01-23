/**
 * Integration tests for database pool connection handling
 * Tests connection lifecycle, pool management, metrics, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { EventEmitter } from 'events';
import type { PoolClient, PoolConfig, QueryResult } from 'pg';
import { ENV_MOCK, MockUtils } from '../utils/mock-templates';

// Track mock pool instances
type MockPoolInstance = EventEmitter & {
  options: { max: number };
  connect: jest.Mock<Promise<PoolClient>, []>;
  end: jest.Mock<Promise<void>, []>;
  query: jest.Mock;
};

const mockPoolInstances: MockPoolInstance[] = [];

// Mock pg module
jest.mock('pg', () => {
  const { EventEmitter } = require('events');

  return {
    Pool: class MockPool extends EventEmitter {
      public options: { max: number };
      public connect: jest.Mock<Promise<PoolClient>, []>;
      public end: jest.Mock<Promise<void>, []>;
      public query: jest.Mock;

      constructor(config: PoolConfig) {
        super();
        this.options = { max: config.max ?? 10 };

        this.query = jest.fn(async (sql: string, _params?: any[]) => {
          // Simulate health check query
          if (sql.includes('SELECT 1')) {
            return { rows: [{ health_check: 1 }], rowCount: 1 };
          }
          // Generic query response
          return { rows: [], rowCount: 0 };
        });

        this.connect = jest.fn(async () => {
          const client: PoolClient = {
            query: this.query as any,
            release: jest.fn() as any
          } as PoolClient;

          this.emit('connect', client);

          return {
            ...client,
            release: (err?: Error) => {
              this.emit('remove', client, err);
              (client.release as jest.Mock)(err);
            }
          } as PoolClient;
        });

        this.end = jest.fn(async () => {
          return;
        });

        mockPoolInstances.push(this as unknown as MockPoolInstance);
      }
    }
  };
});

import {
  VectorConnectionPool,
  VectorConnectionPoolFactory,
  PoolEvent
} from '@/lib/db/vector-connection-pool';
import { PoolState } from '@/lib/db/connection-pool-types';

const defaultConfig: PoolConfig = {
  host: 'localhost',
  port: 5432,
  database: 'test',
  user: 'postgres',
  password: 'password'
};

const clearFactoryPools = async () => {
  await VectorConnectionPoolFactory.closeAllPools();
};

describe('Database Pool Connection Integration', () => {
  let consoleSpy: {
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    log: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeAll(() => {
    Object.assign(process.env, ENV_MOCK.test());
  });

  beforeEach(async () => {
    MockUtils.resetAllMocks();
    await clearFactoryPools();
    mockPoolInstances.length = 0;

    // Silence console output during tests
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearFactoryPools();
    mockPoolInstances.length = 0;
  });

  describe('Pool Factory Operations', () => {
    it('should create a new pool with default configuration', () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'default-config');

      expect(pool).toBeDefined();
      expect(pool.name).toBe('default-config');
      expect(mockPoolInstances).toHaveLength(1);
    });

    it('should create pool with custom configuration', () => {
      const pool = VectorConnectionPoolFactory.createPool(
        defaultConfig,
        { max: 5, min: 1 },
        'custom-config'
      );

      expect(pool).toBeDefined();
      expect(pool.name).toBe('custom-config');
    });

    it('should reuse existing pool with same name', () => {
      const pool1 = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'reuse-test');
      const pool2 = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'reuse-test');

      expect(pool1).toBe(pool2);
      expect(mockPoolInstances).toHaveLength(1);
    });

    it('should create separate pools with different names', () => {
      const pool1 = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'pool-1');
      const pool2 = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'pool-2');

      expect(pool1).not.toBe(pool2);
      expect(mockPoolInstances).toHaveLength(2);
    });

    it('should get existing pool by name', () => {
      const created = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'get-test');
      const retrieved = VectorConnectionPoolFactory.getPool('get-test');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent pool', () => {
      const pool = VectorConnectionPoolFactory.getPool('non-existent');

      expect(pool).toBeUndefined();
    });

    it('should get all pools', () => {
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'all-1');
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'all-2');
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'all-3');

      const allPools = VectorConnectionPoolFactory.getAllPools();

      expect(allPools.size).toBe(3);
      expect(allPools.has('all-1')).toBe(true);
      expect(allPools.has('all-2')).toBe(true);
      expect(allPools.has('all-3')).toBe(true);
    });

    it('should close all pools', async () => {
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'close-1');
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'close-2');

      expect(VectorConnectionPoolFactory.getAllPools().size).toBe(2);

      await VectorConnectionPoolFactory.closeAllPools();

      expect(VectorConnectionPoolFactory.getAllPools().size).toBe(0);
    });
  });

  describe('Connection Acquisition and Release', () => {
    it('should acquire a connection from the pool', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'acquire-test');

      const client = await pool.acquire();

      expect(client).toBeDefined();
      expect(client.query).toBeDefined();
      expect(client.release).toBeDefined();

      client.release();
    });

    it('should release connection back to pool', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'release-test');

      const client = await pool.acquire();
      const metrics1 = pool.getMetrics();
      expect(metrics1.activeConnections).toBe(1);

      client.release();

      const metrics2 = pool.getMetrics();
      expect(metrics2.activeConnections).toBe(0);
    });

    it('should acquire multiple connections', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'multi-acquire');

      const clients = await Promise.all([
        pool.acquire(),
        pool.acquire(),
        pool.acquire()
      ]);

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(3);

      clients.forEach(client => client.release());

      const metricsAfter = pool.getMetrics();
      expect(metricsAfter.activeConnections).toBe(0);
    });
  });

  describe('Pool Events', () => {
    it('should emit CREATED event on new connection', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 2 }, 'event-created');

      const events: PoolEvent[] = [];
      pool.on(PoolEvent.CREATED, () => events.push(PoolEvent.CREATED));

      const client = await pool.acquire();
      client.release();

      expect(events).toContain(PoolEvent.CREATED);
    });

    it('should emit ACQUIRED event when connection acquired', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 2 }, 'event-acquired');

      const events: PoolEvent[] = [];
      pool.on(PoolEvent.ACQUIRED, () => events.push(PoolEvent.ACQUIRED));

      const client = await pool.acquire();
      client.release();

      expect(events).toContain(PoolEvent.ACQUIRED);
    });

    it('should emit RELEASED event when connection released', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 2 }, 'event-released');

      const events: PoolEvent[] = [];
      pool.on(PoolEvent.RELEASED, () => events.push(PoolEvent.RELEASED));

      const client = await pool.acquire();
      client.release();

      expect(events).toContain(PoolEvent.RELEASED);
    });

    it('should emit correct event sequence during connection lifecycle', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 2 }, 'event-sequence');

      const events: PoolEvent[] = [];
      pool.on(PoolEvent.CREATED, () => events.push(PoolEvent.CREATED));
      pool.on(PoolEvent.ACQUIRED, () => events.push(PoolEvent.ACQUIRED));
      pool.on(PoolEvent.RELEASED, () => events.push(PoolEvent.RELEASED));

      const client = await pool.acquire();
      client.release();

      expect(events).toEqual([PoolEvent.CREATED, PoolEvent.ACQUIRED, PoolEvent.RELEASED]);
    });

    it('should emit EXHAUSTED event when pool is at capacity', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 1 }, 'event-exhausted');

      const events: PoolEvent[] = [];
      pool.on(PoolEvent.EXHAUSTED, () => events.push(PoolEvent.EXHAUSTED));

      const client1 = await pool.acquire();

      // Second acquire should trigger exhausted event
      const client2Promise = pool.acquire();
      await expect(client2Promise).resolves.toBeDefined();

      expect(events).toContain(PoolEvent.EXHAUSTED);

      client1.release();
      (await client2Promise).release();
    });
  });

  describe('Pool Metrics', () => {
    it('should track acquired connections', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'metrics-acquired');

      const client1 = await pool.acquire();
      const client2 = await pool.acquire();

      const metrics = pool.getMetrics();
      expect(metrics.acquiredConnections).toBeGreaterThanOrEqual(2);

      client1.release();
      client2.release();
    });

    it('should track active connections', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'metrics-active');

      expect(pool.getMetrics().activeConnections).toBe(0);

      const client = await pool.acquire();
      expect(pool.getMetrics().activeConnections).toBe(1);

      client.release();
      expect(pool.getMetrics().activeConnections).toBe(0);
    });

    it('should track average acquire time', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'metrics-time');

      const client = await pool.acquire();
      client.release();

      const metrics = pool.getMetrics();
      expect(metrics.averageAcquireTime).toBeGreaterThanOrEqual(0);
    });

    it('should track error count', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 1 }, 'metrics-errors');

      // Force an error by making connect throw
      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];
      mockPool.connect.mockImplementationOnce(async () => {
        throw new Error('Connection failed');
      });

      await expect(pool.acquire()).rejects.toThrow('Connection failed');

      const metrics = pool.getMetrics();
      expect(metrics.errors).toBeGreaterThanOrEqual(1);
    });

    it('should track timeout count', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 1 }, 'metrics-timeout');

      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];
      mockPool.connect.mockImplementationOnce(async () => {
        throw new Error('timeout exceeded');
      });

      await expect(pool.acquire()).rejects.toThrow('timeout');

      const metrics = pool.getMetrics();
      expect(metrics.totalTimeouts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Pool Status', () => {
    it('should return correct pool status', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 10 }, 'status-test');

      const status = pool.getStatus();

      expect(status.name).toBe('status-test');
      expect(status.maxSize).toBe(10);
      expect(status.inUse).toBe(0);
      expect(status.available).toBeGreaterThanOrEqual(0);
    });

    it('should update status when connections acquired', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'status-update');

      const client = await pool.acquire();
      const status = pool.getStatus();

      expect(status.inUse).toBe(1);

      client.release();
    });

    it('should calculate utilization correctly', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 2 }, 'status-util');

      const client = await pool.acquire();
      const status = pool.getStatus();

      // With 1 of 2 connections in use, utilization should be 50%
      expect(status.utilization).toBeGreaterThan(0);

      client.release();
    });
  });

  describe('Query Execution', () => {
    it('should execute query and return result', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'query-test');

      const result = await pool.query('SELECT 1 as health_check');

      expect(result.rows).toBeDefined();
      expect(result.rows[0].health_check).toBe(1);
    });

    it('should release connection after query', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'query-release');

      await pool.query('SELECT 1 as health_check');

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });

    it('should execute query with parameters', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'query-params');

      const result = await pool.query('SELECT $1 as value', ['test-value']);

      expect(result).toBeDefined();
    });
  });

  describe('Transaction Support', () => {
    it('should execute transaction successfully', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'tx-success');

      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];
      const queryMock = mockPool.query;

      const result = await pool.withTransaction(async (client) => {
        await client.query('SELECT 1');
        return 'transaction-result';
      });

      expect(result).toBe('transaction-result');
      // Should have called BEGIN and COMMIT
      expect(queryMock).toHaveBeenCalledWith('BEGIN');
      expect(queryMock).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'tx-rollback');

      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];
      const queryMock = mockPool.query;

      await expect(
        pool.withTransaction(async (_client) => {
          throw new Error('Transaction error');
        })
      ).rejects.toThrow('Transaction error');

      // Should have called BEGIN and ROLLBACK
      expect(queryMock).toHaveBeenCalledWith('BEGIN');
      expect(queryMock).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should release connection after transaction', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'tx-release');

      await pool.withTransaction(async (client) => {
        await client.query('SELECT 1');
        return true;
      });

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return true for healthy pool', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'health-check');

      const healthy = await pool.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should update last health check timestamp', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'health-timestamp');

      const beforeCheck = new Date();
      await pool.healthCheck();
      const status = pool.getStatus();

      expect(status.lastHealthCheck.getTime()).toBeGreaterThanOrEqual(beforeCheck.getTime());
    });

    it('should return false when health check query fails', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'health-fail');

      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];
      mockPool.query.mockImplementationOnce(async () => {
        throw new Error('Connection error');
      });

      const healthy = await pool.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should check health of all pools', async () => {
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'health-all-1');
      VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'health-all-2');

      const healthResults = await VectorConnectionPoolFactory.checkAllPoolsHealth();

      expect(healthResults.size).toBe(2);
      expect(healthResults.get('health-all-1')).toBe(true);
      expect(healthResults.get('health-all-2')).toBe(true);
    });
  });

  describe('Pool Lifecycle', () => {
    it('should drain pool before closing', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'drain-test');

      const client = await pool.acquire();

      // Start draining in background
      const drainPromise = pool.drain();

      // Release connection to allow drain to complete
      client.release();

      await drainPromise;

      expect(pool.status).toBe(PoolState.DRAINING);
    });

    it('should close pool', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'close-test');

      await pool.close();

      expect(pool.status).toBe(PoolState.CLOSED);
      expect(mockPoolInstances[0]?.end).toHaveBeenCalled();
    });

    it('should reject acquire after shutdown started', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'shutdown-reject');

      await pool.close();

      await expect(pool.acquire()).rejects.toThrow('Pool is shutting down');
    });
  });

  describe('Pool Size Management', () => {
    it('should change max pool size', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'size-change');

      pool.setMaxPoolSize(10);

      const status = pool.getStatus();
      expect(status.maxSize).toBe(10);
    });

    it('should reject invalid pool size', async () => {
      const pool = VectorConnectionPoolFactory.createPool(
        defaultConfig,
        { max: 5, min: 2 },
        'size-invalid'
      );

      expect(() => pool.setMaxPoolSize(1)).toThrow();
    });
  });

  describe('Concurrent Connection Handling', () => {
    it('should handle many concurrent acquisitions', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 50 }, 'concurrent-test');

      const clients = await Promise.all(
        Array.from({ length: 20 }, () => pool.acquire())
      );

      expect(clients).toHaveLength(20);

      // Release all connections
      clients.forEach(client => client.release());

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });

    it('should handle rapid acquire/release cycles', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'rapid-cycle');

      for (let i = 0; i < 10; i++) {
        const client = await pool.acquire();
        client.release();
      }

      const metrics = pool.getMetrics();
      expect(metrics.acquiredConnections).toBeGreaterThanOrEqual(10);
      expect(metrics.activeConnections).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from connection errors', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'error-recovery');

      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];

      // First call fails
      mockPool.connect.mockImplementationOnce(async () => {
        throw new Error('Temporary error');
      });

      // First attempt should fail
      await expect(pool.acquire()).rejects.toThrow('Temporary error');

      // Second attempt should succeed (default mock behavior)
      const client = await pool.acquire();
      expect(client).toBeDefined();
      client.release();
    });

    it('should track error metrics across failures', async () => {
      const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 5 }, 'error-metrics');

      const mockPool = mockPoolInstances[mockPoolInstances.length - 1];

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        mockPool.connect.mockImplementationOnce(async () => {
          throw new Error('Connection failed');
        });

        await expect(pool.acquire()).rejects.toThrow('Connection failed');
      }

      const metrics = pool.getMetrics();
      expect(metrics.errors).toBe(3);
    });
  });
});
