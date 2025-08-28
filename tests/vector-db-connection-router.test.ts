import { VectorDBConnectionRouter, ConnectionPoolSettings, QueryType } from '../src/lib/vector-db/connection-router';
import { Pool, PoolClient } from 'pg';
import { QueryResult } from 'pg';

// Mock implementation for pg Pool
jest.mock('pg', () => {
  // Store for our mock connections
  const connections: Record<string, any> = {};
  
  // Mock PoolClient
  const MockPoolClient = jest.fn().mockImplementation(() => {
    return {
      query: jest.fn().mockImplementation(async (query) => {
        if (query === 'BEGIN') return { rows: [] };
        if (query === 'COMMIT') return { rows: [] };
        if (query === 'ROLLBACK') return { rows: [] };
        
        if (query === 'SELECT 1 as health_check') {
          return { rows: [{ health_check: 1 }] };
        }
        
        if (query.includes('pg_last_xact_replay_timestamp')) {
          return { rows: [{ lag_ms: 50 }] };
        }
        
        // Default for read queries (based on test expectations)
        if (query.startsWith('SELECT')) {
          return { 
            rows: [{ id: 1, name: 'test', vector: [0.1, 0.2, 0.3] }], 
            rowCount: 1 
          };
        }
        
        // Default for write queries
        if (query.startsWith('INSERT')) {
          return { 
            rows: [], 
            rowCount: 1, 
            command: 'INSERT', 
            oid: 0,
            fields: [] 
          };
        }
        
        return { rows: [], rowCount: 0 };
      }),
      release: jest.fn()
    };
  });
  
  // Mock Pool
  const MockPool = jest.fn().mockImplementation((config) => {
    const poolKey = `${config.host}:${config.port}/${config.database}`;
    connections[poolKey] = connections[poolKey] || {
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0
    };
    
    return {
      totalCount: 5,
      idleCount: 3,
      connect: jest.fn().mockImplementation(async () => {
        return new MockPoolClient();
      }),
      query: jest.fn().mockImplementation(async (query, params) => {
        // Simply delegate to a new client
        const client = new MockPoolClient();
        return client.query(query, params);
      }),
      end: jest.fn().mockResolvedValue(undefined)
    };
  });
  
  return {
    Pool: MockPool,
    PoolClient: MockPoolClient
  };
});

describe('VectorDBConnectionRouter', () => {
  // Test connection settings
  const primarySettings: ConnectionPoolSettings = {
    host: 'primary-db',
    port: 5432,
    database: 'testdb',
    user: 'postgres',
    password: 'password'
  };
  
  const replicaSettings: ConnectionPoolSettings[] = [
    {
      host: 'replica1-db',
      port: 5432,
      database: 'testdb',
      user: 'postgres',
      password: 'password'
    },
    {
      host: 'replica2-db',
      port: 5432,
      database: 'testdb',
      user: 'postgres',
      password: 'password'
    }
  ];
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('initializes with primary and replica pools', () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    expect(router).toBeDefined();
    
    // Check connection status
    const status = router.getConnectionStatus();
    expect(status.primary).toBeDefined();
    expect(status.replicas.length).toBe(2);
  });
  
  test('routes read queries to replicas', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    
    const result = await router.routeQuery('SELECT * FROM test_table');
    
    expect(result).toBeDefined();
    expect(result.rows.length).toBe(1);
    expect(result.rowCount).toBe(1);
  });
  
  test('routes write queries to primary', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    
    const result = await router.routeQuery('INSERT INTO test_table (name) VALUES ($1)', ['test_value']);
    
    expect(result).toBeDefined();
    expect(result.command).toBe('INSERT');
    expect(result.rowCount).toBe(1);
  });
  
  test('routes unknown queries to primary', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    
    const result = await router.routeQuery('EXPLAIN ANALYZE SELECT * FROM test_table');
    
    expect(result).toBeDefined();
  });
  
  test('handles transactions correctly', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    
    await router.beginTransaction();
    expect(router['inTransaction']).toBe(true);
    expect(router['transactionClient']).not.toBeNull();
    
    // Queries during transaction should use the transaction client
    await router.routeQuery('INSERT INTO test_table (name) VALUES ($1)', ['test_value']);
    
    await router.commitTransaction();
    expect(router['inTransaction']).toBe(false);
    expect(router['transactionClient']).toBeNull();
  });
  
  test('rolls back transactions on error', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    
    await router.beginTransaction();
    
    // Force transaction client to throw error on commit
    if (router['transactionClient']) {
      router['transactionClient'].query = jest.fn().mockImplementation((query) => {
        if (query === 'COMMIT') {
          throw new Error('Commit failed');
        }
        return Promise.resolve({ rows: [] });
      });
    }
    
    await expect(router.commitTransaction()).rejects.toThrow('Commit failed');
    expect(router['inTransaction']).toBe(false);
    expect(router['transactionClient']).toBeNull();
  });
  
  test('closes all connections properly', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings);
    
    await router.close();
    
    // Verify all pools were closed
    expect(Pool.prototype.end).toHaveBeenCalledTimes(3); // Primary + 2 replicas
  });
  
  test('falls back to primary when no replicas available', async () => {
    const router = new VectorDBConnectionRouter(primarySettings, []);
    
    const result = await router.routeQuery('SELECT * FROM test_table');
    
    expect(result).toBeDefined();
    expect(result.rows.length).toBe(1);
  });
});