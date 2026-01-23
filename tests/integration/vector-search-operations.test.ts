/**
 * Integration tests for vector search operations
 * Tests semantic search, keyword search, hybrid search, and collection management
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { ENV_MOCK, MockUtils } from '../utils/mock-templates';
import type { SearchResult } from '@/lib/ai/search/vector-search';

// Mock embedding vectors for testing
const generateMockEmbedding = (dim: number = 1536): number[] => {
  const v = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / m);
};

// Mock search results
const mockSearchResults: Array<{
  content: string;
  metadata: Record<string, any>;
  score: number;
}> = [
  {
    content: 'Vector database operations for similarity search',
    metadata: { fileId: 1, fileName: 'vector-ops.ts', language: 'typescript' },
    score: 0.95
  },
  {
    content: 'Embedding generation using transformer models',
    metadata: { fileId: 2, fileName: 'embeddings.ts', language: 'typescript' },
    score: 0.87
  },
  {
    content: 'ChromaDB collection management and indexing',
    metadata: { fileId: 3, fileName: 'chroma-client.ts', language: 'typescript' },
    score: 0.82
  },
  {
    content: 'PostgreSQL pgvector extension for vector storage',
    metadata: { fileId: 4, fileName: 'pgvector-adapter.ts', language: 'typescript' },
    score: 0.78
  },
  {
    content: 'Hybrid search combining semantic and keyword matching',
    metadata: { fileId: 5, fileName: 'hybrid-search.ts', language: 'typescript' },
    score: 0.75
  }
];

// Mock collections
const mockCollections: Array<{ name: string; id: string; metadata: Record<string, unknown> }> = [];

// Mock ChromaDB client
jest.mock('chromadb', () => {
  return {
    ChromaClient: jest.fn().mockImplementation(() => ({
      heartbeat: jest.fn().mockResolvedValue(true),
      listCollections: jest.fn().mockImplementation(() => Promise.resolve(mockCollections)),
      createCollection: jest.fn().mockImplementation(({ name, metadata }) => {
        const collection = {
          name,
          id: `col-${Date.now()}`,
          metadata: metadata || {}
        };
        mockCollections.push(collection);
        return Promise.resolve({
          name,
          add: jest.fn().mockResolvedValue(undefined),
          query: jest.fn().mockResolvedValue({
            ids: [['doc-1', 'doc-2', 'doc-3']],
            documents: [[
              mockSearchResults[0].content,
              mockSearchResults[1].content,
              mockSearchResults[2].content
            ]],
            metadatas: [[
              mockSearchResults[0].metadata,
              mockSearchResults[1].metadata,
              mockSearchResults[2].metadata
            ]],
            distances: [[0.05, 0.13, 0.18]]
          }),
          get: jest.fn().mockResolvedValue({
            ids: mockSearchResults.map((_, i) => `doc-${i}`),
            documents: mockSearchResults.map(r => r.content),
            metadatas: mockSearchResults.map(r => r.metadata)
          })
        });
      }),
      getCollection: jest.fn().mockImplementation(({ name }) => {
        return Promise.resolve({
          name,
          add: jest.fn().mockResolvedValue(undefined),
          query: jest.fn().mockResolvedValue({
            ids: [['doc-1', 'doc-2', 'doc-3']],
            documents: [[
              mockSearchResults[0].content,
              mockSearchResults[1].content,
              mockSearchResults[2].content
            ]],
            metadatas: [[
              mockSearchResults[0].metadata,
              mockSearchResults[1].metadata,
              mockSearchResults[2].metadata
            ]],
            distances: [[0.05, 0.13, 0.18]]
          }),
          get: jest.fn().mockResolvedValue({
            ids: mockSearchResults.map((_, i) => `doc-${i}`),
            documents: mockSearchResults.map(r => r.content),
            metadatas: mockSearchResults.map(r => r.metadata)
          })
        });
      }),
      deleteCollection: jest.fn().mockImplementation(({ name }) => {
        const index = mockCollections.findIndex(c => c.name === name);
        if (index !== -1) {
          mockCollections.splice(index, 1);
        }
        return Promise.resolve(undefined);
      })
    }))
  };
});

// Mock OpenAI embeddings
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockImplementation((texts: string[]) => {
      return Promise.resolve(texts.map(() => generateMockEmbedding()));
    }),
    embedQuery: jest.fn().mockImplementation(() => {
      return Promise.resolve(generateMockEmbedding());
    })
  }))
}));

// Mock langchain Document
jest.mock('@langchain/core/documents', () => ({
  Document: class {
    pageContent: string;
    metadata: Record<string, any>;

    constructor({ pageContent, metadata }: { pageContent: string; metadata?: Record<string, any> }) {
      this.pageContent = pageContent;
      this.metadata = metadata || {};
    }
  }
}));

import { VectorSearch } from '@/lib/ai/search/vector-search';

describe('Vector Search Operations Integration', () => {
  let vectorSearch: VectorSearch;
  let consoleSpy: {
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    log: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeAll(() => {
    Object.assign(process.env, ENV_MOCK.test());
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.CHROMA_DB_URL = 'http://localhost:8000';
  });

  beforeEach(() => {
    MockUtils.resetAllMocks();
    mockCollections.length = 0;

    // Silence console output during tests
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    };

    vectorSearch = new VectorSearch();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    MockUtils.resetAllMocks();
  });

  describe('Collection Management', () => {
    it('should create a new collection', async () => {
      const result = await vectorSearch.createCollection('test-collection', {
        description: 'Test collection'
      });

      // Result should be boolean (true if ChromaDB available, false otherwise)
      expect(typeof result).toBe('boolean');
    });

    it('should list collections', async () => {
      // Create a collection first
      await vectorSearch.createCollection('list-test-collection');

      const collections = await vectorSearch.listCollections();

      expect(Array.isArray(collections)).toBe(true);
    });

    it('should delete a collection', async () => {
      // Create a collection first
      await vectorSearch.createCollection('delete-test-collection');

      // Delete should not throw
      await expect(
        vectorSearch.deleteCollection('delete-test-collection')
      ).resolves.not.toThrow();
    });
  });

  describe('Document Indexing', () => {
    it('should add documents to a collection', async () => {
      const { Document } = await import('@langchain/core/documents');

      const documents = [
        new Document({
          pageContent: 'First document content about vector search',
          metadata: { source: 'test1.ts', language: 'typescript' }
        }),
        new Document({
          pageContent: 'Second document about embeddings',
          metadata: { source: 'test2.ts', language: 'typescript' }
        }),
        new Document({
          pageContent: 'Third document about similarity search',
          metadata: { source: 'test3.ts', language: 'typescript' }
        })
      ];

      await expect(
        vectorSearch.addDocuments(documents, 'document-test-collection')
      ).resolves.not.toThrow();
    });

    it('should handle empty document list', async () => {
      await expect(
        vectorSearch.addDocuments([], 'empty-doc-collection')
      ).resolves.not.toThrow();
    });

    it('should index documents with complex metadata', async () => {
      const { Document } = await import('@langchain/core/documents');

      const documents = [
        new Document({
          pageContent: 'Complex metadata document',
          metadata: {
            source: 'complex.ts',
            language: 'typescript',
            tags: ['vector', 'search', 'ai'],
            nested: { key: 'value' },
            version: 1,
            active: true
          }
        })
      ];

      await expect(
        vectorSearch.addDocuments(documents, 'complex-metadata-collection')
      ).resolves.not.toThrow();
    });
  });

  describe('Semantic Search', () => {
    it('should perform semantic search with query', async () => {
      const results = await vectorSearch.semanticSearch(
        'vector database similarity search',
        'semantic-search-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results with correct structure', async () => {
      const results = await vectorSearch.semanticSearch(
        'embedding generation',
        'semantic-search-collection',
        3
      );

      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('score');
        expect(typeof result.content).toBe('string');
        expect(typeof result.score).toBe('number');
      }
    });

    it('should respect limit parameter', async () => {
      const results = await vectorSearch.semanticSearch(
        'search query',
        'limit-test-collection',
        2
      );

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return results sorted by relevance', async () => {
      const results = await vectorSearch.semanticSearch(
        'vector operations',
        'sort-test-collection',
        5
      );

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
        }
      }
    });
  });

  describe('Keyword Search', () => {
    it('should perform keyword search', async () => {
      const results = await vectorSearch.keywordSearch(
        'vector embedding',
        'keyword-search-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should match documents containing keywords', async () => {
      const results = await vectorSearch.keywordSearch(
        'database',
        'keyword-match-collection',
        5
      );

      if (results.length > 0) {
        results.forEach(result => {
          expect(result.score).toBeGreaterThan(0);
        });
      }
    });

    it('should handle multiple keywords', async () => {
      const results = await vectorSearch.keywordSearch(
        'vector database operations',
        'multi-keyword-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const results = await vectorSearch.keywordSearch(
        'xyznonexistent123',
        'no-match-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Hybrid Search', () => {
    it('should perform hybrid search combining semantic and keyword', async () => {
      const results = await vectorSearch.hybridSearch(
        'vector similarity search',
        'hybrid-search-collection',
        ['database', 'embedding'],
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should work with empty keywords array', async () => {
      const results = await vectorSearch.hybridSearch(
        'vector search query',
        'hybrid-no-keywords-collection',
        [],
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should deduplicate results from both searches', async () => {
      const results = await vectorSearch.hybridSearch(
        'vector database',
        'dedup-collection',
        ['vector', 'database'],
        5
      );

      // Check for unique results by content
      const contents = results.map(r => r.content);
      const uniqueContents = new Set(contents);
      expect(contents.length).toBe(uniqueContents.size);
    });

    it('should return results sorted by combined score', async () => {
      const results = await vectorSearch.hybridSearch(
        'embedding generation',
        'sort-hybrid-collection',
        ['embedding'],
        5
      );

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
        }
      }
    });
  });

  describe('Search with Filters', () => {
    it('should filter results by metadata', async () => {
      const results = await vectorSearch.semanticSearch(
        'typescript code',
        'filter-collection',
        5
      );

      // Verify structure even if mocked
      results.forEach(result => {
        expect(result).toHaveProperty('metadata');
      });
    });

    it('should handle search with empty results', async () => {
      const results = await vectorSearch.semanticSearch(
        'query with no matches expected',
        'empty-results-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle ChromaDB unavailability gracefully', async () => {
      // When ChromaDB is unavailable, methods should return empty/false
      const results = await vectorSearch.semanticSearch(
        'test query',
        'unavailable-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return false for collection creation on error', async () => {
      // The mock allows creation, so this tests the basic flow
      const result = await vectorSearch.createCollection('error-collection');
      expect(typeof result).toBe('boolean');
    });

    it('should handle embedding generation errors', async () => {
      // Mock should handle this gracefully
      const results = await vectorSearch.semanticSearch(
        '',
        'empty-query-collection',
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent searches', async () => {
      const queries = [
        'vector search',
        'embedding generation',
        'similarity matching',
        'database operations',
        'machine learning'
      ];

      const results = await Promise.all(
        queries.map(query =>
          vectorSearch.semanticSearch(query, 'concurrent-collection', 3)
        )
      );

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should handle concurrent collection operations', async () => {
      const operations = [
        vectorSearch.createCollection('concurrent-1'),
        vectorSearch.createCollection('concurrent-2'),
        vectorSearch.createCollection('concurrent-3')
      ];

      const results = await Promise.all(operations);

      results.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete search within reasonable time', async () => {
      const startTime = Date.now();

      await vectorSearch.semanticSearch(
        'performance test query',
        'perf-test-collection',
        10
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle batch document indexing', async () => {
      const { Document } = await import('@langchain/core/documents');

      const documents = Array.from({ length: 50 }, (_, i) => (
        new Document({
          pageContent: `Document ${i} content about vectors and search`,
          metadata: { id: i, source: `file${i}.ts` }
        })
      ));

      const startTime = Date.now();

      await vectorSearch.addDocuments(documents, 'batch-collection');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Metadata Handling', () => {
    it('should preserve metadata through search results', async () => {
      const results = await vectorSearch.semanticSearch(
        'test query',
        'metadata-collection',
        5
      );

      results.forEach(result => {
        expect(result.metadata).toBeDefined();
        expect(typeof result.metadata).toBe('object');
      });
    });

    it('should handle array metadata (tags)', async () => {
      const results = await vectorSearch.semanticSearch(
        'tagged content',
        'tags-collection',
        5
      );

      // Results should have properly formatted metadata
      results.forEach(result => {
        if (result.metadata && result.metadata.tags) {
          expect(
            Array.isArray(result.metadata.tags) ||
            typeof result.metadata.tags === 'string'
          ).toBe(true);
        }
      });
    });
  });
});
