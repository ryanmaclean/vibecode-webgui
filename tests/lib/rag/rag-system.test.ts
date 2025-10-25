/**
 * RAG System Tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
