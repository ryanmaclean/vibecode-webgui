/**
 * Postgres Vector Database Adapter Integration Tests
 */

import { PostgresVectorDatabaseAdapter } from '../../src/lib/vector-db/postgres-vector-database-adapter';
import { VectorDatabaseProvider } from '../../src/lib/vector-db/vector-types';

// Check if PostgreSQL is available (set by jest.globalSetup.js)
const SKIP_POSTGRES = process.env.SKIP_POSTGRES_TESTS === '1';

// Only run these tests if we have a test database configured
const testConfig = process.env.TEST_POSTGRES_CONNECTION_STRING;
const skipTests = SKIP_POSTGRES || !testConfig;

(skipTests ? describe.skip : describe)('PostgresVectorDatabaseAdapter Integration Tests', () => {
  let adapter: PostgresVectorDatabaseAdapter;

  beforeAll(async () => {
    const config = {
      provider: VectorDatabaseProvider.POSTGRES,
      connectionString: testConfig,
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

      // Store chunks
      await adapter.storeChunks(fileId, chunks);

      // Generate embedding for search
      const embedding = await adapter.generateEmbedding('Test content');

      // Search for stored chunks
      const results = await adapter.search(embedding, { fileIds: [fileId] });

      expect(results).toHaveLength(2);
      expect(results[0].chunk.content).toContain('Test content');

      // Clean up
      await adapter.deleteFileChunks(fileId);
    });

    it('should handle concurrent operations', async () => {
      const fileIds = Array(5).fill(0).map((_, i) => 1000000 + i);
      const chunks = fileIds.map(id => ({
        content: `Test content for file ${id}`,
        startLine: 1,
        endLine: 1,
        tokens: 5
      }));

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
      // Force a connection error
      const oldConnection = (adapter as any).pool;
      (adapter as any).pool = null;

      try {
        const embedding = await adapter.generateEmbedding('Connection error test');
        await expect(adapter.search(embedding)).rejects.toThrow();
      } finally {
        // Restore connection
        (adapter as any).pool = oldConnection;
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