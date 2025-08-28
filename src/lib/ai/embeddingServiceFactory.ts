/**
 * Embedding Service Factory
 * Creates and manages different embedding service providers
 */

import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './azureEmbeddingService';
import { EmbeddingService } from './embeddingService';

// Supported embedding providers
export enum EmbeddingProvider {
  AZURE = 'azure',
  OPENAI = 'openai',
  MOCK = 'mock'
}

// Configuration for embedding services
export interface EmbeddingServiceConfig {
  provider: EmbeddingProvider;
  apiKey?: string;
  endpoint?: string;
  deploymentName?: string;
  apiVersion?: string;
  dimensions?: number;
  model?: string;
  useManagedIdentity?: boolean;
}

// Type to handle both embedding service types
export type EmbeddingServiceType = AzureEmbeddingService | EmbeddingService;

/**
 * Factory class for creating embedding services
 */
export class EmbeddingServiceFactory {
  private prisma: PrismaClient;
  
  /**
   * Constructor for EmbeddingServiceFactory
   * 
   * @param prisma - PrismaClient instance for database operations
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  /**
   * Create an embedding service based on provider configuration
   * 
   * @param config - Configuration for the embedding service
   * @returns The appropriate embedding service instance
   */
  public createEmbeddingService(config: EmbeddingServiceConfig): EmbeddingServiceType {
    switch (config.provider) {
      case EmbeddingProvider.AZURE:
        if (config.useManagedIdentity) {
          if (!config.endpoint || !config.deploymentName) {
            throw new Error('Azure OpenAI configuration with managed identity requires endpoint and deploymentName');
          }
          
          return new AzureEmbeddingService(
            '', // Empty API key when using managed identity
            config.endpoint,
            config.deploymentName,
            config.apiVersion || '2023-05-15',
            this.prisma,
            true // Use managed identity
          );
        } else {
          if (!config.apiKey || !config.endpoint || !config.deploymentName) {
            throw new Error('Azure OpenAI configuration requires apiKey, endpoint, and deploymentName');
          }
          
          return new AzureEmbeddingService(
            config.apiKey,
            config.endpoint,
            config.deploymentName,
            config.apiVersion || '2023-05-15',
            this.prisma
          );
        }
        
      case EmbeddingProvider.OPENAI:
        if (!config.apiKey) {
          throw new Error('OpenAI embedding provider requires apiKey');
        }
        
        return new EmbeddingService(
          config.apiKey,
          config.model || 'text-embedding-3-small',
          this.prisma
        );
        
      case EmbeddingProvider.MOCK:
        // For future implementation - Mock embedding service for testing
        throw new Error('Mock embedding provider not yet implemented');
        
      default:
        throw new Error(`Unsupported embedding provider: ${config.provider}`);
    }
  }
  
  /**
   * Create an embedding service from environment variables
   * 
   * @returns The appropriate embedding service instance based on environment variables
   */
  public createEmbeddingServiceFromEnv(): EmbeddingServiceType {
    // Check for Azure OpenAI configuration
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';
    const useAzureManagedIdentity = process.env.USE_AZURE_MANAGED_IDENTITY === 'true';
    
    if (azureEndpoint && azureDeploymentName) {
      if (useAzureManagedIdentity) {
        return this.createEmbeddingService({
          provider: EmbeddingProvider.AZURE,
          endpoint: azureEndpoint,
          deploymentName: azureDeploymentName,
          apiVersion: azureApiVersion,
          useManagedIdentity: true
        });
      } else if (azureApiKey) {
        return this.createEmbeddingService({
          provider: EmbeddingProvider.AZURE,
          apiKey: azureApiKey,
          endpoint: azureEndpoint,
          deploymentName: azureDeploymentName,
          apiVersion: azureApiVersion
        });
      }
    }
    
    // Check for OpenAI configuration
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openaiModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    
    if (openaiApiKey) {
      return this.createEmbeddingService({
        provider: EmbeddingProvider.OPENAI,
        apiKey: openaiApiKey,
        model: openaiModel
      });
    }
    
    throw new Error('No valid embedding service configuration found in environment variables');
  }

  /**
   * Static method to create an embedding service instance from environment variables
   * 
   * @param prisma - PrismaClient instance for database operations
   * @returns The appropriate embedding service instance
   */
  public static createEmbeddingService(prisma: PrismaClient): EmbeddingServiceType {
    const factory = new EmbeddingServiceFactory(prisma);
    
    // Try to create service from environment variables
    try {
      return factory.createEmbeddingServiceFromEnv();
    } catch (error) {
      throw new Error('No embedding service API keys configured');
    }
  }

  /**
   * Static method to create an embedding service with robust connection handling
   * 
   * @returns Promise resolving to the embedding service and a release function
   */
  public static async createEmbeddingServiceWithRobustConnection(): Promise<{ 
    service: EmbeddingServiceType; 
    releaseConnection: () => Promise<void>;
  }> {
    // Create a new Prisma client
    const prisma = new PrismaClient();
    
    // Create the embedding service
    const service = EmbeddingServiceFactory.createEmbeddingService(prisma);
    
    // Return the service and a release function
    return {
      service,
      releaseConnection: async () => {
        await prisma.$disconnect();
      }
    };
  }
}