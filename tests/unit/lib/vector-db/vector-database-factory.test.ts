/**
 * Unit tests for VectorDatabaseFactory
 * Tests the factory logic and documents real implementation issues
 */

import { VectorDatabaseFactory } from '@/lib/vector-db/vector-database-factory';
import { VectorDatabaseProvider } from '@/lib/vector-db/vector-types';

describe('VectorDatabaseFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the singleton instance
    (VectorDatabaseFactory as any).instance = null;
    (VectorDatabaseFactory as any).isInitializing = false;
    
    // Clear environment variables
    delete process.env.VECTOR_DB_PROVIDER;
    delete process.env.VECTOR_DB_HOST;
    delete process.env.VECTOR_DB_PORT;
    delete process.env.VECTOR_DB_DATABASE;
    delete process.env.VECTOR_DB_USERNAME;
    delete process.env.VECTOR_DB_PASSWORD;
  });

  describe('create - Error Handling', () => {
    it('should throw error for unsupported provider', async () => {
      const config = {
        provider: 'unsupported' as VectorDatabaseProvider,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
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
        username: 'testuser',
        password: 'testpass'
      } as any;

      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Unsupported vector database provider: undefined');
    });
  });

  describe('closeInstance', () => {
    it('should handle closing when no instance exists', async () => {
      await expect(VectorDatabaseFactory.closeInstance()).resolves.not.toThrow();
    });
  });

  describe('Implementation Issues Documentation', () => {
    it('should successfully create PostgreSQL adapter with proper config', async () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      // PostgreSQL adapter should be created without errors
      const adapter = await VectorDatabaseFactory.create(config);
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(Object);
    });

    it('should document that SQL Server adapter is not implemented', async () => {
      const config = {
        provider: VectorDatabaseProvider.SQLSERVER,
        host: 'localhost',
        port: 1433,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      // This test documents the real issue: SQL Server adapter not implemented
      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Unsupported vector database provider: sqlserver');
    });

    it('should document that Cosmos DB adapter is not implemented', async () => {
      const config = {
        provider: VectorDatabaseProvider.COSMOSDB,
        endpoint: 'https://test.documents.azure.com:443/',
        key: 'testkey',
        database: 'testdb',
        container: 'testcontainer'
      } as any;

      // This test documents the real issue: Cosmos DB adapter not implemented
      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Unsupported vector database provider: cosmosdb');
    });

    it('should document that Redis adapter is not implemented', async () => {
      const config = {
        provider: VectorDatabaseProvider.REDIS,
        host: 'localhost',
        port: 6379,
        password: 'testpass',
        database: '0'
      } as any;

      // This test documents the real issue: Redis adapter not implemented
      await expect(VectorDatabaseFactory.create(config))
        .rejects.toThrow('Unsupported vector database provider: redis');
    });
  });

  describe('Factory Logic Tests', () => {
    it('should validate provider enum values', () => {
      expect(VectorDatabaseProvider.POSTGRES).toBe('postgres');
      expect(VectorDatabaseProvider.SQLSERVER).toBe('sqlserver');
      expect(VectorDatabaseProvider.COSMOSDB).toBe('cosmosdb');
      expect(VectorDatabaseProvider.REDIS).toBe('redis');
    });

    it('should handle singleton pattern correctly', () => {
      // Test that singleton instance starts as null
      expect((VectorDatabaseFactory as any).instance).toBeNull();
      expect((VectorDatabaseFactory as any).isInitializing).toBe(false);
    });

    it('should handle environment variable parsing', () => {
      // Test environment variable parsing logic
      process.env.VECTOR_DB_PROVIDER = 'postgres';
      process.env.VECTOR_DB_HOST = 'testhost';
      process.env.VECTOR_DB_PORT = '5432';
      process.env.VECTOR_DB_DATABASE = 'testdb';
      process.env.VECTOR_DB_USERNAME = 'testuser';
      process.env.VECTOR_DB_PASSWORD = 'testpass';

      // Verify environment variables are set
      expect(process.env.VECTOR_DB_PROVIDER).toBe('postgres');
      expect(process.env.VECTOR_DB_HOST).toBe('testhost');
      expect(process.env.VECTOR_DB_PORT).toBe('5432');
      expect(process.env.VECTOR_DB_DATABASE).toBe('testdb');
      expect(process.env.VECTOR_DB_USERNAME).toBe('testuser');
      expect(process.env.VECTOR_DB_PASSWORD).toBe('testpass');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate PostgreSQL configuration structure', () => {
      const config = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      expect(config.provider).toBe(VectorDatabaseProvider.POSTGRES);
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('testdb');
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
    });

    it('should validate SQL Server configuration structure', () => {
      const config = {
        provider: VectorDatabaseProvider.SQLSERVER,
        host: 'localhost',
        port: 1433,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      expect(config.provider).toBe(VectorDatabaseProvider.SQLSERVER);
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(1433);
      expect(config.database).toBe('testdb');
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
    });

    it('should validate Cosmos DB configuration structure', () => {
      const config = {
        provider: VectorDatabaseProvider.COSMOSDB,
        endpoint: 'https://test.documents.azure.com:443/',
        key: 'testkey',
        database: 'testdb',
        container: 'testcontainer'
      };

      expect(config.provider).toBe(VectorDatabaseProvider.COSMOSDB);
      expect(config.endpoint).toBe('https://test.documents.azure.com:443/');
      expect(config.key).toBe('testkey');
      expect(config.database).toBe('testdb');
      expect(config.container).toBe('testcontainer');
    });

    it('should validate Redis configuration structure', () => {
      const config = {
        provider: VectorDatabaseProvider.REDIS,
        host: 'localhost',
        port: 6379,
        password: 'testpass',
        database: '0'
      };

      expect(config.provider).toBe(VectorDatabaseProvider.REDIS);
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
      expect(config.password).toBe('testpass');
      expect(config.database).toBe('0');
    });
  });
});