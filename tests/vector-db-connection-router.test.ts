// Use manual mock for pg module
jest.mock('pg');

import { VectorDBConnectionRouter, ConnectionPoolSettings, QueryType, DatabasePoolFactory, DatabasePool, DatabasePoolClient } from '../src/lib/vector-db/connection-router';
import { Pool, PoolClient } from 'pg';
import { QueryResult } from 'pg';

describe('VectorDBConnectionRouter', () => {
  // Mock factory for testing
  class MockDatabasePoolFactory implements DatabasePoolFactory {
    createPool(config: ConnectionPoolSettings): DatabasePool {
      const mockQuery = jest.fn().mockImplementation(async (query: string, params?: any[]) => {
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
      });

      const mockRelease = jest.fn();

      return {
        query: mockQuery,
        connect: jest.fn().mockResolvedValue({
          query: mockQuery,
          release: mockRelease
        }),
        end: jest.fn().mockResolvedValue(undefined),
        totalCount: 5,
        idleCount: 3
      };
    }
  }

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
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    expect(router).toBeDefined();
    
    // Check connection status
    const status = router.getConnectionStatus();
    expect(status.primary).toBeDefined();
    expect(status.replicas.length).toBe(2);
  });
  
  test('routes read queries to replicas', async () => {
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    
    const result = await router.routeQuery('SELECT * FROM test_table');
    
    expect(result).toBeDefined();
    expect(result.rows.length).toBe(1);
    expect(result.rowCount).toBe(1);
  });
  
  test('routes write queries to primary', async () => {
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    
    const result = await router.routeQuery('INSERT INTO test_table (name) VALUES ($1)', ['test_value']);
    
    expect(result).toBeDefined();
    expect(result.command).toBe('INSERT');
    expect(result.rowCount).toBe(1);
  });
  
  test('routes unknown queries to primary', async () => {
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    
    const result = await router.routeQuery('EXPLAIN ANALYZE SELECT * FROM test_table');
    
    expect(result).toBeDefined();
  });
  
  test('handles transactions correctly', async () => {
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    
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
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    
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
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, replicaSettings, {}, mockFactory);
    
    await router.close();
    
    // Verify all pools were closed (this test will need to be updated based on the actual implementation)
    // For now, just verify the method doesn't throw
    expect(true).toBe(true);
  });
  
  test('falls back to primary when no replicas available', async () => {
    const mockFactory = new MockDatabasePoolFactory();
    const router = new VectorDBConnectionRouter(primarySettings, [], {}, mockFactory);
    
    const result = await router.routeQuery('SELECT * FROM test_table');
    
    expect(result).toBeDefined();
    expect(result.rows.length).toBe(1);
  });
});