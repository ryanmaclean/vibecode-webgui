/**
 * Test Azure Embedding Service with Managed Identity Authentication
 * 
 * This script tests the Azure OpenAI Embedding Service using managed identity
 * authentication instead of API keys for more secure credential management.
 * 
 * Prerequisites:
 * - An Azure environment with managed identity configured
 * - Appropriate role assignments for the managed identity to access Azure OpenAI
 * - PostgreSQL database with pgvector extension
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './src/lib/ai/azureEmbeddingService.js';
import { EmbeddingServiceFactory, EmbeddingProvider } from './src/lib/ai/embeddingServiceFactory.js';

// Load environment variables
config({ path: '.env.azure' });

// Test sample data
const testDocuments = [
  {
    id: 'doc-001',
    content: 'Azure managed identity provides a secure way to authenticate without API keys',
    metadata: { category: 'security', source: 'documentation' }
  },
  {
    id: 'doc-002',
    content: 'Vector embeddings enable semantic search across document collections',
    metadata: { category: 'machine-learning', source: 'tutorial' }
  },
  {
    id: 'doc-003',
    content: 'pgvector extension for PostgreSQL stores and indexes vector embeddings',
    metadata: { category: 'database', source: 'tech-blog' }
  }
];

/**
 * Test direct instantiation of AzureEmbeddingService with managed identity
 */
async function testDirectInstantiation() {
  console.log('\n--- Testing Direct Instantiation with Managed Identity ---');
  
  const prisma = new PrismaClient();
  
  try {
    console.log('Creating Azure Embedding Service with managed identity...');
    const embeddingService = new AzureEmbeddingService(
      '', // Empty API key
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      prisma,
      true // Use managed identity
    );
    
    console.log('Generating embedding for test content...');
    const embedding = await embeddingService.generateEmbedding('This is a test of Azure managed identity authentication');
    
    console.log('Embedding generated successfully:', embedding.length, 'dimensions');
    console.log('Sample embedding values:', embedding.slice(0, 5));
    
    return true;
  } catch (error) {
    console.error('Error testing direct instantiation:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Test embedding service factory with managed identity
 */
async function testFactoryCreation() {
  console.log('\n--- Testing Factory Creation with Managed Identity ---');
  
  const prisma = new PrismaClient();
  const factory = new EmbeddingServiceFactory(prisma);
  
  try {
    console.log('Creating embedding service with factory...');
    const service = factory.createEmbeddingService({
      provider: EmbeddingProvider.AZURE,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      useManagedIdentity: true
    });
    
    console.log('Embedding service created successfully');
    console.log('Testing embedding generation...');
    
    const embedding = await service.generateEmbedding('Testing factory creation with managed identity');
    console.log('Embedding generated successfully:', embedding.length, 'dimensions');
    
    return true;
  } catch (error) {
    console.error('Error testing factory creation:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Test environment-based creation
 */
async function testEnvironmentCreation() {
  console.log('\n--- Testing Environment-Based Creation with Managed Identity ---');
  
  // Save original env vars
  const originalApiKey = process.env.AZURE_OPENAI_API_KEY;
  const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const originalUseMI = process.env.USE_AZURE_MANAGED_IDENTITY;
  
  // Set environment for managed identity
  process.env.AZURE_OPENAI_API_KEY = '';
  process.env.USE_AZURE_MANAGED_IDENTITY = 'true';
  
  const prisma = new PrismaClient();
  
  try {
    console.log('Creating embedding service from environment...');
    const factory = new EmbeddingServiceFactory(prisma);
    const service = factory.createEmbeddingServiceFromEnv();
    
    console.log('Testing embedding generation...');
    const embedding = await service.generateEmbedding('Testing environment-based creation with managed identity');
    
    console.log('Embedding generated successfully:', embedding.length, 'dimensions');
    return true;
  } catch (error) {
    console.error('Error testing environment creation:', error.message);
    return false;
  } finally {
    // Restore original env vars
    process.env.AZURE_OPENAI_API_KEY = originalApiKey;
    process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = originalDeployment;
    process.env.USE_AZURE_MANAGED_IDENTITY = originalUseMI;
    
    await prisma.$disconnect();
  }
}

/**
 * Test document storage and retrieval
 */
async function testDocumentOperations() {
  console.log('\n--- Testing Document Operations with Managed Identity ---');
  
  const prisma = new PrismaClient();
  
  try {
    console.log('Creating embedding service with managed identity...');
    const embeddingService = new AzureEmbeddingService(
      '', // Empty API key
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
      prisma,
      true // Use managed identity
    );
    
    // Store test documents
    console.log('Storing test documents...');
    for (const doc of testDocuments) {
      await embeddingService.storeDocument(doc.id, doc.content, doc.metadata);
      console.log(`Stored document: ${doc.id}`);
    }
    
    // Perform similarity search
    console.log('Testing similarity search...');
    const query = 'How do I use authentication in Azure?';
    const results = await embeddingService.findSimilarDocuments(query, {
      threshold: 0.5,
      limit: 3
    });
    
    console.log(`Found ${results.length} similar documents for query: "${query}"`);
    results.forEach(doc => {
      console.log(`- ${doc.document_id} (similarity: ${doc.similarity.toFixed(4)})`);
      console.log(`  Content: ${doc.content}`);
      console.log(`  Metadata: ${JSON.stringify(doc.metadata)}`);
    });
    
    return results.length > 0;
  } catch (error) {
    console.error('Error testing document operations:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== AZURE EMBEDDING SERVICE MANAGED IDENTITY TEST ===');
  console.log('Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
  console.log('Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
  
  const results = {
    directInstantiation: await testDirectInstantiation(),
    factoryCreation: await testFactoryCreation(),
    environmentCreation: await testEnvironmentCreation(),
    documentOperations: await testDocumentOperations()
  };
  
  console.log('\n=== TEST RESULTS ===');
  Object.entries(results).forEach(([test, success]) => {
    console.log(`${test}: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });