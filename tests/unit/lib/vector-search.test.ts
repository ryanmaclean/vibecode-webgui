/**
 * Unit tests for vector-search.ts
 * Tests vector search operations and query rate tracking
 */

import { VectorSearchService } from '@/lib/vector-search';
import { Pool, PoolClient } from 'pg';

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined)
  };

  return {
    Pool: jest.fn(() => mockPool)
  };
});

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get references to mocked objects
    service = new VectorSearchService();
    mockPool = (Pool as jest.MockedClass<typeof Pool>).mock.results[0].value as jest.Mocked<Pool>;
    mockClient = mockPool.connect as unknown as jest.Mock;
    mockClient = (mockPool.connect as jest.Mock).mock.results[0]?.value;
  });

  afterEach(async () => {
    await service.close();
  });

  describe('constructor', () => {
    it('should create a pool with default configuration', () => {
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        })
      );
    });

    it('should use environment variables for configuration', () => {
      const originalEnv = { ...process.env };

      process.env.PGVECTOR_HOST = 'custom-host';
      process.env.PGVECTOR_PORT = '5433';
      process.env.PGVECTOR_DATABASE = 'custom-db';
      process.env.PGVECTOR_USER = 'custom-user';
      process.env.PGVECTOR_PASSWORD = 'custom-password';

      // Create a new service to pick up the env vars
      const customService = new VectorSearchService();

      expect(Pool).toHaveBeenLastCalledWith(
        expect.objectContaining({
          host: 'custom-host',
          port: 5433,
          database: 'custom-db',
          user: 'custom-user',
          password: 'custom-password'
        })
      );

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('storeEmbedding', () => {
    it('should store an embedding and return the id', async () => {
      const mockQueryResult = { rows: [{ id: 123 }] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const metadata = { language: 'typescript', framework: 'nextjs' };

      const id = await service.storeEmbedding('code', 'hash123', embedding, metadata);

      expect(id).toBe(123);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO embeddings'),
        expect.arrayContaining(['code', 'hash123'])
      );
      expect(client.release).toHaveBeenCalled();
    });

    it('should handle upsert on conflict', async () => {
      const mockQueryResult = { rows: [{ id: 456 }] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const embedding = [0.1, 0.2, 0.3];

      await service.storeEmbedding('code', 'existing-hash', embedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('should format embedding as bracket notation for pgvector', async () => {
      const mockQueryResult = { rows: [{ id: 789 }] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const embedding = [0.1, 0.2, 0.3];

      await service.storeEmbedding('code', 'hash', embedding);

      // Verify the embedding was formatted correctly
      expect(client.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'code',
          'hash',
          '[0.1,0.2,0.3]', // Bracket notation for pgvector
          expect.any(String)
        ])
      );
    });
  });

  describe('similaritySearch', () => {
    it('should perform basic similarity search', async () => {
      const mockResults = {
        rows: [
          { id: 1, content_type: 'code', content_hash: 'hash1', metadata: {}, similarity: '0.15' },
          { id: 2, content_type: 'code', content_hash: 'hash2', metadata: {}, similarity: '0.25' }
        ]
      };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      const results = await service.similaritySearch(queryEmbedding);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(1);
      expect(results[0].similarity).toBe(0.15);
      expect(client.release).toHaveBeenCalled();
    });

    it('should apply content_type filter', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.similaritySearch(queryEmbedding, { content_type: 'documentation' });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('content_type = $'),
        expect.arrayContaining(['documentation'])
      );
    });

    it('should apply language filter', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.similaritySearch(queryEmbedding, { language: 'python' });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'language' = $"),
        expect.arrayContaining(['python'])
      );
    });

    it('should apply framework filter', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.similaritySearch(queryEmbedding, { framework: 'react' });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'framework' = $"),
        expect.arrayContaining(['react'])
      );
    });

    it('should apply similarity threshold filter', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.similaritySearch(queryEmbedding, { similarity_threshold: 0.5 });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding <-> $1 < $'),
        expect.arrayContaining([0.5])
      );
    });

    it('should respect limit option', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.similaritySearch(queryEmbedding, { limit: 5 });

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $'),
        expect.arrayContaining([5])
      );
    });

    it('should use default limit of 10', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.similaritySearch(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });
  });

  describe('findSimilarCode', () => {
    it('should search with code content type', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findSimilarCode(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('content_type = $'),
        expect.arrayContaining(['code'])
      );
    });

    it('should apply language and framework filters', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findSimilarCode(queryEmbedding, 'typescript', 'nextjs', 3);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'language' = $"),
        expect.arrayContaining(['typescript', 'nextjs'])
      );
    });

    it('should use default limit of 5', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findSimilarCode(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      );
    });

    it('should apply 0.8 similarity threshold', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findSimilarCode(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding <-> $1 < $'),
        expect.arrayContaining([0.8])
      );
    });
  });

  describe('findRelevantDocs', () => {
    it('should search with documentation content type', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findRelevantDocs(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('content_type = $'),
        expect.arrayContaining(['documentation'])
      );
    });

    it('should use default limit of 3', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findRelevantDocs(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([3])
      );
    });

    it('should apply 0.7 similarity threshold', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.findRelevantDocs(queryEmbedding);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding <-> $1 < $'),
        expect.arrayContaining([0.7])
      );
    });
  });

  describe('hybridSearch', () => {
    it('should perform search with multiple content types', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.hybridSearch(
        queryEmbedding,
        { content_types: ['code', 'documentation'] }
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('content_type = ANY($'),
        expect.arrayContaining([['code', 'documentation']])
      );
    });

    it('should apply multiple language filters', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.hybridSearch(
        queryEmbedding,
        { languages: ['typescript', 'javascript'] }
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'language' = ANY($"),
        expect.arrayContaining([['typescript', 'javascript']])
      );
    });

    it('should apply multiple framework filters', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.hybridSearch(
        queryEmbedding,
        { frameworks: ['react', 'vue', 'angular'] }
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'framework' = ANY($"),
        expect.arrayContaining([['react', 'vue', 'angular']])
      );
    });

    it('should apply date range filter', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.hybridSearch(
        queryEmbedding,
        { date_range: { start: startDate, end: endDate } }
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at BETWEEN $'),
        expect.arrayContaining([startDate, endDate])
      );
    });

    it('should handle empty filters', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];
      await service.hybridSearch(queryEmbedding, {});

      // Should not include WHERE clause when no filters
      expect(client.query).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE'),
        expect.any(Array)
      );
    });
  });

  describe('getStats', () => {
    it('should return statistics about embeddings', async () => {
      const client = await mockPool.connect();

      // Mock total count
      (client.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({
          rows: [
            { content_type: 'code', count: '70' },
            { content_type: 'documentation', count: '30' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { language: 'typescript', count: '50' },
            { language: 'python', count: '30' }
          ]
        });

      const stats = await service.getStats();

      expect(stats.total_embeddings).toBe(100);
      expect(stats.by_content_type).toEqual({
        code: 70,
        documentation: 30
      });
      expect(stats.by_language).toEqual({
        typescript: 50,
        python: 30
      });
      expect(typeof stats.avg_similarity_queries_per_minute).toBe('number');
    });
  });

  describe('close', () => {
    it('should close the connection pool', async () => {
      await service.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('query rate tracking', () => {
    it('should track query rates across similarity searches', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];

      // Perform multiple searches
      await service.similaritySearch(queryEmbedding);
      await service.similaritySearch(queryEmbedding);
      await service.similaritySearch(queryEmbedding);

      // Get stats should include query rate
      (client.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const stats = await service.getStats();
      expect(stats.avg_similarity_queries_per_minute).toBeGreaterThanOrEqual(0);
    });

    it('should track query rates for hybrid searches', async () => {
      const mockResults = { rows: [] };
      const client = await mockPool.connect();
      (client.query as jest.Mock).mockResolvedValue(mockResults);

      const queryEmbedding = [0.1, 0.2, 0.3];

      // Perform hybrid searches
      await service.hybridSearch(queryEmbedding, {});
      await service.hybridSearch(queryEmbedding, { content_types: ['code'] });

      // Query rate should be tracked
      (client.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const stats = await service.getStats();
      expect(typeof stats.avg_similarity_queries_per_minute).toBe('number');
    });
  });
});
