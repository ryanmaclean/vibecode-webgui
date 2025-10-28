import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory } from '../src/lib/ai/embeddingServiceFactory';
import { VectorService } from '../src/lib/db/vector';
import * as dotenv from 'dotenv';

dotenv.config();

describe('GenAI Workflow with PostgreSQL', () => {
  let prisma: PrismaClient;
  let embeddingService: any;
  let vectorService: VectorService;
  let factory: EmbeddingServiceFactory;

  beforeAll(async () => {
    prisma = new PrismaClient();
    vectorService = new VectorService(prisma);
    factory = new EmbeddingServiceFactory(prisma);
    embeddingService = factory.createEmbeddingServiceFromEnv();
    
    // Ensure database is clean
    await prisma.$executeRaw`TRUNCATE TABLE document_embeddings CASCADE`;
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
