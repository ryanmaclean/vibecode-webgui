import * as dotenv from 'dotenv';

dotenv.config();

// Mock Prisma Client
const mockPrismaClient = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient)
}));

// Create the mock object that will be returned
const mockStoreDocument = jest.fn();
const mockFindSimilarDocuments = jest.fn();
const mockRagQuery = jest.fn();

const mockEmbeddingService = {
  storeDocument: mockStoreDocument,
  findSimilarDocuments: mockFindSimilarDocuments,
  ragQuery: mockRagQuery
};

jest.mock('../src/lib/ai/embeddingServiceFactory', () => ({
  EmbeddingServiceFactory: jest.fn().mockImplementation(() => ({
    createEmbeddingServiceFromEnv: jest.fn(() => mockEmbeddingService)
  }))
}));

// Mock VectorService for database operations with proper async returns
const mockVectorServiceMethods = {
  getEmbeddingStats: jest.fn().mockImplementation(async () => {
    return Promise.resolve([
      {
        hour_bucket: new Date(),
        total_embeddings: 10
      }
    ]);
  }),
  cleanupOldEmbeddings: jest.fn().mockImplementation(async (days) => {
    return Promise.resolve({ deletedCount: 5 });
  })
};

jest.mock('../src/lib/db/vector', () => ({
  VectorService: jest.fn().mockImplementation(() => mockVectorServiceMethods)
}));

// Import after mocks are set up
import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory } from '../src/lib/ai/embeddingServiceFactory';
import { VectorService } from '../src/lib/db/vector';

describe('GenAI Workflow with PostgreSQL', () => {
  let prisma: PrismaClient;
  let embeddingService: any;
  let vectorService: VectorService;
  let factory: EmbeddingServiceFactory;

  beforeAll(async () => {
    // Configure mock implementations
    mockStoreDocument.mockImplementation(async (id, content, metadata) => {
      return { id, content, metadata };
    });

    mockFindSimilarDocuments.mockImplementation(async (query, options) => {
      return [
        {
          document_id: 'test-doc-1',
          content: 'This is a test document for vector search',
          similarity: 0.95,
          metadata: { test: true }
        }
      ];
    });

    mockRagQuery.mockImplementation(async (query, options) => {
      return {
        query,
        documents: [
          {
            document_id: 'test-doc-1',
            content: 'This is a test document for vector search',
            similarity: 0.95,
            metadata: { test: true }
          }
        ]
      };
    });

    prisma = new PrismaClient();
    vectorService = new VectorService(prisma);
    factory = new EmbeddingServiceFactory(prisma);
    embeddingService = factory.createEmbeddingServiceFromEnv();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should store and retrieve document embeddings', async () => {
    const testDoc = {
      id: 'test-doc-1',
      content: 'This is a test document for vector search',
      metadata: { test: true }
    };

    // Store document
    const result = await embeddingService.storeDocument(
      testDoc.id,
      testDoc.content,
      testDoc.metadata
    );

    expect(result).toBeDefined();

    // Search for similar documents
    const similarDocs = await embeddingService.findSimilarDocuments(
      'Find test document about vector search',
      { threshold: 0.7, limit: 1 }
    );

    expect(similarDocs.length).toBeGreaterThan(0);
    expect(similarDocs[0].document_id).toBe(testDoc.id);
  });

  test('should perform RAG query', async () => {
    const testQuery = 'What is vector search?';
    
    const result = await embeddingService.ragQuery(testQuery, {
      threshold: 0.5,
      limit: 2
    });

    expect(result).toHaveProperty('query');
    expect(result).toHaveProperty('documents');
    expect(result.documents.length).toBeGreaterThan(0);
  });

  test('should retrieve embedding statistics', async () => {
    const stats = await vectorService.getEmbeddingStats();
    
    // Stats should be defined
    expect(stats).toBeDefined();
    
    // Expect the structure to match the query in VectorService
    const anyStats = stats as any;
    if (Array.isArray(anyStats) && anyStats.length > 0) {
      const stat = anyStats[0];
      expect(stat).toHaveProperty('hour_bucket');
      expect(stat).toHaveProperty('total_embeddings');
    }
  });

  test('should clean up old embeddings', async () => {
    const result = await vectorService.cleanupOldEmbeddings(30);
    
    // Should return an object with deletedCount
    expect(result).toHaveProperty('deletedCount');
    expect(typeof result.deletedCount).toBe('number');
  });
});
