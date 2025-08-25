/**
 * Vector Database Factory
 * Creates and configures the appropriate vector database adapter based on configuration
 */

import { VectorDatabaseInterface } from './vector-database-interface';
import { VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { PostgresVectorDatabaseAdapter, PostgresVectorDatabaseConfig } from './postgres-vector-database-adapter';
import { SqlServerVectorDatabaseAdapter, SqlServerVectorDatabaseConfig } from './sqlserver-vector-database-adapter';
import { CosmosDbVectorDatabaseAdapter, CosmosDbVectorDatabaseConfig } from './cosmosdb-vector-database-adapter';
import { RedisVectorDatabaseAdapter, RedisVectorDatabaseConfig } from './redis-vector-database-adapter';
import { CognitiveSearchVectorDatabaseAdapter, CognitiveSearchVectorDatabaseConfig } from './cognitive-search-vector-database-adapter';

/**
 * Factory class for creating vector database adapters
 */
export class VectorDatabaseFactory {
  private static instance: VectorDatabaseInterface | null = null;
  private static isInitializing = false;

  /**
   * Create a vector database adapter based on configuration
   * @param config Vector database configuration
   * @returns Initialized vector database adapter
   */
  public static async create(config: VectorDatabaseConfig): Promise<VectorDatabaseInterface> {
    try {
      let adapter: VectorDatabaseInterface;

      switch (config.provider) {
        case VectorDatabaseProvider.POSTGRES:
          adapter = new PostgresVectorDatabaseAdapter(config as PostgresVectorDatabaseConfig);
          break;

        case VectorDatabaseProvider.SQLSERVER:
          adapter = new SqlServerVectorDatabaseAdapter(config as SqlServerVectorDatabaseConfig);
          break;

        case VectorDatabaseProvider.COSMOSDB:
          adapter = new CosmosDbVectorDatabaseAdapter(config as CosmosDbVectorDatabaseConfig);
          break;

        case VectorDatabaseProvider.REDIS:
          adapter = new RedisVectorDatabaseAdapter(config as RedisVectorDatabaseConfig);
          break;

        case VectorDatabaseProvider.COGNITIVE_SEARCH:
          adapter = new CognitiveSearchVectorDatabaseAdapter(config as CognitiveSearchVectorDatabaseConfig);
          break;

        default:
          throw new Error(`Unsupported vector database provider: ${config.provider}`);
      }

      // Initialize the adapter
      await adapter.initialize();

      return adapter;
    } catch (error) {
      console.error(`Failed to create vector database adapter: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get the singleton instance of the vector database adapter
   * Creates it if it doesn't exist using environment variables
   * @returns Initialized vector database adapter
   */
  public static async getInstance(): Promise<VectorDatabaseInterface> {
    if (VectorDatabaseFactory.instance) {
      return VectorDatabaseFactory.instance;
    }

    if (VectorDatabaseFactory.isInitializing) {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getInstance();
    }

    try {
      VectorDatabaseFactory.isInitializing = true;
      
      // Get provider from environment variable or default to PostgreSQL
      const providerStr = process.env.VECTOR_DB_PROVIDER || 'postgres';
      let provider: VectorDatabaseProvider;

      // Map string to provider enum
      switch (providerStr.toLowerCase()) {
        case 'postgres':
        case 'postgresql':
          provider = VectorDatabaseProvider.POSTGRES;
          break;
        case 'sqlserver':
        case 'mssql':
          provider = VectorDatabaseProvider.SQLSERVER;
          break;
        case 'cosmosdb':
        case 'cosmos':
          provider = VectorDatabaseProvider.COSMOSDB;
          break;
        case 'redis':
        case 'valkey':
          provider = VectorDatabaseProvider.REDIS;
          break;
        case 'cognitive_search':
        case 'azure_search':
        case 'azure_cognitive_search':
          provider = VectorDatabaseProvider.COGNITIVE_SEARCH;
          break;
        default:
          provider = VectorDatabaseProvider.POSTGRES;
      }

      // Create base configuration from environment variables
      const config: VectorDatabaseConfig = {
        provider,
        connectionString: process.env.VECTOR_DB_CONNECTION_STRING,
        host: process.env.VECTOR_DB_HOST,
        port: process.env.VECTOR_DB_PORT ? parseInt(process.env.VECTOR_DB_PORT) : undefined,
        username: process.env.VECTOR_DB_USERNAME,
        password: process.env.VECTOR_DB_PASSWORD,
        database: process.env.VECTOR_DB_DATABASE,
        cacheEnabled: process.env.VECTOR_DB_CACHE_ENABLED !== 'false',
        enableMetrics: process.env.VECTOR_DB_METRICS_ENABLED !== 'false',
        enableLogging: process.env.VECTOR_DB_LOGGING_ENABLED !== 'false',
      };

      // Create the appropriate adapter
      VectorDatabaseFactory.instance = await VectorDatabaseFactory.create(config);
      
      return VectorDatabaseFactory.instance;
    } catch (error) {
      VectorDatabaseFactory.isInitializing = false;
      console.error(`Failed to initialize vector database adapter: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      VectorDatabaseFactory.isInitializing = false;
    }
  }

  /**
   * Close the singleton instance if it exists
   */
  public static async closeInstance(): Promise<void> {
    if (VectorDatabaseFactory.instance) {
      await VectorDatabaseFactory.instance.close();
      VectorDatabaseFactory.instance = null;
    }
  }
}