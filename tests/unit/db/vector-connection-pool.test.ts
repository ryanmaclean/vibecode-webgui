import { EventEmitter } from 'events';
import type { PoolClient, PoolConfig } from 'pg';

type MockPoolInstance = EventEmitter & {
  options: { max: number };
  connect: jest.Mock<Promise<PoolClient>, []>;
  end: jest.Mock<Promise<void>, []>;
};

const mockPoolInstances: MockPoolInstance[] = [];

jest.mock('pg', () => {
  const { EventEmitter } = require('events');

  return {
    Pool: class MockPool extends EventEmitter {
      public options: { max: number };
      public connect: jest.Mock<Promise<PoolClient>, []>;
      public end: jest.Mock<Promise<void>, []>;

      constructor(config: PoolConfig) {
        super();
        this.options = { max: config.max ?? 10 };

        this.connect = jest.fn(async () => {
          const client: PoolClient = {
            query: jest.fn(async () => ({ rows: [{ health_check: 1 }] })) as any,
            release: jest.fn() as any,
          } as PoolClient;

          this.emit('connect', client);

          return {
            ...client,
            release: (err?: Error) => {
              this.emit('remove', client, err);
              (client.release as jest.Mock)(err);
            },
          } as PoolClient;
        });

        this.end = jest.fn(async () => {
          return;
        });

        mockPoolInstances.push(this as unknown as MockPoolInstance);
      }
    },
  };
});

import { PoolEvent, VectorConnectionPoolFactory } from '../../../src/lib/db/vector-connection-pool';

const defaultConfig: PoolConfig = {
  host: 'localhost',
  port: 5432,
  database: 'test',
  user: 'postgres',
  password: 'password',
};

const clearFactoryPools = async () => {
  await VectorConnectionPoolFactory.closeAllPools();
};

describe('VectorConnectionPoolFactory', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeAll(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterAll(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });

  beforeEach(async () => {
    await clearFactoryPools();
    mockPoolInstances.length = 0;
  });

  afterEach(async () => {
    await clearFactoryPools();
    mockPoolInstances.length = 0;
  });

  it('creates and reuses pools with the same name', () => {
    const poolA = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'shared');
    const poolB = VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'shared');

    expect(poolA).toBe(poolB);
    expect(mockPoolInstances).toHaveLength(1);
  });

  it('emits events and updates metrics during acquire/release', async () => {
    const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 2 }, 'metrics');

    const events: PoolEvent[] = [];
    pool.on(PoolEvent.CREATED, () => events.push(PoolEvent.CREATED));
    pool.on(PoolEvent.ACQUIRED, () => events.push(PoolEvent.ACQUIRED));
    pool.on(PoolEvent.RELEASED, () => events.push(PoolEvent.RELEASED));

    const client = await pool.acquire();
    client.release();

    expect(events).toEqual([PoolEvent.CREATED, PoolEvent.ACQUIRED, PoolEvent.RELEASED]);

    const metrics = pool.getMetrics();
    // Use acquiredConnections which is the cumulative count in the metrics interface
    expect(metrics.acquiredConnections).toBe(1);
    expect(metrics.activeConnections).toBe(0);
  });

  it('records pool exhaustion when max connections reached', async () => {
    const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 1 }, 'exhausted');

    const events: PoolEvent[] = [];
    pool.on(PoolEvent.EXHAUSTED, () => events.push(PoolEvent.EXHAUSTED));

    const firstClient = await pool.acquire();

    const acquirePromise = pool.acquire();

    await expect(acquirePromise).resolves.toBeDefined();

    // Verify the EXHAUSTED event was emitted
    expect(events).toEqual([PoolEvent.EXHAUSTED]);

    firstClient.release();
  });

  it('increments timeout metrics when connect throws', async () => {
    const pool = VectorConnectionPoolFactory.createPool(defaultConfig, { max: 1 }, 'timeout');

    const mockPool = mockPoolInstances[mockPoolInstances.length - 1];
    mockPool.connect.mockImplementationOnce(async () => {
      throw new Error('timeout exceeded');
    });

    await expect(pool.acquire()).rejects.toThrow('timeout exceeded');

    const metrics = pool.getMetrics();
    // totalTimeouts and errors are available in the metrics
    expect(metrics.totalTimeouts).toBeGreaterThanOrEqual(1);
    expect(metrics.errors).toBeGreaterThanOrEqual(1);
  });

  it('closes pools via closeAllPools()', async () => {
    VectorConnectionPoolFactory.createPool(defaultConfig, {}, 'close');

    await VectorConnectionPoolFactory.closeAllPools();

    expect(VectorConnectionPoolFactory.getAllPools().size).toBe(0);
    expect(mockPoolInstances[0]?.end).toHaveBeenCalled();
  });
});
