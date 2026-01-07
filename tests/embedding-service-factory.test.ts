import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory, EmbeddingProvider } from '../src/lib/ai/embeddingServiceFactory';
import { AzureEmbeddingService } from '../src/lib/ai/azure-embedding-service';
import * as dotenv from 'dotenv';

// Mock Prisma Client
jest.mock('@prisma/client');

dotenv.config();

describe('Embedding Service Factory', () => {
  let prisma: PrismaClient;
  let embeddingServiceFactory: EmbeddingServiceFactory;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    prisma = new PrismaClient();
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // Reset env variables before each test
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    delete process.env.OPENAI_API_KEY;
    
    // Create a new factory instance for each test
    embeddingServiceFactory = new EmbeddingServiceFactory(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    process.env = originalEnv;
  });

  test('should create Azure embedding service when Azure environment variables are set', () => {
    // Set Azure environment variables
    process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test-azure-endpoint.openai.azure.com';
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'text-embedding-3-small';

    const service = embeddingServiceFactory.createEmbeddingServiceFromEnv();

    expect(service).toBeInstanceOf(AzureEmbeddingService);
  });

  test('should create Azure embedding service with explicit configuration', () => {
    const service = embeddingServiceFactory.createEmbeddingService({
      provider: EmbeddingProvider.AZURE,
      apiKey: 'test-azure-key',
      endpoint: 'https://test-azure-endpoint.openai.azure.com',
      deploymentName: 'text-embedding-3-small'
    });

    expect(service).toBeInstanceOf(AzureEmbeddingService);
  });

  test('should throw error when Azure configuration is incomplete', () => {
    expect(() => {
      embeddingServiceFactory.createEmbeddingService({
        provider: EmbeddingProvider.AZURE,
        apiKey: 'test-azure-key',
        // Missing endpoint and deploymentName
      });
    }).toThrow('Azure OpenAI configuration requires apiKey, endpoint, and deploymentName');
  });

  test('should throw error when no credentials are available in environment', () => {
    expect(() => {
      embeddingServiceFactory.createEmbeddingServiceFromEnv();
    }).toThrow('No valid embedding service configuration found in environment variables');
  });
});