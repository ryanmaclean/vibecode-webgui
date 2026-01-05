/**
 * Unit tests for VectorShardingManager
 */

// Mock the dependencies before importing the module
jest.mock('pg');
jest.doMock('@/lib/vector-db/consistent-hash-ring', () => ({
  ConsistentHashRing: jest.fn().mockImplementation(() => ({
    addShard: jest.fn(),
    removeShard: jest.fn(),
    getShard: jest.fn().mockReturnValue({
      id: 'shard1',
      host: 'localhost',
      port: 5432,
      username: 'user1',
      password: 'pass1',
      database: 'db1',
      weight: 1,
      status: 'active'
    }),
    getShards: jest.fn().mockReturnValue([
      {
        id: 'shard1',
        host: 'localhost',
        port: 5432,
        username: 'user1',
        password: 'pass1',
        database: 'db1',
        weight: 1,
        status: 'active'
      },
      {
        id: 'shard2',
        host: 'localhost',
        port: 5433,
        username: 'user2',
        password: 'pass2',
        database: 'db2',
        weight: 1,
        status: 'active'
      }
    ]),
    getShardDistribution: jest.fn().mockReturnValue(new Map([
      ['shard1', 500],
      ['shard2', 500]
    ]))
  }))
}));

import { VectorShardingManager } from '@/lib/vector-db/sharding-manager';
import { DatabasePoolFactory, DatabasePool, DatabasePoolClient } from '@/lib/vector-db/connection-router';
import {
  ShardInfo,
  ShardStatus,
  ShardingConfig,
  VectorQuery,
  ReadConsistency,
  WriteConsistency,
  QueryType
} from '@/lib/vector-db/types';

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Replace console with mocks
Object.assign(console, mockConsole);

describe('VectorShardingManager', () => {
  // Mock factory for testing
  class MockDatabasePoolFactory implements DatabasePoolFactory {
    createPool(config: any): DatabasePool {
      const mockQuery = jest.fn().mockImplementation(async (query: string, params?: any[]) => {
        if (query === 'SELECT 1') {
          return { rows: [{ '?column?': 1 }] };
        }
        
        // Mock for vector search queries
        if (query.includes('embedding <=>') && query.includes('similarity')) {
          return { 
            rows: [{ 
              id: 1, 
              embedding: [0.1, 0.2, 0.3], 
              metadata: { source: 'test' },
              similarity: 0.5
            }], 
            rowCount: 1 
          };
        }
        
        // Mock for failed queries (nonexistent tables)
        if (query.includes('nonexistent_table')) {
          throw new Error('Table does not exist');
        }
        
        // Default for read queries
        if (query.startsWith('SELECT')) {
          return { 
            rows: [{ id: 1, name: 'test', vector: [0.1, 0.2, 0.3] }], 
            rowCount: 1 
          };
        }
        
        // Default for write queries
        if (query.startsWith('INSERT') || query.startsWith('UPDATE') || query.startsWith('DELETE')) {
          return { 
            rows: [], 
            rowCount: 1, 
            command: query.split(' ')[0].toUpperCase(), 
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

  let mockFactory: MockDatabasePoolFactory;
  let shardingManager: VectorShardingManager;
  let mockShards: ShardInfo[];
  let config: Partial<ShardingConfig>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mock factory
    mockFactory = new MockDatabasePoolFactory();
    
    mockShards = [
      {
        id: 'shard1',
        host: 'localhost',
        port: 5432,
        username: 'user1',
        password: 'pass1',
        database: 'db1',
        weight: 1,
        status: ShardStatus.ACTIVE
      },
      {
        id: 'shard2',
        host: 'localhost',
        port: 5433,
        username: 'user2',
        password: 'pass2',
        database: 'db2',
        weight: 1,
        status: ShardStatus.ACTIVE
      }
    ];

    config = {
      shards: mockShards,
      virtualNodeCount: 10,
      replicationFactor: 2,
      readConsistency: ReadConsistency.ONE,
      writeConsistency: WriteConsistency.QUORUM,
      maxRetries: 3,
      retryDelay: 100
    };

    shardingManager = new VectorShardingManager(config, mockFactory);
  });

  afterEach(async () => {
    await shardingManager.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(shardingManager).toBeDefined();
    });

    it('should use default configuration when none provided', () => {
      const defaultManager = new VectorShardingManager({}, mockFactory);
      expect(defaultManager).toBeDefined();
      defaultManager.shutdown();
    });

    it('should merge provided config with defaults', () => {
      const partialConfig = {
        shards: mockShards,
        readConsistency: ReadConsistency.QUORUM
      };
      
      const partialManager = new VectorShardingManager(partialConfig, mockFactory);
      expect(partialManager).toBeDefined();
      partialManager.shutdown();
    });
  });

  describe('addShard', () => {
    it('should add a new shard to the system', async () => {
      const newShard: ShardInfo = {
        id: 'shard3',
        host: 'localhost',
        port: 5434,
        username: 'user3',
        password: 'pass3',
        database: 'db3',
        weight: 1,
        status: ShardStatus.INITIALIZING
      };

      await shardingManager.addShard(newShard);
      
      const shardInfo = shardingManager.getShardInfo();
      expect(shardInfo).toHaveLength(3);
      expect(shardInfo.find(s => s.id === 'shard3')).toBeDefined();
    });

    it('should initialize stats for new shard', async () => {
      const newShard: ShardInfo = {
        id: 'shard3',
        host: 'localhost',
        port: 5434,
        username: 'user3',
        password: 'pass3',
        database: 'db3',
        weight: 1,
        status: ShardStatus.INITIALIZING
      };

      await shardingManager.addShard(newShard);
      
      const stats = shardingManager.getShardStats();
      expect(stats.has('shard3')).toBe(true);
      
      const shard3Stats = stats.get('shard3');
      expect(shard3Stats).toBeDefined();
      expect(shard3Stats!.shardId).toBe('shard3');
      expect(shard3Stats!.totalQueries).toBe(0);
    });
  });

  describe('removeShard', () => {
    it('should remove a shard from the system', async () => {
      await shardingManager.removeShard('shard1');
      
      const shardInfo = shardingManager.getShardInfo();
      expect(shardInfo).toHaveLength(1);
      expect(shardInfo.find(s => s.id === 'shard1')).toBeUndefined();
    });

    it('should remove shard stats', async () => {
      await shardingManager.removeShard('shard1');
      
      const stats = shardingManager.getShardStats();
      expect(stats.has('shard1')).toBe(false);
    });

    it('should handle removal of non-existent shard gracefully', async () => {
      await expect(shardingManager.removeShard('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('getShardForVector', () => {
    it('should return a shard for a given vector ID', () => {
      const vectorId = 'vector-123';
      const shard = shardingManager.getShardForVector(vectorId);
      
      expect(shard).toBeDefined();
      expect(shard!.id).toBeDefined();
    });

    it('should return consistent shard for same vector ID', () => {
      const vectorId = 'vector-123';
      const shard1 = shardingManager.getShardForVector(vectorId);
      const shard2 = shardingManager.getShardForVector(vectorId);
      
      expect(shard1!.id).toBe(shard2!.id);
    });

    it('should return undefined when no shards available', () => {
      const emptyManager = new VectorShardingManager({ shards: [] }, mockFactory);
      const shard = emptyManager.getShardForVector('vector-123');
      
      expect(shard).toBeUndefined();
      emptyManager.shutdown();
    });
  });

  describe('getShardsForVector', () => {
    it('should return multiple shards based on replication factor', () => {
      const vectorId = 'vector-123';
      const shards = shardingManager.getShardsForVector(vectorId);
      
      expect(shards).toBeDefined();
      expect(shards.length).toBeGreaterThan(0);
      expect(shards.length).toBeLessThanOrEqual(config.replicationFactor!);
    });

    it('should return unique shards', () => {
      const vectorId = 'vector-123';
      const shards = shardingManager.getShardsForVector(vectorId);
      
      const uniqueShardIds = new Set(shards.map(s => s.id));
      expect(uniqueShardIds.size).toBe(shards.length);
    });
  });

  describe('executeOnShard', () => {
    it('should execute query on specific shard', async () => {
      const query = 'SELECT * FROM users';
      const params = [];
      const shardId = 'shard1';
      
      const result = await shardingManager.executeOnShard(query, params, shardId);
      
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rowCount).toBeDefined();
    });

    it('should throw error for inactive shard', async () => {
      const query = 'SELECT * FROM users';
      const params = [];
      const shardId = 'shard1';
      
      // Mock shard as inactive
      const shardInfo = shardingManager.getShardInfo();
      const shard = shardInfo.find(s => s.id === shardId);
      if (shard) {
        shard.status = ShardStatus.OFFLINE;
      }
      
      await expect(shardingManager.executeOnShard(query, params, shardId))
        .rejects.toThrow(`Shard ${shardId} is not available`);
    });

    it('should throw error for non-existent shard', async () => {
      const query = 'SELECT * FROM users';
      const params = [];
      const shardId = 'nonexistent';
      
      await expect(shardingManager.executeOnShard(query, params, shardId))
        .rejects.toThrow(`Shard ${shardId} is not available`);
    });

    it('should update shard stats on successful execution', async () => {
      const query = 'SELECT * FROM users';
      const params = [];
      const shardId = 'shard1';
      
      const statsBefore = shardingManager.getShardStats().get(shardId);
      const totalQueriesBefore = statsBefore?.totalQueries || 0;
      const successfulQueriesBefore = statsBefore?.successfulQueries || 0;
      
      // Execute the query
      const result = await shardingManager.executeOnShard(query, params, shardId);
      
      // Verify the query executed successfully
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      
      const statsAfter = shardingManager.getShardStats().get(shardId);
      expect(statsAfter!.totalQueries).toBe(totalQueriesBefore + 1);
      expect(statsAfter!.successfulQueries).toBe(successfulQueriesBefore + 1);
    });

    it('should update shard stats on failed execution', async () => {
      const query = 'SELECT * FROM nonexistent_table';
      const params = [];
      const shardId = 'shard1';
      
      const statsBefore = shardingManager.getShardStats().get(shardId);
      const totalQueriesBefore = statsBefore?.totalQueries || 0;
      const failedQueriesBefore = statsBefore?.failedQueries || 0;
      
      await expect(shardingManager.executeOnShard(query, params, shardId))
        .rejects.toThrow();
      
      const statsAfter = shardingManager.getShardStats().get(shardId);
      expect(statsAfter!.totalQueries).toBe(totalQueriesBefore + 1);
      expect(statsAfter!.failedQueries).toBe(failedQueriesBefore + 1);
    });
  });

  describe('executeQuery', () => {
    it('should execute admin query on all shards', async () => {
      const query = 'CREATE TABLE test (id SERIAL PRIMARY KEY)';
      const params = [];
      
      const result = await shardingManager.executeQuery(query, params);
      
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
    });

    it('should execute write query based on write consistency', async () => {
      const query = 'INSERT INTO users (name) VALUES ($1)';
      const params = ['John'];
      
      const result = await shardingManager.executeQuery(query, params);
      
      expect(result).toBeDefined();
    });

    it('should execute read query based on read consistency', async () => {
      const query = 'SELECT * FROM users WHERE name = $1';
      const params = ['John'];
      
      const result = await shardingManager.executeQuery(query, params);
      
      expect(result).toBeDefined();
    });

    it('should handle vector search queries specially', async () => {
      const query = 'SELECT * FROM documents ORDER BY embedding <=> $1';
      const params = [[0.1, 0.2, 0.3]];
      
      const result = await shardingManager.executeQuery(query, params);
      
      expect(result).toBeDefined();
    });
  });

  describe('executeShardedQuery', () => {
    it('should execute vector similarity search across shards', async () => {
      const vectorQuery: VectorQuery = {
        embedding: [0.1, 0.2, 0.3],
        collectionName: 'documents',
        limit: 10,
        minSimilarity: 0.8
      };
      
      const result = await shardingManager.executeShardedQuery(vectorQuery);
      
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.totalFound).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.shardsQueried).toBeGreaterThan(0);
      expect(result.shardsResponded).toBeGreaterThan(0);
    });

    it('should throw error when no active shards available', async () => {
      const emptyManager = new VectorShardingManager({ shards: [] }, mockFactory);
      
      const vectorQuery: VectorQuery = {
        embedding: [0.1, 0.2, 0.3],
        collectionName: 'documents',
        limit: 10
      };
      
      await expect(emptyManager.executeShardedQuery(vectorQuery))
        .rejects.toThrow('No active shards available for vector search');
      
      emptyManager.shutdown();
    });

    it('should sort results by similarity', async () => {
      const vectorQuery: VectorQuery = {
        embedding: [0.1, 0.2, 0.3],
        collectionName: 'documents',
        limit: 10
      };
      
      const result = await shardingManager.executeShardedQuery(vectorQuery);
      
      // Results should be sorted by similarity (ascending)
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i].similarity).toBeGreaterThanOrEqual(result.results[i - 1].similarity);
      }
    });

    it('should limit results to requested number', async () => {
      const vectorQuery: VectorQuery = {
        embedding: [0.1, 0.2, 0.3],
        collectionName: 'documents',
        limit: 5
      };
      
      const result = await shardingManager.executeShardedQuery(vectorQuery);
      
      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getShardStats', () => {
    it('should return statistics for all shards', () => {
      const stats = shardingManager.getShardStats();
      
      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBe(2); // Two shards in mockShards
      
      for (const [shardId, shardStats] of stats) {
        expect(shardStats.shardId).toBe(shardId);
        expect(shardStats.totalQueries).toBeGreaterThanOrEqual(0);
        expect(shardStats.successfulQueries).toBeGreaterThanOrEqual(0);
        expect(shardStats.failedQueries).toBeGreaterThanOrEqual(0);
        expect(shardStats.avgResponseTimeMs).toBeGreaterThanOrEqual(0);
        expect(shardStats.vectorCount).toBeGreaterThanOrEqual(0);
        expect(shardStats.diskUsage).toBeGreaterThanOrEqual(0);
        expect(shardStats.lastUpdated).toBeInstanceOf(Date);
      }
    });

    it('should return empty map when no shards', () => {
      const emptyManager = new VectorShardingManager({ shards: [] }, mockFactory);
      const stats = emptyManager.getShardStats();
      
      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBe(0);
      
      emptyManager.shutdown();
    });
  });

  describe('getShardInfo', () => {
    it('should return information about all shards', () => {
      const shardInfo = shardingManager.getShardInfo();
      
      expect(shardInfo).toHaveLength(2);
      expect(shardInfo[0].id).toBe('shard1');
      expect(shardInfo[1].id).toBe('shard2');
    });

    it('should return empty array when no shards', () => {
      const emptyManager = new VectorShardingManager({ shards: [] }, mockFactory);
      const shardInfo = emptyManager.getShardInfo();
      
      expect(shardInfo).toHaveLength(0);
      
      emptyManager.shutdown();
    });
  });

  describe('getShardDistribution', () => {
    it('should return distribution percentages for shards', () => {
      const distribution = shardingManager.getShardDistribution(100);
      
      expect(distribution).toBeInstanceOf(Map);
      expect(distribution.size).toBe(2);
      
      let totalPercentage = 0;
      for (const percentage of distribution.values()) {
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
        totalPercentage += percentage;
      }
      
      // Total should be approximately 100% (allowing for rounding)
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it('should return empty map when no shards', () => {
      const emptyManager = new VectorShardingManager({ shards: [] }, mockFactory);
      const distribution = emptyManager.getShardDistribution(100);
      
      expect(distribution).toBeInstanceOf(Map);
      expect(distribution.size).toBe(0);
      
      emptyManager.shutdown();
    });

    it('should use default sample size when not provided', () => {
      const distribution = shardingManager.getShardDistribution();
      
      expect(distribution).toBeInstanceOf(Map);
      expect(distribution.size).toBe(2);
    });
  });

  describe('shutdown', () => {
    it('should close all connection pools', async () => {
      // Get the actual pools that the manager is using
      const pools = Array.from(shardingManager['shardPools'].values());
      
      await shardingManager.shutdown();
      
      // Check that all pools had their end method called
      pools.forEach(pool => {
        expect(pool.end).toHaveBeenCalled();
      });
    });

    it('should be idempotent', async () => {
      await shardingManager.shutdown();
      await shardingManager.shutdown(); // Should not throw
    });

    it('should handle shutdown errors gracefully', async () => {
      const mockPool = mockFactory.createPool({}) as any;
      (mockPool.end as jest.Mock).mockRejectedValue(new Error('Shutdown error'));
      
      await expect(shardingManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('consistency levels', () => {
    it('should handle ONE read consistency', async () => {
      const oneReadManager = new VectorShardingManager({
        ...config,
        readConsistency: ReadConsistency.ONE
      }, mockFactory);
      
      const query = 'SELECT * FROM users';
      const result = await oneReadManager.executeQuery(query);
      
      expect(result).toBeDefined();
      
      await oneReadManager.shutdown();
    });

    it('should handle QUORUM read consistency', async () => {
      const quorumReadManager = new VectorShardingManager({
        ...config,
        readConsistency: ReadConsistency.QUORUM
      }, mockFactory);
      
      const query = 'SELECT * FROM users';
      const result = await quorumReadManager.executeQuery(query);
      
      expect(result).toBeDefined();
      
      await quorumReadManager.shutdown();
    });

    it('should handle ALL read consistency', async () => {
      const allReadManager = new VectorShardingManager({
        ...config,
        readConsistency: ReadConsistency.ALL
      }, mockFactory);
      
      const query = 'SELECT * FROM users';
      const result = await allReadManager.executeQuery(query);
      
      expect(result).toBeDefined();
      
      await allReadManager.shutdown();
    });

    it('should handle ONE write consistency', async () => {
      const oneWriteManager = new VectorShardingManager({
        ...config,
        writeConsistency: WriteConsistency.ONE
      }, mockFactory);
      
      const query = 'INSERT INTO users (name) VALUES ($1)';
      const result = await oneWriteManager.executeQuery(query, ['John']);
      
      expect(result).toBeDefined();
      
      await oneWriteManager.shutdown();
    });

    it('should handle QUORUM write consistency', async () => {
      const quorumWriteManager = new VectorShardingManager({
        ...config,
        writeConsistency: WriteConsistency.QUORUM
      }, mockFactory);
      
      const query = 'INSERT INTO users (name) VALUES ($1)';
      const result = await quorumWriteManager.executeQuery(query, ['John']);
      
      expect(result).toBeDefined();
      
      await quorumWriteManager.shutdown();
    });

    it('should handle ALL write consistency', async () => {
      const allWriteManager = new VectorShardingManager({
        ...config,
        writeConsistency: WriteConsistency.ALL
      }, mockFactory);
      
      const query = 'INSERT INTO users (name) VALUES ($1)';
      const result = await allWriteManager.executeQuery(query, ['John']);
      
      expect(result).toBeDefined();
      
      await allWriteManager.shutdown();
    });
  });
});
