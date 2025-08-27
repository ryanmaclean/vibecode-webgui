import { PrismaClient } from '@prisma/client';
import { EmbeddingService } from './embeddingService';
import { AzureEmbeddingService } from './azureEmbeddingService';
import { createRobustConnection } from '../db/robust-db-connection';

export class EmbeddingServiceFactory {
  /**
   * Create an embedding service based on environment configuration
   */
  static createEmbeddingService(prismaClient: PrismaClient): EmbeddingService | AzureEmbeddingService {
    // Check if Azure OpenAI is configured
    if (process.env.AZURE_OPENAI_API_KEY && 
        process.env.AZURE_OPENAI_ENDPOINT && 
        process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
      console.log('Using Azure OpenAI for embeddings');
      return new AzureEmbeddingService(
        process.env.AZURE_OPENAI_API_KEY,
        process.env.AZURE_OPENAI_ENDPOINT,
        process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        process.env.AZURE_OPENAI_API_VERSION || '2023-05-15',
        prismaClient
      );
    }

    // Fall back to standard OpenAI
    if (process.env.OPENAI_API_KEY) {
      console.log('Using OpenAI for embeddings');
      return new EmbeddingService(
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        prismaClient
      );
    }

    // No API keys configured
    throw new Error('No embedding service API keys configured. Set either OPENAI_API_KEY or AZURE_OPENAI_API_KEY in your environment.');
  }
  
  /**
   * Create an embedding service with robust database connection
   */
  static async createEmbeddingServiceWithRobustConnection(): Promise<{ 
    service: EmbeddingService | AzureEmbeddingService, 
    releaseConnection: () => boolean 
  }> {
    // Create a robust database connection
    const connection = await createRobustConnection({
      debug: process.env.NODE_ENV !== 'production',
      poolKey: 'embedding-service'
    });
    
    if (!connection.success || !connection.prisma) {
      throw new Error(`Failed to create database connection: ${connection.error?.message || 'Unknown error'}`);
    }
    
    // Create the embedding service with the database connection
    const service = this.createEmbeddingService(connection.prisma);
    
    // Return both the service and a function to release the connection
    return { 
      service, 
      releaseConnection: connection.release || (() => false) 
    };
  }
}