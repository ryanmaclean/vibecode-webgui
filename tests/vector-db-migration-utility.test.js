/**
 * Unit tests for Vector Database Migration Utility
 * 
 * These tests cover:
 * 1. Migration utility functionality
 * 2. Rollback mechanisms
 * 3. Edge cases like partial migrations
 * 4. Performance with large datasets
 */

import { jest } from '@jest/globals';
import { Client } from 'pg';

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

// Mock for process.env
const originalEnv = process.env;

describe('Vector DB Migration Utility', () => {
  let mockClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset process.env
    process.env = { ...originalEnv };
    
    // Mock client implementation
    mockClient = new Client();
    // Ensure methods are jest fns even if import order prevented jest.mock from patching
    if (!mockClient || typeof mockClient.query !== 'function' || !mockClient.query.mock) {
      mockClient.query = jest.fn();
    }
    if (typeof mockClient.connect !== 'function' || !mockClient.connect.mock) {
      mockClient.connect = jest.fn();
    }
    if (typeof mockClient.end !== 'function' || !mockClient.end.mock) {
      mockClient.end = jest.fn();
    }
    
    // Set up common query responses
    mockClient.query.mockImplementation((query) => {
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
      
      // Mock row count queries
      if (query.includes('SELECT COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: '1000' }] });
      }
      
      // Mock other queries
      return Promise.resolve({ rows: [] });
    });
  });
  
  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
  });

  /**
   * Test suite for testing various migration scenarios
   */
  describe('Migration execution tests', () => {
    test('should handle empty table gracefully', async () => {
      // Override mock for empty table
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FROM information_schema.columns')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('SELECT COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Run migration function with empty table
      await zeroDowntimeMigration.createStagingTable(mockClient, 'empty_table', 'empty_table_staging');
      await zeroDowntimeMigration.copyDataToStagingTable(
        mockClient, 
        'public.empty_table', 
        'public.empty_table_staging',
        { columns: [] }
      );
      
      // Verify it runs without errors
      expect(mockClient.query).toHaveBeenCalled();
    });
    
    test('should create staging table with correct schema', async () => {
      process.env.DRY_RUN = 'false';
      
      // Run the createStagingTable function
      await zeroDowntimeMigration.createStagingTable(mockClient, 'rag_chunks', 'public.rag_chunks_staging');
      
      // Check for correct column transformations
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
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding_model VARCHAR(100)')
      );
    });
    
    test('should copy data with column mapping for renamed columns', async () => {
      process.env.DRY_RUN = 'false';
      
      // Sample table info with renamed column
      const tableInfo = {
        columns: [
          { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
          { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO' },
          { column_name: 'content', data_type: 'text', is_nullable: 'NO' },
          { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES' },
          { column_name: 'metadata', data_type: 'text', is_nullable: 'YES' }
        ]
      };
      
      // Run the copyDataToStagingTable function
      await zeroDowntimeMigration.copyDataToStagingTable(
        mockClient, 
        'public.rag_chunks', 
        'public.rag_chunks_staging', 
        tableInfo
      );
      
      // Check for correct SQL with column mapping (search across calls)
      const calls1 = mockClient.query.mock.calls.map(c => c[0] || '');
      expect(calls1.some(sql => /INSERT INTO[\s\S]*legacy_metadata[\s\S]*SELECT[\s\S]*metadata/i.test(sql))).toBe(true);
    });
    
    test('should create vector indexes on staging table', async () => {
      process.env.DRY_RUN = 'false';
      
      // Sample table info with vector column
      const tableInfo = {
        columns: [
          { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES' }
        ],
        vectorColumns: ['embedding'],
        indexes: [
          { 
            indexname: 'idx_rag_chunks_embedding', 
            indexdef: 'CREATE INDEX idx_rag_chunks_embedding ON public.rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)' 
          }
        ]
      };
      
      // Run the createIndexesOnStagingTable function
      await zeroDowntimeMigration.createIndexesOnStagingTable(
        mockClient, 
        'public.rag_chunks_staging', 
        tableInfo
      );
      
      // Check for vector index creation
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE INDEX idx_rag_chunks_embedding_staging.*vector_cosine_ops/i)
      );
    });
  });
  
  /**
   * Test suite focusing on rollback functionality
   */
  describe('Rollback functionality', () => {
    test('should rollback transaction on error during table swap', async () => {
      process.env.DRY_RUN = 'false';
      
      // Mock query to throw an error during table swap
      mockClient.query.mockImplementation((query) => {
        if (query.includes('ALTER TABLE public.rag_chunks RENAME TO')) {
          return Promise.reject(new Error('Simulated error during rename'));
        }
        
        if (query === 'ROLLBACK') {
          return Promise.resolve();
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Expect the function to throw an error
      await expect(
        zeroDowntimeMigration.swapTables(mockClient, 'public.rag_chunks', 'public.rag_chunks_staging')
      ).rejects.toThrow('Simulated error during rename');
      
      // Verify rollback was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
    
    test('should maintain original table on migration failure', async () => {
      // We'll implement this by mocking migrateTableSchema and checking that
      // the original table is not renamed if an error occurs during migration
      
      // Mock dependencies
      const createStagingTableSpy = jest.spyOn(zeroDowntimeMigration, 'createStagingTable')
        .mockImplementation(() => Promise.resolve({}));
      
      const copyDataSpy = jest.spyOn(zeroDowntimeMigration, 'copyDataToStagingTable')
        .mockImplementation(() => Promise.reject(new Error('Data copy error')));
      
      const swapTablesSpy = jest.spyOn(zeroDowntimeMigration, 'swapTables')
        .mockImplementation(() => Promise.resolve('backup_table'));
      
      // Mock console.error to prevent test output noise
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Mock process.exit to prevent test from exiting
      const originalProcessExit = process.exit;
      process.exit = jest.fn();
      
      // Run the migration
      await zeroDowntimeMigration.migrateTableSchema();
      
      // Verify failure surfaced and swap was not attempted
      expect(swapTablesSpy).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
      
      // Restore mocks
      createStagingTableSpy.mockRestore();
      copyDataSpy.mockRestore();
      swapTablesSpy.mockRestore();
      console.error = originalConsoleError;
      process.exit = originalProcessExit;
    });
  });
  
/**
 * Test suite for vector index migration
 */
describe('Vector Index Migration', () => {
  let mockClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock client implementation
    mockClient = new Client();
    if (!mockClient || typeof mockClient.query !== 'function' || !mockClient.query.mock) {
      mockClient.query = jest.fn();
    }
    if (typeof mockClient.connect !== 'function' || !mockClient.connect.mock) {
      mockClient.connect = jest.fn();
    }
    if (typeof mockClient.end !== 'function' || !mockClient.end.mock) {
      mockClient.end = jest.fn();
    }
    
    // Set up common query responses
    mockClient.query.mockImplementation((query) => {
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
    
    expect(indexes.length).toBeGreaterThan(0);
    expect(indexes.some(i => i.indexdef.includes('USING ivfflat'))).toBe(true);
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
      expect.stringContaining('CREATE INDEX')
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
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ALTER INDEX idx_shadow_index RENAME TO'));
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    
    // Verify old index was dropped
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DROP INDEX'));
  });
});

/**
 * Test suite for edge cases
 */
describe('Edge cases', () => {
    test('should handle very large column values', async () => {
      // Override mock for table with large text column
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FROM information_schema.columns')) {
          return Promise.resolve({
            rows: [
              { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: 'nextval(\'rag_chunks_id_seq\'::regclass)' },
              { column_name: 'large_content', data_type: 'text', is_nullable: 'NO', column_default: null }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Run migration function
      await zeroDowntimeMigration.createStagingTable(mockClient, 'large_content_table', 'large_content_table_staging');
      
      // Verify it handles large columns without issues (search across calls, case-insensitive)
      const calls2 = mockClient.query.mock.calls.map(c => String(c[0] || ''));
      expect(calls2.some(sql => /large_content\s+text\s+not\s+null/i.test(sql))).toBe(true);
    });
    
    test('should handle tables with no primary key', async () => {
      // Override mock for table with no primary key
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FROM pg_constraint')) {
          return Promise.resolve({ rows: [] }); // No constraints
        }
        if (query.includes('FROM pg_indexes')) {
          return Promise.resolve({
            rows: [
              { 
                indexname: 'idx_no_pk_table', 
                indexdef: 'CREATE INDEX idx_no_pk_table ON public.no_pk_table USING btree (id)' 
              }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Run migration function
      const tableInfo = await zeroDowntimeMigration.getTableInfo(mockClient, 'no_pk_table');
      
      // Verify no primary key was found
      expect(tableInfo.constraints.length).toBe(0);
    });
    
    test('should handle column with custom data types', async () => {
      // Override mock for table with custom data types
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FROM information_schema.columns')) {
          return Promise.resolve({
            rows: [
              { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
              { column_name: 'json_data', data_type: 'jsonb', is_nullable: 'YES' },
              { column_name: 'geo_data', data_type: 'USER-DEFINED', is_nullable: 'YES' },
              { column_name: 'custom_enum', data_type: 'USER-DEFINED', is_nullable: 'NO' }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Run migration function
      await zeroDowntimeMigration.createStagingTable(mockClient, 'custom_types_table', 'custom_types_staging');
      
      // Verify it handles custom types correctly (search across calls, case-insensitive)
      const calls3 = mockClient.query.mock.calls.map(c => String(c[0] || ''));
      expect(calls3.some(sql => /geo_data\s+user-defined/i.test(sql))).toBe(true);
      expect(calls3.some(sql => /custom_enum\s+user-defined\s+not\s+null/i.test(sql))).toBe(true);
    });
  });
  
  /**
   * Test suite for performance with large datasets
   */
  describe('Performance with large datasets', () => {
    test('should set appropriate timeouts for large data copies', async () => {
      process.env.DRY_RUN = 'false';
      process.env.STATEMENT_TIMEOUT = '300s';
      
      // Sample table info
      const tableInfo = {
        columns: [
          { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
          { column_name: 'content', data_type: 'text', is_nullable: 'NO' }
        ]
      };
      
      // Run the copyDataToStagingTable function
      await zeroDowntimeMigration.copyDataToStagingTable(
        mockClient, 
        'public.large_table', 
        'public.large_table_staging', 
        tableInfo
      );
      
      // Check for appropriate timeout setting (search across calls, case-insensitive)
      const calls4 = mockClient.query.mock.calls.map(c => String(c[0] || ''));
      expect(calls4.some(sql => /set\s+statement_timeout\s*=\s*'300s'/i.test(sql))).toBe(true);
    });
    
    test('should handle large row counts in status reporting', async () => {
      process.env.DRY_RUN = 'false';
      
      // Override mock for large row count
      mockClient.query.mockImplementation((query) => {
        if (query.includes('SELECT COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: '10000000' }] }); // 10 million rows
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Sample table info
      const tableInfo = {
        columns: [
          { column_name: 'id', data_type: 'integer', is_nullable: 'NO' }
        ]
      };
      
      // Create a spy on console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Run the copyDataToStagingTable function
      await zeroDowntimeMigration.copyDataToStagingTable(
        mockClient, 
        'public.large_table', 
        'public.large_table_staging', 
        tableInfo
      );
      
      // Check that the large row count was reported correctly (search across calls)
      const consoleCalls = consoleSpy.mock.calls.map(c => (c?.[0] ?? '') + '');
      expect(consoleCalls.some(msg => /Copied\s+10000000\s+rows/i.test(msg))).toBe(true);
      
      // Restore console.log
      consoleSpy.mockRestore();
    });
  });
  
  /**
   * Test suite for utilities and helper functions
   */
  describe('Utility functions', () => {
    test('validateMigration should detect missing columns', async () => {
      // Override mock for validation failure
      mockClient.query.mockImplementation((query) => {
        if (query.includes('FROM information_schema.columns')) {
          return Promise.resolve({
            rows: [
              { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
              { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO' },
              { column_name: 'content', data_type: 'text', is_nullable: 'NO' },
              { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES' },
              // Missing metadata_json column!
              { column_name: 'legacy_metadata', data_type: 'text', is_nullable: 'YES' },
              { column_name: 'last_accessed_at', data_type: 'timestamp with time zone', is_nullable: 'YES' }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Create a spy on console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Run validation
      await zeroDowntimeMigration.validateMigration(mockClient, 'public.rag_chunks');
      
      // Check that the missing column was detected
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Column metadata_json: ❌')
      );
      
      // Restore console.log
      consoleSpy.mockRestore();
    });
    
    test('getTableInfo should return complete table structure', async () => {
      const tableInfo = await zeroDowntimeMigration.getTableInfo(mockClient, 'rag_chunks');
      
      // Verify structure is complete
      expect(tableInfo).toHaveProperty('columns');
      expect(tableInfo).toHaveProperty('indexes');
      expect(tableInfo).toHaveProperty('constraints');
      expect(tableInfo).toHaveProperty('vectorColumns');
      
      // Verify data
      expect(tableInfo.vectorColumns).toContain('embedding');
      expect(tableInfo.columns.length).toBeGreaterThan(0);
      expect(tableInfo.indexes.length).toBeGreaterThan(0);
    });

    test('analyzeIndex should issue ANALYZE for target table', async () => {
      // Arrange
      const analyzeSpy = jest.spyOn(mockClient, 'query');
      // Act
      await migrateVectorIndex.analyzeIndex(mockClient, 'idx_test_index');
      // Assert
      expect(analyzeSpy).toHaveBeenCalledWith(expect.stringContaining('ANALYZE'));
    });

    test('setSearchPath should set schema when tableName contains schema', async () => {
      migrateVectorIndex.config.tableName = 'public.some_table';
      const spy = jest.spyOn(mockClient, 'query');
      await migrateVectorIndex.setSearchPath(mockClient);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('SET search_path TO public'));
    });

    test('findExistingVectorIndexes returns empty when no matching vector indexes', async () => {
      mockClient.query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
      migrateVectorIndex.config.tableName = 'nonexistent_table';
      const rows = await migrateVectorIndex.findExistingVectorIndexes(mockClient);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(0);
    });
  });
});