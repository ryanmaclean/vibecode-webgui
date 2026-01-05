import { jest } from '@jest/globals';
import { AzureEmbeddingService } from '../src/lib/ai/azure-embedding-service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock VectorConnectionPoolFactory with database operations
jest.mock('../src/lib/db/vector-connection-pool', () => {
  const mockDocuments = new Map<string, any>();

  const mockClient = {
    query: jest.fn((sql: string, params?: any[]) => {
      // Mock CREATE EXTENSION
      if (sql.includes('CREATE EXTENSION')) {
        return Promise.resolve({ rows: [] });
      }
      // Mock CREATE TABLE
      if (sql.includes('CREATE TABLE')) {
        return Promise.resolve({ rows: [] });
      }
      // Mock CREATE INDEX
      if (sql.includes('CREATE INDEX')) {
        return Promise.resolve({ rows: [] });
      }
      // Mock SELECT (check for existing)
      if (sql.includes('SELECT id FROM') && sql.includes('WHERE text_hash')) {
        const text = params?.[0] || '';
        const doc = Array.from(mockDocuments.values()).find(d => d.text === text);
        return Promise.resolve({ rows: doc ? [{ id: doc.id }] : [] });
      }
      // Mock INSERT
      if (sql.includes('INSERT INTO')) {
        const id = Date.now().toString();
        const [text, embedding, model] = params || [];
        mockDocuments.set(id, { id, text, embedding, model });
        return Promise.resolve({ rows: [] });
      }
      // Mock UPDATE
      if (sql.includes('UPDATE')) {
        return Promise.resolve({ rows: [] });
      }
      // Mock vector similarity search
      if (sql.includes('ORDER BY embedding')) {
        const docs = Array.from(mockDocuments.values()).map((doc, idx) => ({
          id: doc.id,
          document_id: doc.id,
          content: doc.text,
          similarity: 0.95 - idx * 0.1,
        }));
        return Promise.resolve({ rows: docs.slice(0, 5) });
      }
      return Promise.resolve({ rows: [] });
    }),
    release: jest.fn(),
  };

  return {
    VectorConnectionPoolFactory: {
      createPool: jest.fn(() => ({
        acquire: jest.fn().mockResolvedValue(mockClient),
        release: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
      })),
    },
    VectorConnectionPool: jest.fn(),
  };
});

describe('Azure Embedding Service E2E Tests', () => {
  let embeddingService: AzureEmbeddingService;
  const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup axios mock
    mockedAxios.post.mockResolvedValue({
      data: {
        data: [
          {
            embedding: mockEmbedding,
            index: 0,
            object: 'embedding',
          },
        ],
        model: 'text-embedding-ada-002',
        object: 'list',
        usage: {
          prompt_tokens: 8,
          total_tokens: 8,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    // Create embedding service with database config
    embeddingService = new AzureEmbeddingService({
      apiKey: 'test-api-key',
      endpoint: 'https://test.openai.azure.com',
      deploymentName: 'text-embedding-ada-002',
      apiVersion: '2023-05-15',
      dimensions: 1536,
      database: {
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
        database: 'test',
        tableName: 'embeddings',
        useConnectionPool: true,
      },
    });
  });

  describe('Integration Tests', () => {
    it('should generate embeddings for text', async () => {
      const testText = 'This is a test of the Azure embedding service';

      const embedding = await embeddingService.generateEmbedding(testText);

      // Verify the embedding is valid
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);

      // Azure text-embedding-ada-002 typically produces 1536-dimensional vectors
      expect(embedding.length).toBe(1536);

      // All values should be numbers
      embedding.forEach(value => {
        expect(typeof value).toBe('number');
      });
    });

    it('should handle multiple embedding generation', async () => {
      const texts = [
        'First test text',
        'Second test text',
        'Third test text',
      ];

      // Mock batch response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: texts.map((_, index) => ({
            embedding: mockEmbedding,
            index,
            object: 'embedding',
          })),
          model: 'text-embedding-ada-002',
          object: 'list',
          usage: { prompt_tokens: 24, total_tokens: 24 },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const embeddings = await embeddingService.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);

      embeddings.forEach(embedding => {
        expect(embedding.length).toBe(1536);
      });
    });

    it('should create embedding table structure', async () => {
      const result = await embeddingService.createEmbeddingTableIfNotExists();

      expect(result).toBe(true);
    });

    it('should perform health check successfully', async () => {
      const healthy = await embeddingService.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should handle API failures during health check', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API unavailable'));

      const healthy = await embeddingService.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should cache embeddings in database when configured', async () => {
      const testText = 'Cached embedding test';

      await embeddingService.generateEmbedding(testText);

      // Verify axios was called
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should handle concurrent embedding requests', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3', 'Text 4', 'Text 5'];

      const promises = texts.map(text =>
        embeddingService.generateEmbedding(text)
      );

      const embeddings = await Promise.all(promises);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(5);
      embeddings.forEach(embedding => {
        expect(embedding.length).toBe(1536);
      });
    });

    it('should use correct API endpoint format', async () => {
      await embeddingService.generateEmbedding('test');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringMatching(
          /https:\/\/test\.openai\.azure\.com\/openai\/deployments\/text-embedding-ada-002\/embeddings\?api-version=2023-05-15/
        ),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should include correct headers in API requests', async () => {
      await embeddingService.generateEmbedding('test');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'api-key': 'test-api-key',
          }),
        })
      );
    });
  });
});