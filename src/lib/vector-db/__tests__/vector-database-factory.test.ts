/**
 * Unit tests for VectorDatabaseFactory
 */

import { VectorDatabaseFactory } from '../vector-database-factory';
import { VectorDatabaseInterface } from '../vector-database-interface';
import { VectorDatabaseProvider } from '../vector-types';

// Mock the adapter modules
jest.mock('../postgres-vector-database-adapter', () => ({
  PostgresVectorDatabaseAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  })),
  PostgresVectorDatabaseConfig: jest.fn()
}));

jest.mock('../sqlserver-vector-database-adapter', () => ({
  SqlServerVectorDatabaseAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  })),
  SqlServerVectorDatabaseConfig: jest.fn()
}));

jest.mock('../cosmosdb-vector-database-adapter', () => ({
  CosmosDbVectorDatabaseAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  })),
  CosmosDbVectorDatabaseConfig: jest.fn()
}));

jest.mock('../redis-vector-database-adapter', () => ({
  RedisVectorDatabaseAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  })),
  RedisVectorDatabaseConfig: jest.fn()
}));

describe('VectorDatabaseFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the singleton instance
    (VectorDatabaseFactory as any).instance = null;
    (VectorDatabaseFactory as any).isInitializing = false;
  });

  describe('createAdapter', () => {
    it('should create PostgreSQL adapter when provider is postgres', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const adapter = await VectorDatabaseFactory.create(config);
      
      expect(adapter).toBeDefined();
      expect(adapter.initialize).toBeDefined();
      expect(adapter.isConnected).toBeDefined();
      expect(adapter.close).toBeDefined();
    });

    it('should create SQL Server adapter when provider is sqlserver', async () => {
      const config = {
        provider: VectorDatabaseProvider.SQLSERVER,
        host: 'localhost',
        port: 1433,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const adapter = await VectorDatabaseFactory.create(config);
      
      expect(adapter).toBeDefined();
      expect(adapter.initialize).toBeDefined();
      expect(adapter.isConnected).toBeDefined();
      expect(adapter.close).toBeDefined();
    });

    it('should create Cosmos DB adapter when provider is cosmosdb', async () => {
      const config = {
        provider: VectorDatabaseProvider.COSMOSDB,
        endpoint: 'https://test.documents.azure.com:443/',
        key: 'testkey',
        database: 'testdb',
        container: 'testcontainer'
      };

      const adapter = await VectorDatabaseFactory.create(config);
      
      expect(adapter).toBeDefined();
      expect(adapter.initialize).toBeDefined();
      expect(adapter.isConnected).toBeDefined();
      expect(adapter.close).toBeDefined();
    });

    it('should create Redis adapter when provider is redis', async () => {
      const config = {
        provider: VectorDatabaseProvider.REDIS,
        host: 'localhost',
        port: 6379,
        password: 'testpass',
        database: 0
      };

      const adapter = await VectorDatabaseFactory.create(config);
      
      expect(adapter).toBeDefined();
      expect(adapter.initialize).toBeDefined();
      expect(adapter.isConnected).toBeDefined();
      expect(adapter.close).toBeDefined();
    });

    it('should throw error for unsupported provider', async () => {
      const config = {
        provider: 'unsupported' as VectorDatabaseProvider,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Unsupported vector database provider: unsupported');
    });

    it('should throw error when provider is not specified', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      } as any;

      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Vector database provider must be specified');
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const instance1 = await VectorDatabaseFactory.getInstance(config);
      const instance2 = await VectorDatabaseFactory.getInstance(config);
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance if none exists', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const instance = await VectorDatabaseFactory.getInstance(config);
      
      expect(instance).toBeDefined();
      expect(instance.initialize).toBeDefined();
    });

    it('should wait for initialization if already in progress', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      // Start multiple getInstance calls simultaneously
      const promises = [
        VectorDatabaseFactory.getInstance(config),
        VectorDatabaseFactory.getInstance(config),
        VectorDatabaseFactory.getInstance(config)
      ];

      const instances = await Promise.all(promises);
      
      // All should be the same instance
      expect(instances[0]).toBe(instances[1]);
      expect(instances[1]).toBe(instances[2]);
    });

    it('should throw error if configuration changes', async () => {
      const config1 = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const config2 = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'differentdb',
        user: 'testuser',
        password: 'testpass'
      };

      await VectorDatabaseFactory.getInstance(config1);
      
      await expect(VectorDatabaseFactory.getInstance(config2))
        .rejects.toThrow('Vector database instance already exists with different configuration');
    });
  });

  describe('resetInstance', () => {
    it('should reset singleton instance', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const instance1 = await VectorDatabaseFactory.getInstance(config);
      expect(instance1).toBeDefined();

      VectorDatabaseFactory.resetInstance();

      const instance2 = await VectorDatabaseFactory.getInstance(config);
      expect(instance2).toBeDefined();
      expect(instance2).not.toBe(instance1);
    });

    it('should close existing instance before reset', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const instance = await VectorDatabaseFactory.getInstance(config);
      const closeSpy = jest.spyOn(instance, 'close');
      
      VectorDatabaseFactory.resetInstance();
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('getConfiguration', () => {
    it('should return current configuration', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      await VectorDatabaseFactory.getInstance(config);
      
      const currentConfig = VectorDatabaseFactory.getConfiguration();
      
      expect(currentConfig).toBeDefined();
      expect(currentConfig.provider).toBe(VectorDatabaseProvider.POSTGRES);
      expect(currentConfig.host).toBe('localhost');
      expect(currentConfig.port).toBe(5432);
      expect(currentConfig.database).toBe('testdb');
      expect(currentConfig.user).toBe('testuser');
      expect(currentConfig.password).toBe('testpass');
    });

    it('should return null when no instance exists', () => {
      const config = VectorDatabaseFactory.getConfiguration();
      expect(config).toBeNull();
    });
  });

  describe('isInitialized', () => {
    it('should return true when instance exists', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      await VectorDatabaseFactory.getInstance(config);
      
      expect(VectorDatabaseFactory.isInitialized()).toBe(true);
    });

    it('should return false when no instance exists', () => {
      expect(VectorDatabaseFactory.isInitialized()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle adapter creation errors', async () => {
      const { PostgresVectorDatabaseAdapter } = require('../postgres-vector-database-adapter');
      PostgresVectorDatabaseAdapter.mockImplementationOnce(() => {
        throw new Error('Adapter creation failed');
      });

      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Adapter creation failed');
    });

    it('should handle initialization errors', async () => {
      const { PostgresVectorDatabaseAdapter } = require('../postgres-vector-database-adapter');
      PostgresVectorDatabaseAdapter.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        isConnected: jest.fn().mockResolvedValue(false),
        close: jest.fn().mockResolvedValue(undefined)
      }));

      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Initialization failed');
    });
  });

  describe('environment variable configuration', () => {
    beforeEach(() => {
      // Clear environment variables
      delete process.env.VECTOR_DB_PROVIDER;
      delete process.env.VECTOR_DB_HOST;
      delete process.env.VECTOR_DB_PORT;
      delete process.env.VECTOR_DB_DATABASE;
      delete process.env.VECTOR_DB_USER;
      delete process.env.VECTOR_DB_PASSWORD;
    });

    it('should use environment variables when config is not provided', async () => {
      process.env.VECTOR_DB_PROVIDER = 'postgres';
      process.env.VECTOR_DB_HOST = 'envhost';
      process.env.VECTOR_DB_PORT = '5433';
      process.env.VECTOR_DB_DATABASE = 'envdb';
      process.env.VECTOR_DB_USER = 'envuser';
      process.env.VECTOR_DB_PASSWORD = 'envpass';

      const instance = await VectorDatabaseFactory.getInstance();
      
      expect(instance).toBeDefined();
      
      const config = VectorDatabaseFactory.getConfiguration();
      expect(config?.provider).toBe(VectorDatabaseProvider.POSTGRES);
      expect(config?.host).toBe('envhost');
      expect(config?.port).toBe(5433);
      expect(config?.database).toBe('envdb');
      expect(config?.user).toBe('envuser');
      expect(config?.password).toBe('envpass');
    });

    it('should merge environment variables with provided config', async () => {
      process.env.VECTOR_DB_PROVIDER = 'postgres';
      process.env.VECTOR_DB_HOST = 'envhost';

      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      };

      const instance = await VectorDatabaseFactory.getInstance(config);
      
      expect(instance).toBeDefined();
      
      const currentConfig = VectorDatabaseFactory.getConfiguration();
      expect(currentConfig?.host).toBe('envhost'); // From env
      expect(currentConfig?.port).toBe(5432); // From config
    });

    it('should throw error when required environment variables are missing', async () => {
      process.env.VECTOR_DB_PROVIDER = 'postgres';
      // Missing other required variables

      await expect(VectorDatabaseFactory.getInstance())
        .rejects.toThrow('Missing required environment variables for vector database configuration');
    });
  });
});
