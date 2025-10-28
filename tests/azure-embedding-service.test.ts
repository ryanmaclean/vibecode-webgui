import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from '../src/lib/ai/azureEmbeddingService';
import * as dotenv from 'dotenv';

dotenv.config();

// Skip tests if Azure credentials are not available
const isAzureConfigured = 
  process.env.AZURE_OPENAI_API_KEY && 
  process.env.AZURE_OPENAI_ENDPOINT && 
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

const describeOrSkip = isAzureConfigured ? describe : describe.skip;

describeOrSkip('Azure Embedding Service', () => {
  let prisma: PrismaClient;
  let azureEmbeddingService: AzureEmbeddingService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    azureEmbeddingService = new AzureEmbeddingService(
      process.env.AZURE_OPENAI_API_KEY!,
      process.env.AZURE_OPENAI_ENDPOINT!,
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      prisma
    );
    
    // Ensure database is clean
    await prisma.$executeRaw`TRUNCATE TABLE document_embeddings CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should generate embeddings', async () => {
    const testText = 'This is a test for Azure OpenAI embeddings';
    
    const embedding = await azureEmbeddingService.generateEmbedding(testText);
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
  });

  test('should store document with embeddings', async () => {
    const testDoc = {
      id: 'azure-test-doc-1',
      content: 'This is a test document for Azure vector embeddings',
      metadata: { test: true, provider: 'azure' }
    };

    const result = await azureEmbeddingService.storeDocument(
      testDoc.id,
      testDoc.content,
      testDoc.metadata
    );

    expect(result).toBeDefined();
  });

  test('should find similar documents', async () => {
    const similarDocs = await azureEmbeddingService.findSimilarDocuments(
      'Find test document about Azure vector embeddings',
      { threshold: 0.7, limit: 1 }
    );

    expect(similarDocs.length).toBeGreaterThan(0);
    expect(similarDocs[0].document_id).toBe('azure-test-doc-1');
  });

  test('should perform RAG query', async () => {
    const testQuery = 'What are Azure vector embeddings?';
    
    const result = await azureEmbeddingService.ragQuery(testQuery, {
      threshold: 0.5,
      limit: 2
    });

    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('documents');
    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.provider).toBe('azure');
  });

  test('should retrieve embedding statistics', async () => {
    const stats = await azureEmbeddingService.getStats();
    
    expect(stats).toBeDefined();
    expect(stats.provider).toBe('azure');
  });
});