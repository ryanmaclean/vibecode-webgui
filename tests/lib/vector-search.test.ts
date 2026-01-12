/**
 * Comprehensive tests for VectorSearchService
 * Tests for vector database operations, similarity search, and stats
 */

import { VectorSearchService } from '@/lib/vector-search';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorSearchService();
    const PoolMock = Pool as jest.MockedClass<typeof Pool>;
    if (PoolMock.mock.results.length > 0) {
      mockPool = PoolMock.mock.results[0].value;
      if (mockPool.connect.mock.results.length > 0) {
        mockClient = mockPool.connect.mock.results[0].value;
      }
    }
  });

  afterEach(async () => {
    await service.close();
  });

  describe('constructor', () => {
    it('should create Pool with default configuration', () => {
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'pgvector-vibecode-pgvector.vibecode-webgui.svc.cluster.local',
          port: 5432,
          database: 'vibecode',
          user: 'vibecode',
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        })
      );
    });

    it('should use environment variables when provided', () => {
      process.env.PGVECTOR_HOST = 'custom-host';
      process.env.PGVECTOR_PORT = '5433';
      process.env.PGVECTOR_DATABASE = 'custom-db';
      process.env.PGVECTOR_USER = 'custom-user';
      process.env.PGVECTOR_PASSWORD = 'secret-password';

      new VectorSearchService();

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom-host',
          port: 5433,
          database: 'custom-db',
          user: 'custom-user',
          password: 'secret-password',
        })
      );

      // Cleanup
      delete process.env.PGVECTOR_HOST;
      delete process.env.PGVECTOR_PORT;
      delete process.env.PGVECTOR_DATABASE;
      delete process.env.PGVECTOR_USER;
      delete process.env.PGVECTOR_PASSWORD;
    });
  });

  describe('storeEmbedding', () => {
    it('should store embedding successfully', async () => {
      const mockId = 42;
      mockClient.query.mockResolvedValue({ rows: [{ id: mockId }] });

      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const metadata = { language: 'typescript', framework: 'react' };

      const result = await service.storeEmbedding('code', 'hash123', embedding, metadata);

      expect(result).toBe(mockId);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO embeddings'),
        expect.arrayContaining([
          'code',
          'hash123',
          '[0.1,0.2,0.3,0.4,0.5]',
          JSON.stringify(metadata),
        ])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle upsert on conflict', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ id: 42 }] });

      await service.storeEmbedding('code', 'existing-hash', [0.1, 0.2], {});

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (content_hash)'),
        expect.any(Array)
      );
    });

    it('should store embedding with empty metadata', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await service.storeEmbedding('doc', 'hash456', [0.1, 0.2]);

      expect(result).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), expect.any(String), expect.any(String), '{}'])
      );
    });

    it('should release client on error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(service.storeEmbedding('code', 'hash789', [0.1])).rejects.toThrow(
        'Database error'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('similaritySearch', () => {
    it('should perform basic similarity search', async () => {
      const mockRows = [
        {
          id: 1,
          content_type: 'code',
          content_hash: 'hash1',
          metadata: { language: 'typescript' },
          similarity: '0.85',
        },
        {
          id: 2,
          content_type: 'code',
          content_hash: 'hash2',
          metadata: { language: 'python' },
          similarity: '0.72',
        },
      ];
      mockClient.query.mockResolvedValue({ rows: mockRows });

      const result = await service.similaritySearch([0.1, 0.2, 0.3]);

      expect(result).toEqual([
        {
          id: 1,
          content_type: 'code',
          content_hash: 'hash1',
          metadata: { language: 'typescript' },
          similarity: 0.85,
        },
        {
          id: 2,
          content_type: 'code',
          content_hash: 'hash2',
          metadata: { language: 'python' },
          similarity: 0.72,
        },
      ]);
    });

    it('should filter by content type', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.similaritySearch([0.1, 0.2], { content_type: 'documentation' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['[0.1,0.2]', 'documentation'])
      );
    });

    it('should filter by language', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.similaritySearch([0.1, 0.2], { language: 'javascript' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'language'"),
        expect.arrayContaining(['[0.1,0.2]', 'javascript'])
      );
    });

    it('should filter by framework', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.similaritySearch([0.1, 0.2], { framework: 'nextjs' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'framework'"),
        expect.arrayContaining(['[0.1,0.2]', 'nextjs'])
      );
    });

    it('should apply similarity threshold', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.similaritySearch([0.1, 0.2], { similarity_threshold: 0.8 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding <-> $1 <'),
        expect.arrayContaining(['[0.1,0.2]', 0.8])
      );
    });

    it('should respect limit parameter', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.similaritySearch([0.1, 0.2], { limit: 5 });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['[0.1,0.2]', 5])
      );
    });

    it('should combine multiple filters', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.similaritySearch([0.1, 0.2], {
        content_type: 'code',
        language: 'typescript',
        framework: 'react',
        similarity_threshold: 0.7,
        limit: 3,
      });

      const callArgs = mockClient.query.mock.calls[0];
      expect(callArgs[0]).toContain('WHERE');
      expect(callArgs[0]).toContain('content_type');
      expect(callArgs[0]).toContain("metadata->>'language'");
      expect(callArgs[0]).toContain("metadata->>'framework'");
      expect(callArgs[1]).toEqual(
        expect.arrayContaining(['[0.1,0.2]', 'code', 'typescript', 'react', 0.7, 3])
      );
    });
  });

  describe('findSimilarCode', () => {
    it('should search for similar code snippets', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.findSimilarCode([0.1, 0.2], 'python', 'django', 3);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['[0.1,0.2]', 'code', 'python', 'django', 0.8, 3])
      );
    });

    it('should use default parameters', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.findSimilarCode([0.1, 0.2]);

      const callArgs = mockClient.query.mock.calls[0][1];
      expect(callArgs).toContain('code');
      expect(callArgs).toContain(0.8); // similarity threshold
      expect(callArgs).toContain(5); // default limit
    });
  });

  describe('findRelevantDocs', () => {
    it('should search for relevant documentation', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.findRelevantDocs([0.1, 0.2], 5);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['[0.1,0.2]', 'documentation', 0.7, 5])
      );
    });

    it('should use default limit', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.findRelevantDocs([0.1, 0.2]);

      const callArgs = mockClient.query.mock.calls[0][1];
      expect(callArgs).toContain(3); // default limit
    });
  });

  describe('hybridSearch', () => {
    it('should perform hybrid search with content types filter', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.hybridSearch([0.1, 0.2], { content_types: ['code', 'documentation'] }, 10);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('content_type = ANY'),
        expect.arrayContaining(['[0.1,0.2]', ['code', 'documentation'], 10])
      );
    });

    it('should filter by languages', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.hybridSearch([0.1, 0.2], { languages: ['typescript', 'javascript'] });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'language' = ANY"),
        expect.arrayContaining(['[0.1,0.2]', ['typescript', 'javascript']])
      );
    });

    it('should filter by frameworks', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.hybridSearch([0.1, 0.2], { frameworks: ['react', 'vue'] });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("metadata->>'framework' = ANY"),
        expect.arrayContaining(['[0.1,0.2]', ['react', 'vue']])
      );
    });

    it('should filter by date range', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.hybridSearch([0.1, 0.2], {
        date_range: { start: startDate, end: endDate },
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at BETWEEN'),
        expect.arrayContaining(['[0.1,0.2]', startDate, endDate])
      );
    });

    it('should handle empty filters', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await service.hybridSearch([0.1, 0.2], {});

      const callArgs = mockClient.query.mock.calls[0];
      expect(callArgs[0]).not.toContain('WHERE');
    });

    it('should combine all filters', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.hybridSearch(
        [0.1, 0.2],
        {
          content_types: ['code'],
          languages: ['typescript'],
          frameworks: ['nextjs'],
          date_range: { start: startDate, end: endDate },
        },
        15
      );

      const callArgs = mockClient.query.mock.calls[0];
      expect(callArgs[0]).toContain('WHERE');
      expect(callArgs[0]).toContain('content_type = ANY');
      expect(callArgs[0]).toContain("metadata->>'language' = ANY");
      expect(callArgs[0]).toContain("metadata->>'framework' = ANY");
      expect(callArgs[0]).toContain('created_at BETWEEN');
      expect(callArgs[1]).toEqual([
        '[0.1,0.2]',
        ['code'],
        ['typescript'],
        ['nextjs'],
        startDate,
        endDate,
        15,
      ]);
    });
  });

  describe('getStats', () => {
    it('should return embedding statistics', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({
          rows: [
            { content_type: 'code', count: '60' },
            { content_type: 'documentation', count: '40' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { language: 'typescript', count: '45' },
            { language: 'python', count: '30' },
            { language: 'javascript', count: '25' },
          ],
        });

      const stats = await service.getStats();

      expect(stats).toEqual({
        total_embeddings: 100,
        by_content_type: {
          code: 60,
          documentation: 40,
        },
        by_language: {
          typescript: 45,
          python: 30,
          javascript: 25,
        },
        avg_similarity_queries_per_minute: 0,
      });
    });

    it('should handle empty database', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const stats = await service.getStats();

      expect(stats).toEqual({
        total_embeddings: 0,
        by_content_type: {},
        by_language: {},
        avg_similarity_queries_per_minute: 0,
      });
    });

    it('should release client after stats query', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getStats();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the connection pool', async () => {
      await service.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});
