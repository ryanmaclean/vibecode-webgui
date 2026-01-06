/**
 * RAG System Tests
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock the cache module before importing ragSystem
jest.mock('@/lib/rag/cache', () => {
  const mockCache = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({
      keyCount: 0,
      memoryUsed: '0B',
      hitRate: '0%'
    })
  };

  return {
    ValkeyCache: jest.fn().mockImplementation(() => mockCache),
    valkeyCache: mockCache
  };
});

// Mock the vector store
jest.mock('@/lib/rag/vector-store', () => {
  const mockResults = [
    { id: '1', content: 'Mock result 1', similarity: 0.95, metadata: {} },
    { id: '2', content: 'Mock result 2', similarity: 0.85, metadata: {} },
    { id: '3', content: 'Mock result 3', similarity: 0.75, metadata: {} }
  ];

  const mockVectorStore = {
    initialize: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue('mock-id-1'),
    insertBatch: jest.fn().mockImplementation((docs) =>
      Promise.resolve(docs.map((_, i) => `mock-id-${i + 1}`))
    ),
    search: jest.fn().mockImplementation((embedding, options) => {
      const limit = options?.limit || 10;
      const threshold = options?.threshold || 0.7;
      return Promise.resolve(
        mockResults.filter(r => r.similarity > threshold).slice(0, limit)
      );
    }),
    rebuildIndex: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({
      documentCount: 10,
      tableSize: '1 MB',
      indexSize: '512 KB'
    })
  };

  return {
    VectorStore: jest.fn().mockImplementation(() => mockVectorStore),
    vectorStore: mockVectorStore
  };
});

// Mock the embeddings service
jest.mock('@/lib/rag/embeddings', () => {
  const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

  const mockEmbeddingService = {
    generate: jest.fn().mockResolvedValue(mockEmbedding),
    generateBatch: jest.fn().mockImplementation((texts) =>
      Promise.resolve(texts.map(() => mockEmbedding))
    )
  };

  return {
    EmbeddingService: jest.fn().mockImplementation(() => mockEmbeddingService),
    embeddingService: mockEmbeddingService
  };
});

import { ragSystem } from '@/lib/rag';

describe('RAG System', () => {
  beforeAll(async () => {
    await ragSystem.initialize();
  });

  afterAll(async () => {
    await ragSystem.shutdown();
  });

  describe('Document Ingestion', () => {
    it('should ingest a single document', async () => {
      const doc = {
        content: 'This is a test document about RAG systems.',
        metadata: { source: 'test' }
      };

      const id = await ragSystem.ingest(doc);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should ingest multiple documents in batch', async () => {
      const docs = [
        { content: 'Document 1 about PostgreSQL', metadata: { type: 'db' } },
        { content: 'Document 2 about Valkey cache', metadata: { type: 'cache' } },
        { content: 'Document 3 about embeddings', metadata: { type: 'ml' } }
      ];

      const ids = await ragSystem.ingestBatch(docs);
      expect(ids).toHaveLength(3);
      expect(ids.every(id => typeof id === 'string')).toBe(true);
    });
  });

  describe('Semantic Search', () => {
    it('should search and return relevant results', async () => {
      const query = 'Tell me about databases';
      const results = await ragSystem.search(query);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('similarity');
    });

    it('should respect limit parameter', async () => {
      const query = 'test query';
      const results = await ragSystem.search(query, { limit: 3 });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should filter by similarity threshold', async () => {
      const query = 'test query';
      const results = await ragSystem.search(query, { threshold: 0.9 });

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThan(0.9);
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cache for repeated queries', async () => {
      const query = 'cached query test';

      // First query (cache miss)
      const results1 = await ragSystem.search(query, { useCache: true });

      // Second query (cache hit)
      const results2 = await ragSystem.search(query, { useCache: true });

      expect(results1).toEqual(results2);
    });

    it('should bypass cache when requested', async () => {
      const query = 'no cache query';

      const results = await ragSystem.search(query, { useCache: false });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('System Statistics', () => {
    it('should return system statistics', async () => {
      const stats = await ragSystem.getStats();

      expect(stats).toHaveProperty('vectorStore');
      expect(stats).toHaveProperty('cache');
      expect(stats.vectorStore).toHaveProperty('documentCount');
      expect(stats.cache).toHaveProperty('keyCount');
    });
  });

  describe('Index Management', () => {
    it('should rebuild index successfully', async () => {
      await expect(ragSystem.rebuildIndex()).resolves.not.toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', async () => {
      await expect(ragSystem.clearCache()).resolves.not.toThrow();
    });
  });
});
