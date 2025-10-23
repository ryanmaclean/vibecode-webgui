/**
 * Simplified Vector Database Factory
 * Currently supports the PostgreSQL adapter, with graceful fallbacks for
 * providers that aren't yet configured in this environment.
 */

import { VectorDatabaseInterface } from './vector-database-interface';
import {
  VectorDatabaseConfig,
  VectorDatabaseProvider,
} from './vector-types';
import {
  PostgresVectorDatabaseAdapter,
  PostgresVectorDatabaseConfig,
} from './postgres-vector-database-adapter';
import { logger } from '@/lib/logger';

export class VectorDatabaseFactory {
  private static instance: VectorDatabaseInterface | null = null;
  private static initializing = false;

  /**
   * Create a vector database adapter based on configuration.
   * Only PostgreSQL is currently supported; other providers throw a clear error.
   */
  static async create(config: VectorDatabaseConfig): Promise<VectorDatabaseInterface> {
    switch (config.provider) {
      case VectorDatabaseProvider.POSTGRES:
        return new PostgresVectorDatabaseAdapter(config as PostgresVectorDatabaseConfig);
      default:
        logger.warn('Unsupported vector database provider requested', {
          provider: config.provider,
        });
        throw new Error(`Unsupported vector database provider: ${config.provider}`);
    }
  }

  /**
   * Return the singleton instance, creating it from environment variables on first access.
   */
  static async getInstance(): Promise<VectorDatabaseInterface> {
    if (VectorDatabaseFactory.instance) {
      return VectorDatabaseFactory.instance;
    }

    if (VectorDatabaseFactory.initializing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return VectorDatabaseFactory.getInstance();
    }

    try {
      VectorDatabaseFactory.initializing = true;

      const provider = VectorDatabaseFactory.resolveProvider();
      const config: VectorDatabaseConfig = {
        provider,
        connectionString: process.env.VECTOR_DB_CONNECTION_STRING,
        host: process.env.VECTOR_DB_HOST,
        port: process.env.VECTOR_DB_PORT ? parseInt(process.env.VECTOR_DB_PORT, 10) : undefined,
        username: process.env.VECTOR_DB_USERNAME,
        password: process.env.VECTOR_DB_PASSWORD,
        database: process.env.VECTOR_DB_DATABASE,
        cacheEnabled: process.env.VECTOR_DB_CACHE_ENABLED !== 'false',
        enableMetrics: process.env.VECTOR_DB_METRICS_ENABLED !== 'false',
        enableLogging: process.env.VECTOR_DB_LOGGING_ENABLED !== 'false',
      };

      VectorDatabaseFactory.instance = await VectorDatabaseFactory.create(config);
      await VectorDatabaseFactory.instance.initialize();
      return VectorDatabaseFactory.instance;
    } finally {
      VectorDatabaseFactory.initializing = false;
    }
  }

  /**
   * Close and reset the singleton instance.
   */
  static async closeInstance(): Promise<void> {
    if (VectorDatabaseFactory.instance) {
      await VectorDatabaseFactory.instance.close();
      VectorDatabaseFactory.instance = null;
    }
  }

  private static resolveProvider(): VectorDatabaseProvider {
    const providerStr = (process.env.VECTOR_DB_PROVIDER || 'postgres').toLowerCase();
    switch (providerStr) {
      case 'postgres':
      case 'postgresql':
        return VectorDatabaseProvider.POSTGRES;
      default:
        logger.warn('Falling back to PostgreSQL vector provider', { provider: providerStr });
        return VectorDatabaseProvider.POSTGRES;
    }
  }
}

export default VectorDatabaseFactory;
