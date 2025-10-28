/**
 * Unit tests for Vector Data Migration utility
 * 
 * These tests cover:
 * 1. Batch processing for large datasets
 * 2. Rollback functionality for failed migrations
 * 3. Vector index creation after migration
 * 4. Data integrity validation
 */

import { jest } from '@jest/globals';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Mock modules
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();
  const mockRelease = jest.fn();
  
  const MockClient = jest.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    release: mockRelease
  }));
  
  const MockPool = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: mockQuery,
      release: mockRelease
    }),
    end: jest.fn().mockResolvedValue(undefined)
  }));
  
  return { 
    Client: MockClient,
    Pool: MockPool
  };
});

jest.mock('datadog-metrics', () => {
  return {
    dog: {
      init: jest.fn(),
      gauge: jest.fn(),
      increment: jest.fn(),
      histogram: jest.fn(),
      flush: jest.fn()
    }
  };
});

jest.mock('fs', () => {
  return {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn().mockReturnValue({
      write: jest.fn(),
      end: jest.fn()
    })
  };
});

// Mock path
jest.mock('path', () => {
  return {
    join: jest.fn().mockImplementation((...args) => args.join('/'))
  };
});

// Mock commander
jest.mock('commander', () => {
  return {
    program: {
      option: jest.fn().mockReturnThis(),
      parse: jest.fn(),
      opts: jest.fn().mockReturnValue({
        sourceTable: 'rag_chunks',
        sourceColumn: 'embedding',
        targetTable: 'rag_chunks_new',
        targetColumn: 'embedding',
        batchSize: 100,
        dryRun: false,
        withIndex: true,
        indexType: 'hnsw',
        dimensions: 1536,
        connection: 'postgresql://user:password@localhost:5432/database',
        monitor: false,
        notify: false,
        environment: 'test'
      })
    }
  };
});

// Import the migration script - must use dynamic import
let migrateVectorData;
jest.isolateModules(() => {
  migrateVectorData = require('../scripts/vector-db-migrations/migrate-vector-data.js');
});

describe('Vector Data Migration Utility', () => {
  let mockPool;
  let mockClient;
  let consoleSpy;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Pool and Client
    mockPool = new Pool();
    mockClient = mockPool.connect();
    
    // Mock console.log and console.error
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Mock environment variables
    process.env.POSTGRES_CONNECTION = 'postgresql://user:password@localhost:5432/database';
    
    // Reset process.exit
    process.exit = jest.fn();
  });
  
  afterEach(() => {
    consoleSpy.mockRestore();
    jest.spyOn(console, 'error').mockRestore();
  });
  
  /**
   * Test creating target table
   */
  describe('createTargetTable', () => {
    test('should create target table if it does not exist', async () => {
      // Mock table check to return false (table doesn't exist)
      const mockQueryImpl = jest.fn().mockImplementation((query, params) => {
        if (query.includes('EXISTS (')) {
          return Promise.resolve({ rows: [{ exists: false }] });
        }
        
        if (query.includes('information_schema.columns')) {
          return Promise.resolve({
            rows: [
              { column_name: 'id', data_type: 'integer', is_nullable: 'NO', character_maximum_length: null },
              { column_name: 'document_id', data_type: 'character varying', is_nullable: 'NO', character_maximum_length: 255 },
              { column_name: 'content', data_type: 'text', is_nullable: 'NO', character_maximum_length: null },
              { column_name: 'embedding', data_type: 'USER-DEFINED', is_nullable: 'YES', character_maximum_length: null }
            ]
          });
        }
        
        if (query.includes('pg_index')) {
          return Promise.resolve({
            rows: [
              { attname: 'id' }
            ]
          });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Replace the mock implementation
      const client = await mockPool.connect();
      client.query.mockImplementation(mockQueryImpl);
      
      // Call the function
      const result = await migrateVectorData.createTargetTable();
      
      // Verify table was created
      expect(result).toBe(true);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE')
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('vector(1536)')
      );
    });
    
    test('should add vector column if table exists but column does not', async () => {
      // Mock table check to return true (table exists) but column check to return false
      const mockQueryImpl = jest.fn().mockImplementation((query, params) => {
        if (query.includes('EXISTS (')) {
          // First call (table check) returns true, second call (column check) returns false
          if (query.includes('column_name')) {
            return Promise.resolve({ rows: [{ exists: false }] });
          } else {
            return Promise.resolve({ rows: [{ exists: true }] });
          }
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Replace the mock implementation
      const client = await mockPool.connect();
      client.query.mockImplementation(mockQueryImpl);
      
      // Call the function
      const result = await migrateVectorData.createTargetTable();
      
      // Verify column was added
      expect(result).toBe(true);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE')
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN')
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('vector(1536)')
      );
    });
  });
  
  /**
   * Test batch data migration
   */
  describe('migrateData', () => {
    test('should process data in batches', async () => {
      // Set up totalRows
      migrateVectorData.migrationState.totalRows = 250;
      
      // Mock query responses for batched data
      const mockQueryImpl = jest.fn().mockImplementation((query, params) => {
        if (query.includes('SELECT *, embedding as source_embedding')) {
          // Create mock rows for each batch
          const offset = params[1];
          const batchSize = params[0];
          
          // If we've processed all rows, return empty array
          if (offset >= 250) {
            return Promise.resolve({ rows: [] });
          }
          
          // Create a batch of mock data
          const rows = [];
          const rowsToCreate = Math.min(batchSize, 250 - offset);
          
          for (let i = 0; i < rowsToCreate; i++) {
            rows.push({
              id: offset + i + 1,
              document_id: `doc-${offset + i + 1}`,
              content: `Sample content ${offset + i + 1}`,
              source_embedding: [0.1, 0.2, 0.3] // Simple mock embedding
            });
          }
          
          return Promise.resolve({ rows });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Replace the mock implementation
      const client = await mockPool.connect();
      client.query.mockImplementation(mockQueryImpl);
      
      // Call the function
      const result = await migrateVectorData.migrateData();
      
      // Verify batches were processed
      expect(result).toBe(true);
      expect(migrateVectorData.migrationState.processedRows).toBe(250);
      expect(migrateVectorData.migrationState.failedRows).toBe(0);
      
      // Should have called BEGIN and COMMIT for transaction
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      
      // Verify INSERT was called for each row
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.any(Array)
      );
    });
    
    test('should handle errors during migration', async () => {
      // Set up totalRows
      migrateVectorData.migrationState.totalRows = 100;
      
      // Mock query to fail on some inserts
      const mockQueryImpl = jest.fn().mockImplementation((query, params) => {
        if (query.includes('SELECT *, embedding as source_embedding')) {
          return Promise.resolve({
            rows: [
              { id: 1, document_id: 'doc-1', content: 'Content 1', source_embedding: [0.1, 0.2, 0.3] },
              { id: 2, document_id: 'doc-2', content: 'Content 2', source_embedding: [0.4, 0.5, 0.6] }
            ]
          });
        }
        
        if (query.includes('INSERT INTO') && params[0] === 2) {
          return Promise.reject(new Error('Simulated insert error'));
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Replace the mock implementation
      const client = await mockPool.connect();
      client.query.mockImplementation(mockQueryImpl);
      
      // Call the function
      const result = await migrateVectorData.migrateData();
      
      // Verify error handling
      expect(result).toBe(false);
      expect(migrateVectorData.migrationState.failedRows).toBeGreaterThan(0);
      expect(migrateVectorData.migrationState.rollbackNeeded).toBe(true);
      
      // Should rollback on errors
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
  
  /**
   * Test index creation
   */
  describe('createVectorIndex', () => {
    test('should create HNSW index by default', async () => {
      // Call the function
      const result = await migrateVectorData.createVectorIndex();
      
      // Verify index creation
      expect(result).toBe(true);
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
    
    test('should create IVFFlat index when specified', async () => {
      // Change index type
      const opts = jest.requireMock('commander').program.opts();
      opts.indexType = 'ivfflat';
      
      // Call the function
      const result = await migrateVectorData.createVectorIndex();
      
      // Verify index creation
      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('USING ivfflat')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH (lists = 100)')
      );
    });
    
    test('should set higher maintenance_work_mem for index creation', async () => {
      // Call the function
      await migrateVectorData.createVectorIndex();
      
      // Verify memory settings
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SET maintenance_work_mem')
      );
    });
  });
  
  /**
   * Test validation
   */
  describe('validateMigration', () => {
    test('should validate row counts between source and target', async () => {
      // Set up state
      migrateVectorData.migrationState.processedRows = 100;
      migrateVectorData.migrationState.failedRows = 0;
      
      // Mock target count
      mockClient.query.mockImplementation((query) => {
        if (query.includes('COUNT(*) as count FROM')) {
          return Promise.resolve({ rows: [{ count: 100 }] });
        }
        
        if (query.includes('SELECT id FROM')) {
          return Promise.resolve({ 
            rows: [
              { id: 1 },
              { id: 2 },
              { id: 3 }
            ] 
          });
        }
        
        if (query.includes('SELECT embedding FROM')) {
          return Promise.resolve({ 
            rows: [{ 
              embedding: [0.1, 0.2, 0.3] 
            }] 
          });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Call the function
      const result = await migrateVectorData.validateMigration();
      
      // Verify validation
      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as count')
      );
    });
    
    test('should verify data integrity on sample rows', async () => {
      // Set up state
      migrateVectorData.migrationState.processedRows = 100;
      migrateVectorData.migrationState.failedRows = 0;
      
      // Mock query implementations
      const mockQueryImpl = jest.fn().mockImplementation((query, params) => {
        if (query.includes('COUNT(*) as count')) {
          return Promise.resolve({ rows: [{ count: 100 }] });
        }
        
        if (query.includes('SELECT id FROM')) {
          return Promise.resolve({ 
            rows: [
              { id: 1 },
              { id: 2 },
              { id: 3 }
            ] 
          });
        }
        
        if (query.includes('SELECT embedding FROM rag_chunks WHERE id =')) {
          return Promise.resolve({ 
            rows: [{ 
              embedding: [0.1, 0.2, 0.3] 
            }] 
          });
        }
        
        if (query.includes('SELECT embedding FROM rag_chunks_new WHERE id =')) {
          return Promise.resolve({ 
            rows: [{ 
              embedding: [0.1, 0.2, 0.3] 
            }] 
          });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Replace the mock implementation
      mockClient.query.mockImplementation(mockQueryImpl);
      
      // Call the function
      const result = await migrateVectorData.validateMigration();
      
      // Verify data integrity check
      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT embedding FROM rag_chunks WHERE id ='),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT embedding FROM rag_chunks_new WHERE id ='),
        expect.any(Array)
      );
    });
    
    test('should detect data integrity issues', async () => {
      // Set up state
      migrateVectorData.migrationState.processedRows = 100;
      migrateVectorData.migrationState.failedRows = 0;
      
      // Mock query with mismatched embeddings
      const mockQueryImpl = jest.fn().mockImplementation((query, params) => {
        if (query.includes('COUNT(*) as count')) {
          return Promise.resolve({ rows: [{ count: 100 }] });
        }
        
        if (query.includes('SELECT id FROM')) {
          return Promise.resolve({ 
            rows: [
              { id: 1 },
              { id: 2 },
              { id: 3 }
            ] 
          });
        }
        
        if (query.includes('SELECT embedding FROM rag_chunks WHERE id =')) {
          return Promise.resolve({ 
            rows: [{ 
              embedding: [0.1, 0.2, 0.3] 
            }] 
          });
        }
        
        if (query.includes('SELECT embedding FROM rag_chunks_new WHERE id =')) {
          // Return different embedding to cause integrity check failure
          return Promise.resolve({ 
            rows: [{ 
              embedding: [0.1, 0.2, 0.4] 
            }] 
          });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Replace the mock implementation
      mockClient.query.mockImplementation(mockQueryImpl);
      
      // Call the function
      const result = await migrateVectorData.validateMigration();
      
      // Verify validation failure
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Integrity check failed'),
        expect.any(String)
      );
    });
  });
  
  /**
   * Test main migration function
   */
  describe('runMigration', () => {
    test('should run full migration process successfully', async () => {
      // Mock all the required functions
      const createTableSpy = jest.spyOn(migrateVectorData, 'createTargetTable')
        .mockResolvedValue(true);
      
      const countRowsSpy = jest.spyOn(migrateVectorData, 'countRows')
        .mockImplementation(() => {
          migrateVectorData.migrationState.totalRows = 100;
          return Promise.resolve(100);
        });
      
      const createSavepointSpy = jest.spyOn(migrateVectorData, 'createSavepoint')
        .mockResolvedValue(true);
      
      const migrateDataSpy = jest.spyOn(migrateVectorData, 'migrateData')
        .mockImplementation(() => {
          migrateVectorData.migrationState.processedRows = 100;
          migrateVectorData.migrationState.failedRows = 0;
          return Promise.resolve(true);
        });
      
      const createIndexSpy = jest.spyOn(migrateVectorData, 'createVectorIndex')
        .mockResolvedValue(true);
      
      const validateSpy = jest.spyOn(migrateVectorData, 'validateMigration')
        .mockResolvedValue(true);
      
      // Call the main function
      const result = await migrateVectorData.runMigration();
      
      // Verify all steps were called in order
      expect(createTableSpy).toHaveBeenCalled();
      expect(countRowsSpy).toHaveBeenCalled();
      expect(createSavepointSpy).toHaveBeenCalled();
      expect(migrateDataSpy).toHaveBeenCalled();
      expect(createIndexSpy).toHaveBeenCalled();
      expect(validateSpy).toHaveBeenCalled();
      
      // Verify final result
      expect(result).toBe(true);
      
      // Restore spies
      createTableSpy.mockRestore();
      countRowsSpy.mockRestore();
      createSavepointSpy.mockRestore();
      migrateDataSpy.mockRestore();
      createIndexSpy.mockRestore();
      validateSpy.mockRestore();
    });
    
    test('should handle failures at different stages', async () => {
      // Mock failure at data migration stage
      const createTableSpy = jest.spyOn(migrateVectorData, 'createTargetTable')
        .mockResolvedValue(true);
      
      const countRowsSpy = jest.spyOn(migrateVectorData, 'countRows')
        .mockImplementation(() => {
          migrateVectorData.migrationState.totalRows = 100;
          return Promise.resolve(100);
        });
      
      const createSavepointSpy = jest.spyOn(migrateVectorData, 'createSavepoint')
        .mockResolvedValue(true);
      
      const migrateDataSpy = jest.spyOn(migrateVectorData, 'migrateData')
        .mockImplementation(() => {
          migrateVectorData.migrationState.processedRows = 90;
          migrateVectorData.migrationState.failedRows = 10;
          return Promise.resolve(false);
        });
      
      // Call the main function
      const result = await migrateVectorData.runMigration();
      
      // Verify flow stopped at the failure point
      expect(createTableSpy).toHaveBeenCalled();
      expect(countRowsSpy).toHaveBeenCalled();
      expect(createSavepointSpy).toHaveBeenCalled();
      expect(migrateDataSpy).toHaveBeenCalled();
      
      // Verify final result
      expect(result).toBe(false);
      
      // Restore spies
      createTableSpy.mockRestore();
      countRowsSpy.mockRestore();
      createSavepointSpy.mockRestore();
      migrateDataSpy.mockRestore();
    });
  });
});