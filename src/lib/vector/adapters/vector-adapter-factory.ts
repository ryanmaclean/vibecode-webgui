/**
 * Vector Adapter Factory
 * Creates the appropriate adapters based on configuration
 */

import { 
IVectorDatabaseAdapter,
  IVectorEmbeddingProvider, 
  IVectorCacheAdapter,
  VectorDatabaseConfig,
  VectorCacheConfig
} from '../interfaces/index';
import { PostgreSQLVectorAdapter } from './postgresql-vector-adapter';
import { SQLServerVectorAdapter } from './sqlserver-vector-adapter';
import { CosmosDBVectorAdapter } from './cosmosdb-vector-adapter';
import { RedisVectorAdapter } from './redis-vector-adapter';
import { OpenAIEmbeddingProvider } from './openai-embedding-provider';
import { AzureEmbeddingProvider } from './azure-embedding-provider';
import { RedisVectorCacheAdapter } from './redis-vector-cache-adapter';
// import { logger } from '@/lib/logger';
export class VectorAdapterFactory {
  /**
   * Create a vector database adapter based on configuration
   */
  static createDatabaseAdapter(
    config: VectorDatabaseConfig,
    embeddingProvider: IVectorEmbeddingProvider,
    cacheAdapter?: IVectorCacheAdapter
  ): IVectorDatabaseAdapter {
    switch (config.provider) {
      case 'pgvector':
        return new PostgreSQLVectorAdapter(config, embeddingProvider, cacheAdapter);
        
      case 'sqlserver':
        return new SQLServerVectorAdapter(config, embeddingProvider, cacheAdapter);
        
      case 'cosmosdb':
        return new CosmosDBVectorAdapter(config, embeddingProvider, cacheAdapter);
        
      case 'redis':
        return new RedisVectorAdapter(config, embeddingProvider, cacheAdapter);
        
      default:
        return new PostgreSQLVectorAdapter(config, embeddingProvider, cacheAdapter);
    }
  }

  /**
   * Create an embedding provider based on configuration
   */
  static createEmbeddingProvider(config: VectorDatabaseConfig): IVectorEmbeddingProvider {
    const { provider, apiKey, model, dimension, options } = config.embedding;
    
    switch (provider) {
      case 'openai':
        return new OpenAIEmbeddingProvider(
          apiKey || process.env.OPENAI_API_KEY || '',
          model || 'text-embedding-3-small',
          dimension || 1536,
          options || {}
        );
        
      case 'azure':
        // Get Azure OpenAI endpoint and deployment name from environment or config
        const azureEndpoint = options?.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '';
        const azureDeployment = options?.deploymentName || process.env.AZURE_OPENAI_DEPLOYMENT || '';
        
        return new AzureEmbeddingProvider(
          apiKey || process.env.AZURE_OPENAI_API_KEY || '',
          azureEndpoint,
          azureDeployment,
          model || 'text-embedding-ada-002',
          dimension || 1536,
          options || {}
        );
        
      case 'local':
        // Local embedding provider would be created here
        // For now, fallback to OpenAI
        console.warn('Local embedding provider not implemented yet. Using OpenAI provider as fallback.');
        return new OpenAIEmbeddingProvider(
          apiKey || process.env.OPENAI_API_KEY || '',
          model || 'text-embedding-3-small',
          dimension || 1536,
          options || {}
        );
        
      default:
        return new OpenAIEmbeddingProvider(
          apiKey || process.env.OPENAI_API_KEY || '',
          model || 'text-embedding-3-small',
          dimension || 1536,
          options || {}
        );
    }
  }

  /**
   * Create a cache adapter based on configuration
   */
  static createCacheAdapter(cacheConfig?: VectorCacheConfig): IVectorCacheAdapter | undefined {
    if (!cacheConfig || !cacheConfig.enabled) {
      return undefined;
    }
    
    switch (cacheConfig.provider) {
      case 'redis':
      case 'valkey':
        return new RedisVectorCacheAdapter(
          cacheConfig.connectionString,
          cacheConfig.ttl || { default: 3600, min: 60, max: 86400 },
          cacheConfig.options || {}
        );
        
      case 'azurecache':
        // Azure Cache adapter would be created here
        // For now, fallback to Redis
        console.warn('Azure Cache adapter not implemented yet. Using Redis adapter as fallback.');
        return new RedisVectorCacheAdapter(
          cacheConfig.connectionString,
          cacheConfig.ttl || { default: 3600, min: 60, max: 86400 },
          cacheConfig.options || {}
        );
        
      case 'memory':
        // Memory cache adapter would be created here
        // For now, fallback to Redis with local connection
        console.warn('Memory cache adapter not implemented yet. Using Redis adapter as fallback.');
        return new RedisVectorCacheAdapter(
          undefined,
          cacheConfig.ttl || { default: 3600, min: 60, max: 86400 },
          cacheConfig.options || {}
        );
        
      default:
        return new RedisVectorCacheAdapter(
          cacheConfig.connectionString,
          cacheConfig.ttl || { default: 3600, min: 60, max: 86400 },
          cacheConfig.options || {}
        );
    }
  }

  /**
   * Create a complete vector database setup with all needed components
   */
  static createVectorDatabase(config: VectorDatabaseConfig): IVectorDatabaseAdapter {
    // Create components in the right order
    const embeddingProvider = this.createEmbeddingProvider(config);
    const cacheAdapter = this.createCacheAdapter(config.cache);
    const databaseAdapter = this.createDatabaseAdapter(config, embeddingProvider, cacheAdapter);
    
    // Initialize connection
    databaseAdapter.connect().catch((err: Error) => {
      console.error('Failed to connect to vector database:', err);
    });
    
    return databaseAdapter;
  }
}