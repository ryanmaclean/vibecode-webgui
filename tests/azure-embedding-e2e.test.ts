import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from '../src/lib/ai/azureEmbeddingService';
import { EmbeddingServiceFactory } from '../src/lib/ai/embeddingServiceFactory';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Azure Embedding Service E2E Tests', () => {
  let prisma: PrismaClient;
  let embeddingService: AzureEmbeddingService;
  
  // Skip the tests if Azure credentials are not available
  const hasAzureCredentials = 
    !!process.env.AZURE_OPENAI_API_KEY && 
    !!process.env.AZURE_OPENAI_ENDPOINT && 
    !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  
  beforeAll(async () => {
    if (!hasAzureCredentials) {
      console.warn('Skipping Azure embedding tests - no Azure credentials available');
      return;
    }
    
    prisma = new PrismaClient();
    
    // Create embedding service using factory
    try {
      const service = EmbeddingServiceFactory.createEmbeddingService(prisma);
      if (service instanceof AzureEmbeddingService) {
        embeddingService = service;
      } else {
        throw new Error('Factory did not create an AzureEmbeddingService instance');
      }
    } catch (error) {
      console.error('Failed to create embedding service:', error);
      throw error;
    }
  });
  
  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
  
  // Skip all tests if Azure credentials are not available
  const itif = hasAzureCredentials ? it : it.skip;
  
  itif('should generate embeddings for text', async () => {
    const testText = 'This is a test of the Azure embedding service';
    
    const embedding = await embeddingService.generateEmbedding(testText);
    
    // Verify the embedding is valid
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
    
    // Azure text-embedding-3-small typically produces 1536-dimensional vectors
    expect(embedding.length).toBe(1536);
    
    // All values should be numbers
    embedding.forEach(value => {
      expect(typeof value).toBe('number');
    });
  });
  
  itif('should store and retrieve documents with embeddings', async () => {
    // Skip if DB connection is not available
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      console.warn('Skipping database tests - no connection available');
      return;
    }
    
    const documentId = `test-doc-${Date.now()}`;
    const content = 'This is a test document for the Azure embedding service';
    const metadata = { source: 'e2e-test', testRun: Date.now() };
    
    // Store the document
    await embeddingService.storeDocument(documentId, content, metadata);
    
    // Query for similar documents
    const similarDocuments = await embeddingService.findSimilarDocuments(
      'test document for Azure',
      { threshold: 0.7, limit: 5 }
    );
    
    // Verify results
    expect(similarDocuments).toBeDefined();
    expect(Array.isArray(similarDocuments)).toBe(true);
    
    // Should find at least the document we just added
    expect(similarDocuments.length).toBeGreaterThan(0);
    
    // The top result should be our document
    const foundDoc = similarDocuments.find(doc => doc.document_id === documentId);
    expect(foundDoc).toBeDefined();
    
    // Clean up - delete the test document
    await prisma.$executeRaw`DELETE FROM document_embeddings WHERE document_id = ${documentId}`;
  });
  
  itif('should perform a RAG query', async () => {
    // Skip if DB connection is not available
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      console.warn('Skipping database tests - no connection available');
      return;
    }
    
    // First add some test documents
    const testDocs = [
      {
        id: `rag-test-1-${Date.now()}`,
        content: 'Azure OpenAI provides embeddings through a REST API interface.',
        metadata: { source: 'e2e-test', category: 'technical' }
      },
      {
        id: `rag-test-2-${Date.now()}`,
        content: 'Vector embeddings are useful for semantic search applications.',
        metadata: { source: 'e2e-test', category: 'technical' }
      },
      {
        id: `rag-test-3-${Date.now()}`,
        content: 'PostgreSQL with pgvector can store and query vector embeddings efficiently.',
        metadata: { source: 'e2e-test', category: 'database' }
      }
    ];
    
    // Store all test documents
    for (const doc of testDocs) {
      await embeddingService.storeDocument(doc.id, doc.content, doc.metadata);
    }
    
    // Perform a RAG query
    const query = 'How can I use vector embeddings for search?';
    const result = await embeddingService.ragQuery(query, { threshold: 0.6 });
    
    // Verify results
    expect(result).toBeDefined();
    expect(result.provider).toBe('azure');
    expect(result.query).toBe(query);
    expect(Array.isArray(result.documents)).toBe(true);
    expect(result.documents.length).toBeGreaterThan(0);
    
    // Clean up - delete all test documents
    for (const doc of testDocs) {
      await prisma.$executeRaw`DELETE FROM document_embeddings WHERE document_id = ${doc.id}`;
    }
  });
});