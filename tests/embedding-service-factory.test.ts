import { PrismaClient } from '@prisma/client';
import { EmbeddingServiceFactory } from '../src/lib/ai/embeddingServiceFactory';
import { EmbeddingService } from '../src/lib/ai/embeddingService';
import { AzureEmbeddingService } from '../src/lib/ai/azureEmbeddingService';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Embedding Service Factory', () => {
  let prisma: PrismaClient;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    prisma = new PrismaClient();
    originalEnv = { ...process.env };
  });

  afterAll(async () => {
    await prisma.$disconnect();
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Reset env variables before each test
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    delete process.env.OPENAI_API_KEY;
  });

  test('should create Azure embedding service when Azure environment variables are set', () => {
    // Set Azure environment variables
    process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test-azure-endpoint.openai.azure.com';
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'text-embedding-3-small';

    const service = EmbeddingServiceFactory.createEmbeddingService(prisma);

    expect(service).toBeInstanceOf(AzureEmbeddingService);
  });

  test('should create standard OpenAI embedding service when OpenAI API key is set', () => {
    // Set OpenAI environment variable
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const service = EmbeddingServiceFactory.createEmbeddingService(prisma);

    expect(service).toBeInstanceOf(EmbeddingService);
  });

  test('should prioritize Azure when both Azure and OpenAI credentials are available', () => {
    // Set both Azure and OpenAI environment variables
    process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test-azure-endpoint.openai.azure.com';
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'text-embedding-3-small';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    const service = EmbeddingServiceFactory.createEmbeddingService(prisma);

    expect(service).toBeInstanceOf(AzureEmbeddingService);
  });

  test('should throw error when no credentials are available', () => {
    expect(() => {
      EmbeddingServiceFactory.createEmbeddingService(prisma);
    }).toThrow('No embedding service API keys configured');
  });
});