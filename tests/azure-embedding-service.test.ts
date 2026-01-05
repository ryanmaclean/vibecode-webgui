import { jest } from '@jest/globals';
import { AzureEmbeddingService } from '../src/lib/ai/azure-embedding-service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock VectorConnectionPoolFactory
jest.mock('../src/lib/db/vector-connection-pool', () => ({
  VectorConnectionPoolFactory: {
    createPool: jest.fn(() => ({
      acquire: jest.fn(),
      release: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
    })),
  },
  VectorConnectionPool: jest.fn(),
}));

describe('Azure Embedding Service', () => {
  let azureEmbeddingService: AzureEmbeddingService;
  const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

  beforeEach(() => {
    jest.clearAllMocks();

    // Create service instance with mock config
    azureEmbeddingService = new AzureEmbeddingService({
      apiKey: 'test-api-key',
      endpoint: 'https://test.openai.azure.com',
      deploymentName: 'text-embedding-ada-002',
      apiVersion: '2023-05-15',
      dimensions: 1536,
    });

    // Setup default axios mock response
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
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for text', async () => {
      const testText = 'This is a test for Azure OpenAI embeddings';

      const embedding = await azureEmbeddingService.generateEmbedding(testText);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('openai/deployments/text-embedding-ada-002/embeddings'),
        expect.objectContaining({ input: testText }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        azureEmbeddingService.generateEmbedding('test')
      ).rejects.toThrow('API Error');
    });

    it('should handle invalid API responses', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      await expect(
        azureEmbeddingService.generateEmbedding('test')
      ).rejects.toThrow('Invalid response');
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const mockEmbeddings = texts.map((_, i) =>
        new Array(1536).fill(0).map(() => Math.random())
      );

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: mockEmbeddings.map((embedding, index) => ({
            embedding,
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

      const embeddings = await azureEmbeddingService.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
      embeddings.forEach(emb => {
        expect(emb.length).toBe(1536);
      });
    });

    it('should handle batch processing for large inputs', async () => {
      const texts = new Array(50).fill('test').map((t, i) => `${t}${i}`);

      // Mock multiple batch responses - each call processes up to 20 items
      let callCount = 0;
      mockedAxios.post.mockImplementation((url, data) => {
        const inputTexts = Array.isArray(data.input) ? data.input : [data.input];
        const numEmbeddings = inputTexts.length;
        callCount++;

        return Promise.resolve({
          data: {
            data: new Array(numEmbeddings).fill(null).map((_, index) => ({
              embedding: mockEmbedding,
              index,
              object: 'embedding',
            })),
            model: 'text-embedding-ada-002',
            object: 'list',
            usage: { prompt_tokens: numEmbeddings * 8, total_tokens: numEmbeddings * 8 },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const embeddings = await azureEmbeddingService.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(50);
      // Should have made multiple batch calls (50 items / 20 per batch = 3 calls)
      expect(mockedAxios.post.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      const healthy = await azureEmbeddingService.healthCheck();

      expect(healthy).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should return false when API fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection failed'));

      const healthy = await azureEmbeddingService.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('createEmbeddingTableIfNotExists', () => {
    it('should skip table creation when no database config', async () => {
      const result = await azureEmbeddingService.createEmbeddingTableIfNotExists();

      expect(result).toBe(false);
    });
  });
});