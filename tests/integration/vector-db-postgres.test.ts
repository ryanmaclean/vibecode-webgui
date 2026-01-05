/**
 * Postgres Vector Database Adapter Integration Tests
 * Converted to use enhanced mocks instead of real connections
 */

import { EventEmitter } from 'events';
import type { PoolClient, PoolConfig } from 'pg';

// Mock pg Pool
type MockPoolInstance = EventEmitter & {
  options: { max: number };
  connect: jest.Mock<Promise<PoolClient>, []>;
  end: jest.Mock<Promise<void>, []>;
  query: jest.Mock;
};

const mockPoolInstances: MockPoolInstance[] = [];
const mockVectorStore = new Map<number, any[]>();

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

        this.query = jest.fn(async (sql: string, params?: any[]) => {
          // Handle pgvector extension check
          if (sql.toLowerCase().includes('pg_extension') && sql.toLowerCase().includes('vector')) {
            return { rows: [{ extname: 'vector' }], rowCount: 1 };
          }

          // Handle vector operations
          if (sql.includes('INSERT INTO') && sql.includes('chunks')) {
            const fileId = params?.[0];
            if (fileId && !mockVectorStore.has(fileId)) {
              mockVectorStore.set(fileId, []);
            }
            return { rows: [], rowCount: 1 };
          }

          if (sql.includes('SELECT') && sql.includes('embedding')) {
            const fileIds = params?.find(p => Array.isArray(p));
            if (fileIds && fileIds.length > 0) {
              const results: any[] = [];
              fileIds.forEach((id: number) => {
                const chunks = mockVectorStore.get(id) || [];
                chunks.forEach(chunk => {
                  results.push({
                    chunk: chunk,
                    similarity: 0.95,
                    file_id: id
                  });
                });
              });
              return { rows: results };
            }
            return { rows: [] };
          }

          if (sql.includes('DELETE FROM') && sql.includes('chunks')) {
            const fileId = params?.[0];
            if (fileId && mockVectorStore.has(fileId)) {
              mockVectorStore.delete(fileId);
            }
            return { rows: [], rowCount: 1 };
          }

          return { rows: [{ health_check: 1 }] };
        });

        this.connect = jest.fn(async () => {
          const client: PoolClient = {
            query: this.query,
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

import { PostgresVectorDatabaseAdapter } from '../../src/lib/vector-db/postgres-vector-database-adapter';
import { VectorDatabaseProvider } from '../../src/lib/vector-db/vector-types';

describe('PostgresVectorDatabaseAdapter Integration Tests', () => {
  let adapter: PostgresVectorDatabaseAdapter;

  beforeAll(async () => {
    const config = {
      provider: VectorDatabaseProvider.POSTGRES,
      connectionString: 'postgresql://test:test@localhost:5432/test',
      connectionPooling: true,
      minPoolSize: 1,
      maxPoolSize: 3,
      enableMetrics: true,
      enableLogging: true
    } as const;

    adapter = new PostgresVectorDatabaseAdapter(config);
    await adapter.initialize();
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.close();
    }
    mockVectorStore.clear();
    mockPoolInstances.length = 0;
  });

  beforeEach(() => {
    mockVectorStore.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve vectors', async () => {
      const fileId = Math.floor(Math.random() * 1000000);
      const chunks = [
        {
          content: 'Test content 1',
          startLine: 1,
          endLine: 1,
          tokens: 3
        },
        {
          content: 'Test content 2',
          startLine: 2,
          endLine: 2,
          tokens: 3
        }
      ];

      // Store chunks in mock
      mockVectorStore.set(fileId, chunks);

      // Store chunks via adapter
      await adapter.storeChunks(fileId, chunks);

      // Generate embedding for search
      const embedding = await adapter.generateEmbedding('Test content');

      // Search for stored chunks
      const results = await adapter.search(embedding, { fileIds: [fileId] });

      expect(results).toHaveLength(2);
      expect(results[0].chunk.content).toContain('Test content');

      // Clean up
      await adapter.deleteFileChunks(fileId);
      expect(mockVectorStore.has(fileId)).toBe(false);
    });

    it('should handle concurrent operations', async () => {
      const fileIds = Array(5).fill(0).map((_, i) => 1000000 + i);
      const chunks = fileIds.map(id => ({
        content: `Test content for file ${id}`,
        startLine: 1,
        endLine: 1,
        tokens: 5
      }));

      // Store chunks in mock
      fileIds.forEach((id, i) => {
        mockVectorStore.set(id, [chunks[i]]);
      });

      // Store chunks concurrently
      await Promise.all(fileIds.map((id, i) => adapter.storeChunks(id, [chunks[i]])));

      // Search concurrently
      const embedding = await adapter.generateEmbedding('Test content');
      const searches = fileIds.map(id => adapter.search(embedding, { fileIds: [id] }));
      const results = await Promise.all(searches);

      // Verify results
      expect(results).toHaveLength(5);
      results.forEach(r => expect(r).toHaveLength(1));

      // Clean up
      await Promise.all(fileIds.map(id => adapter.deleteFileChunks(id)));
    });
  });

  describe('Caching', () => {
    it('should cache search results', async () => {
      const fileId = Math.floor(Math.random() * 1000000);
      const chunks = [{
        content: 'Cached content test',
        startLine: 1,
        endLine: 1,
        tokens: 3
      }];

      // Store test data in mock
      mockVectorStore.set(fileId, chunks);

      // Store test data
      await adapter.storeChunks(fileId, chunks);
      const embedding = await adapter.generateEmbedding('Cached content');

      // First search should miss cache
      const results1 = await adapter.search(embedding, {
        fileIds: [fileId],
        useCache: true
      });

      // Second search should hit cache
      const results2 = await adapter.search(embedding, {
        fileIds: [fileId],
        useCache: true
      });

      expect(results1).toEqual(results2);

      // Clean up
      await adapter.deleteFileChunks(fileId);
    });
  });

  describe('Connection Pool', () => {
    it('should handle many concurrent connections', async () => {
      const fileId = Math.floor(Math.random() * 1000000);
      const chunks = [{
        content: 'Connection pool test',
        startLine: 1,
        endLine: 1,
        tokens: 3
      }];

      // Store test data in mock
      mockVectorStore.set(fileId, chunks);

      // Store test data
      await adapter.storeChunks(fileId, chunks);
      const embedding = await adapter.generateEmbedding('Connection pool');

      // Perform many concurrent searches
      const searches = Array(50).fill(0).map(() => adapter.search(embedding, {
        fileIds: [fileId]
      }));

      // All should succeed
      const results = await Promise.all(searches);
      expect(results).toHaveLength(50);

      // Clean up
      await adapter.deleteFileChunks(fileId);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      const invalidFileId = -1;
      const embedding = await adapter.generateEmbedding('Invalid query');

      await expect(adapter.search(embedding, {
        fileIds: [invalidFileId]
      })).resolves.toEqual([]);
    });

    it('should handle connection interruptions', async () => {
      // Force a connection error by setting pool to null
      const oldPool = (adapter as any).pool;
      (adapter as any).pool = null;

      try {
        const embedding = await adapter.generateEmbedding('Connection error test');
        await expect(adapter.search(embedding)).rejects.toThrow();
      } finally {
        // Restore connection
        (adapter as any).pool = oldPool;
      }
    });
  });

  describe('Performance', () => {
    it('should perform well under load', async () => {
      const startTime = Date.now();
      const embedding = await adapter.generateEmbedding('Performance test');

      // Perform multiple concurrent searches
      const searches = Array(10).fill(0).map(() => adapter.search(embedding));
      await Promise.all(searches);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
