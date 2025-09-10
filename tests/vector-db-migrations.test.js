import { jest } from '@jest/globals';
import { Client } from 'pg';
import { DefaultAzureCredential } from '@azure/identity';

// Mock modules
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();
  
  const MockClient = jest.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd
  }));
  
  return { Client: MockClient };
});

jest.mock('@azure/identity', () => {
  return {
    DefaultAzureCredential: jest.fn().mockImplementation(() => ({
      getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
    }))
  };
});

// Import the migration scripts
// Note: We'll need to use require() since they're CommonJS modules
const zeroDowntimeMigration = require('../scripts/vector-db-migrations/zero-downtime-schema-migration.cjs');
const migrateVectorIndex = require('../scripts/vector-db-migrations/migrate-vector-index.ts');

// Test suite for zero-downtime-schema-migration.cjs
describe('Zero Downtime Schema Migration', () => {
  let mockClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock client implementation
    mockClient = new Client();
    
    // Set up common query responses
    mockClient.query.mockImplementation((query, params) => {
      // Mock PG extension check
      if (query.includes('SELECT * FROM pg_extension WHERE extname = \'vector\'')) {
        return Promise.resolve({ rows: [{ extname: 'vector', extversion: '0.4.0' }] });
      }
      
      // Mock column information query
      if (query.includes('FROM information_schema.columns')) {
        return Promise.resolve({
          rows: [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: 'nextval(\'rag_chunks_id_seq\'::regclass)' },
            { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'content', data_type: 'text', is_nullable: 'NO', column_default: null },
            { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
            { column_name: 'metadata', data_type: 'text', is_nullable: 'YES', column_default: null }
          ]
        });
      }
      
      // Mock vector column information
      if (query.includes('data_type = \'USER-DEFINED\' AND udt_name = \'vector\'')) {
        return Promise.resolve({
          rows: [{ column_name: 'embedding' }]
        });
      }
      
      // Mock index information
      if (query.includes('FROM pg_indexes')) {
        return Promise.resolve({
          rows: [
            { 
              indexname: 'rag_chunks_pkey', 
              indexdef: 'CREATE UNIQUE INDEX rag_chunks_pkey ON public.rag_chunks USING btree (id)' 
            },
            { 
              indexname: 'idx_rag_chunks_embedding', 
              indexdef: 'CREATE INDEX idx_rag_chunks_embedding ON public.rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)' 
            }
          ]
        });
      }
      
      // Mock constraint information
      if (query.includes('FROM pg_constraint')) {
        return Promise.resolve({
          rows: [
            { 
              conname: 'rag_chunks_pkey', 
              contype: 'p', 
              def: 'PRIMARY KEY (id)' 
            }
          ]
        });
      }
      
      // Mock other queries
      return Promise.resolve({ rows: [] });
    });
  });
  
  test('getClient returns PostgreSQL client with correct configuration', async () => {
    // Set up environment variables for testing
    process.env.POSTGRES_HOST = 'test-host';
    process.env.POSTGRES_DATABASE = 'test-db';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_USER = 'test-user';
    process.env.POSTGRES_PASSWORD = 'test-password';
    
    // Call getClient function from the module
    const client = await zeroDowntimeMigration.getClient();
    
    // Verify client was created with correct config
    expect(Client).toHaveBeenCalledWith(expect.objectContaining({
      host: 'test-host',
      database: 'test-db',
      port: 5433,
      user: 'test-user',
      password: 'test-password'
    }));
  });
  
  test('getClient uses Azure managed identity when configured', async () => {
    // Set up environment variables for testing
    process.env.USE_MANAGED_IDENTITY = 'true';
    process.env.POSTGRES_HOST = 'test-host.postgres.database.azure.com';
    
    // Call getClient function from the module
    const client = await zeroDowntimeMigration.getClient();
    
    // Verify Azure credential was used
    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(Client).toHaveBeenCalledWith(expect.objectContaining({
      ssl: expect.objectContaining({
        rejectUnauthorized: true
      })
    }));
  });
  
  test('checkPgVectorExtension returns true when extension is installed', async () => {
    const result = await zeroDowntimeMigration.checkPgVectorExtension(mockClient);
    expect(result).toBe(true);
  });
  
  test('createStagingTable generates correct SQL for table creation', async () => {
    process.env.DRY_RUN = 'false';
    
    // Mock the getTableInfo function to return a known result
    mockClient.query.mockImplementation((query) => {
      if (query.includes('FROM information_schema.columns')) {
        return Promise.resolve({
          rows: [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: 'nextval(\'rag_chunks_id_seq\'::regclass)' },
            { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO', column_default: null },
            { column_name: 'content', data_type: 'text', is_nullable: 'NO', column_default: null },
            { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES', column_default: null },
            { column_name: 'metadata', data_type: 'text', is_nullable: 'YES', column_default: null }
          ]
        });
      }
      return Promise.resolve({ rows: [] });
    });
    
    await zeroDowntimeMigration.createStagingTable(mockClient, 'rag_chunks', 'public.rag_chunks_staging');
    
    // Verify SQL was generated and executed
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE public.rag_chunks_staging')
    );
    
    // Check for renamed columns
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('legacy_metadata text')
    );
    
    // Check for added columns
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('metadata_json JSONB')
    );
    
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('last_accessed_at TIMESTAMP WITH TIME ZONE')
    );
  });
  
  test('copyDataToStagingTable generates correct SQL for data migration', async () => {
    process.env.DRY_RUN = 'false';
    
    // Sample table info
    const tableInfo = {
      columns: [
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'content', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES' },
        { column_name: 'metadata', data_type: 'text', is_nullable: 'YES' }
      ]
    };
    
    // Mock count result
    mockClient.query.mockImplementation((query) => {
      if (query.includes('SELECT COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: '1000' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    
    await zeroDowntimeMigration.copyDataToStagingTable(
      mockClient, 
      'public.rag_chunks', 
      'public.rag_chunks_staging', 
      tableInfo
    );
    
    // Check that the query includes all source columns
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.rag_chunks_staging')
    );
    
    // Check for statement timeout
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SET statement_timeout')
    );
    
    // Check for mapping of renamed columns
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringMatching(/metadata.*FROM.*public\.rag_chunks/)
    );
  });
  
  test('swapTables performs table swap in a transaction', async () => {
    process.env.DRY_RUN = 'false';
    
    await zeroDowntimeMigration.swapTables(
      mockClient, 
      'public.rag_chunks', 
      'public.rag_chunks_staging'
    );
    
    // Verify transaction was used
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('LOCK TABLE'));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE public.rag_chunks RENAME TO'));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE public.rag_chunks_staging RENAME TO'));
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });
  
  test('validateMigration checks for expected schema changes', async () => {
    // Mock table info for the migrated table
    mockClient.query.mockImplementation((query) => {
      if (query.includes('FROM information_schema.columns')) {
        return Promise.resolve({
          rows: [
            { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
            { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO' },
            { column_name: 'content', data_type: 'text', is_nullable: 'NO' },
            { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES' },
            { column_name: 'legacy_metadata', data_type: 'text', is_nullable: 'YES' },
            { column_name: 'metadata_json', data_type: 'jsonb', is_nullable: 'YES' },
            { column_name: 'last_accessed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
            { column_name: 'embedding_model', data_type: 'character varying', is_nullable: 'YES' }
          ]
        });
      }
      
      if (query.includes('FROM pg_indexes')) {
        return Promise.resolve({
          rows: [
            { indexname: 'rag_chunks_pkey', indexdef: 'CREATE UNIQUE INDEX rag_chunks_pkey ON public.rag_chunks USING btree (id)' },
            { indexname: 'idx_rag_chunks_embedding', indexdef: 'CREATE INDEX idx_rag_chunks_embedding ON public.rag_chunks USING ivfflat (embedding vector_cosine_ops)' },
            { indexname: 'idx_rag_chunks_last_accessed', indexdef: 'CREATE INDEX idx_rag_chunks_last_accessed ON public.rag_chunks USING btree (last_accessed_at)' },
            { indexname: 'idx_rag_chunks_embedding_model', indexdef: 'CREATE INDEX idx_rag_chunks_embedding_model ON public.rag_chunks USING btree (embedding_model)' }
          ]
        });
      }
      
      return Promise.resolve({ rows: [] });
    });
    
    await zeroDowntimeMigration.validateMigration(mockClient, 'public.rag_chunks');
    
    // We're just testing that it runs without errors
    expect(mockClient.query).toHaveBeenCalled();
  });
});

// Test suite for migrate-vector-index.ts
describe('Vector Index Migration', () => {
  let mockClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock client implementation
    mockClient = new Client();
    
    // Set up common query responses
    mockClient.query.mockImplementation((query, params) => {
      // Mock PG extension check
      if (query.includes('SELECT * FROM pg_extension WHERE extname = \'vector\'')) {
        return Promise.resolve({ rows: [{ extname: 'vector', extversion: '0.4.0' }] });
      }
      
      // Mock index finder query
      if (query.includes('FROM pg_indexes WHERE tablename')) {
        return Promise.resolve({
          rows: [
            { 
              indexname: 'idx_rag_chunks_embedding_ivfflat', 
              indexdef: 'CREATE INDEX idx_rag_chunks_embedding_ivfflat ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)' 
            }
          ]
        });
      }
      
      // Mock index usage stats
      if (query.includes('FROM pg_stat_user_indexes')) {
        return Promise.resolve({
          rows: [
            { 
              idx_scan: 1000, 
              idx_tup_read: 10000, 
              idx_tup_fetch: 5000 
            }
          ]
        });
      }
      
      // Mock other queries
      return Promise.resolve({ rows: [] });
    });
  });
  
  test('findExistingVectorIndexes returns current vector indexes', async () => {
    const indexes = await migrateVectorIndex.findExistingVectorIndexes(mockClient);
    
    expect(indexes).toHaveLength(1);
    expect(indexes[0].indexname).toBe('idx_rag_chunks_embedding_ivfflat');
    expect(indexes[0].indexdef).toContain('USING ivfflat');
  });
  
  test('getIndexTypeFromDefinition correctly identifies index types', () => {
    const hnswDef = 'CREATE INDEX idx_test ON table USING hnsw (col vector_cosine_ops)';
    const ivfflatDef = 'CREATE INDEX idx_test ON table USING ivfflat (col vector_cosine_ops)';
    const unknownDef = 'CREATE INDEX idx_test ON table USING btree (col)';
    
    expect(migrateVectorIndex.getIndexTypeFromDefinition(hnswDef)).toBe('hnsw');
    expect(migrateVectorIndex.getIndexTypeFromDefinition(ivfflatDef)).toBe('ivfflat');
    expect(migrateVectorIndex.getIndexTypeFromDefinition(unknownDef)).toBe('unknown');
  });
  
  test('createShadowIndex generates correct SQL for new index', async () => {
    process.env.DRY_RUN = 'false';
    
    // Set targetIndexType to hnsw
    migrateVectorIndex.config.targetIndexType = 'hnsw';
    
    // Mock the monitoring client
    const mockMonitorClient = new Client();
    mockMonitorClient.connect = jest.fn();
    mockMonitorClient.query = jest.fn().mockResolvedValue({ rows: [] });
    mockMonitorClient.end = jest.fn();
    
    jest.spyOn(migrateVectorIndex, 'getClient').mockResolvedValue(mockMonitorClient);
    
    await migrateVectorIndex.createShadowIndex(mockClient);
    
    // Verify correct SQL was generated
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX CONCURRENTLY')
    );
    
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('USING hnsw')
    );
    
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('vector_cosine_ops')
    );
    
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WITH (m = 16, ef_construction = 64)')
    );
  });
  
  test('swapIndexes performs index rename in a transaction', async () => {
    process.env.DRY_RUN = 'false';
    
    await migrateVectorIndex.swapIndexes(
      mockClient, 
      'idx_old_index',
      'idx_shadow_index'
    );
    
    // Verify transaction was used
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ALTER INDEX idx_old_index RENAME TO'));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ALTER INDEX idx_shadow_index RENAME TO idx_old_index'));
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    
    // Verify old index was dropped
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DROP INDEX'));
  });
});