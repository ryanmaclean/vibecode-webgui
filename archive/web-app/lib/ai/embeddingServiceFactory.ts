/**
 * Embedding Service Factory
 * Creates and manages different embedding service providers
 */

import { PrismaClient } from '@prisma/client';
import { AzureEmbeddingService } from './azure-embedding-service';
import { EmbeddingService } from './embeddingService';
import { OpenRouterBYOKEmbeddingService } from './openrouter-byok-embedding-service';

// Supported embedding providers
export enum EmbeddingProvider {
  AZURE = 'azure',
  OPENAI = 'openai',
  OPENROUTER_BYOK = 'openrouter-byok',
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
  useConnectionPool?: boolean;
  // BYOK specific
  openrouterApiKey?: string;
  openaiApiKey?: string;
  isFallbackToDirect?: boolean;
}

// Type to handle all embedding service types
export type EmbeddingServiceType = AzureEmbeddingService | EmbeddingService | OpenRouterBYOKEmbeddingService;

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
        // Validate Azure configuration
        if (!config.apiKey || !config.endpoint || !config.deploymentName) {
          throw new Error('Azure OpenAI configuration requires apiKey, endpoint, and deploymentName');
        }

        // Create Azure embedding service config
        const azureConfig = {
          apiKey: config.apiKey,
          endpoint: config.endpoint,
          deploymentName: config.deploymentName,
          apiVersion: config.apiVersion || '2023-05-15',
          dimensions: config.dimensions || 1536
        };

        return new AzureEmbeddingService(azureConfig);
        
      case EmbeddingProvider.OPENAI:
        if (!config.apiKey) {
          throw new Error('OpenAI embedding provider requires apiKey');
        }
        
        return new EmbeddingService(
          config.apiKey,
          config.model || 'text-embedding-3-small',
          this.prisma
        );

      case EmbeddingProvider.OPENROUTER_BYOK:
        if (!config.openrouterApiKey || !config.openaiApiKey) {
          throw new Error('OpenRouter BYOK provider requires both openrouterApiKey and openaiApiKey');
        }

        return new OpenRouterBYOKEmbeddingService({
          openrouterApiKey: config.openrouterApiKey,
          openaiApiKey: config.openaiApiKey,
          model: config.model || 'openai/text-embedding-3-small',
          fallbackToDirect: config.isFallbackToDirect
        }, this.prisma);
        
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
    // Check for OpenRouter BYOK configuration first (preferred)
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
    const isFallbackToDirect = process.env.EMBEDDING_FALLBACK_TO_DIRECT === 'true';
    
    if (openrouterApiKey && openaiApiKey) {
      return this.createEmbeddingService({
        provider: EmbeddingProvider.OPENROUTER_BYOK,
        openrouterApiKey,
        openaiApiKey,
        model: embeddingModel,
        isFallbackToDirect
      });
    }
    
    // Check for Azure OpenAI configuration
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';
    const useAzureManagedIdentity = process.env.USE_AZURE_MANAGED_IDENTITY === 'true';
    const useConnectionPool = process.env.USE_CONNECTION_POOL === 'true';
    
    if (azureEndpoint && azureDeploymentName) {
      if (useAzureManagedIdentity) {
        return this.createEmbeddingService({
          provider: EmbeddingProvider.AZURE,
          endpoint: azureEndpoint,
          deploymentName: azureDeploymentName,
          apiVersion: azureApiVersion,
          useManagedIdentity: true,
          useConnectionPool
        });
      } else if (azureApiKey) {
        return this.createEmbeddingService({
          provider: EmbeddingProvider.AZURE,
          apiKey: azureApiKey,
          endpoint: azureEndpoint,
          deploymentName: azureDeploymentName,
          apiVersion: azureApiVersion,
          useConnectionPool
        });
      }
    }
    
    // Check for direct OpenAI configuration
    if (openaiApiKey) {
      const openaiModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      
      return this.createEmbeddingService({
        provider: EmbeddingProvider.OPENAI,
        apiKey: openaiApiKey,
        model: openaiModel
      });
    }
    
    throw new Error('No valid embedding service configuration found in environment variables. Required: OPENAI_API_KEY and optionally OPENROUTER_API_KEY for BYOK');
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
   * @param useConnectionPool - Whether to use connection pooling (defaults to environment variable)
   * @returns Promise resolving to the embedding service and a release function
   */
  public static async createEmbeddingServiceWithRobustConnection(useConnectionPool?: boolean): Promise<{ 
    service: EmbeddingServiceType; 
    releaseConnection: () => Promise<void>;
  }> {
    // Check if connection pooling should be used
    const usePool = useConnectionPool ?? (process.env.USE_CONNECTION_POOL === 'true');
    
    if (usePool) {
      // No need to create a Prisma client when using connection pool
      // Create service using environment variables and connection pool
      const factory = new EmbeddingServiceFactory(new PrismaClient());
      
      // Get existing environment variables
      const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
      const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';
      const useManagedIdentity = process.env.USE_AZURE_MANAGED_IDENTITY === 'true';
      
      // Ensure the Azure configuration exists
      if (!azureEndpoint || !azureDeploymentName) {
        throw new Error('Azure OpenAI configuration required for connection pooling');
      }
      
      // Create service with connection pooling
      const service = factory.createEmbeddingService({
        provider: EmbeddingProvider.AZURE,
        apiKey: azureApiKey || '',
        endpoint: azureEndpoint,
        deploymentName: azureDeploymentName,
        apiVersion: azureApiVersion
      });
      
      // Return service with a no-op release function (pool handles connections)
      return {
        service,
        releaseConnection: async () => {
          // No individual connection to release when using pool
        }
      };
    } else {
      // Traditional direct Prisma client
      const prisma = new PrismaClient();
      
      // Create the embedding service
      const factory = new EmbeddingServiceFactory(prisma);
      const service = factory.createEmbeddingService({
        provider: EmbeddingProvider.AZURE,
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-05-15'
      });
      
      // Return the service and a release function
      return {
        service,
        releaseConnection: async () => {
          await prisma.$disconnect();
        }
      };
    }
  }
}