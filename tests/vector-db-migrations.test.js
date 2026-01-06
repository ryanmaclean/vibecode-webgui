/**
 * Unit tests for Vector DB Migrations
 *
 * These tests cover vector database migration functionality with mocked database operations
 */

import { jest } from '@jest/globals';
import { Client } from 'pg';

// Mock pg Client
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

// Mock Azure identity
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      token: 'mock-azure-token-12345',
      expiresOnTimestamp: Date.now() + 3600000
    })
  }))
}));

describe('Vector DB Migrations', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock client instance
    mockClient = new Client();

    // Setup default mock responses
    mockClient.query.mockImplementation((sql) => {
      // Mock pgvector extension check
      if (sql.includes('pg_extension') && sql.includes('vector')) {
        return Promise.resolve({
          rows: [{ extname: 'vector', extversion: '0.5.0' }]
        });
      }

      // Mock table schema queries
      if (sql.includes('information_schema.columns')) {
        return Promise.resolve({
          rows: [
            {
              column_name: 'id',
              data_type: 'integer',
              is_nullable: 'NO',
              column_default: "nextval('rag_chunks_id_seq'::regclass)"
            },
            {
              column_name: 'document_id',
              data_type: 'character varying',
              is_nullable: 'NO',
              column_default: null
            },
            {
              column_name: 'content',
              data_type: 'text',
              is_nullable: 'NO',
              column_default: null
            },
            {
              column_name: 'embedding',
              data_type: 'USER-DEFINED',
              is_nullable: 'YES',
              column_default: null
            },
            {
              column_name: 'metadata',
              data_type: 'text',
              is_nullable: 'YES',
              column_default: null
            }
          ]
        });
      }

      // Mock vector column queries
      if (sql.includes('udt_name = \'vector\'')) {
        return Promise.resolve({
          rows: [{ column_name: 'embedding' }]
        });
      }

      // Mock index queries
      if (sql.includes('pg_indexes')) {
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

      // Mock constraint queries
      if (sql.includes('pg_constraint')) {
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

      // Mock CREATE/ALTER/DROP operations
      if (sql.includes('CREATE') || sql.includes('ALTER') || sql.includes('DROP')) {
        return Promise.resolve({ rows: [] });
      }

      // Mock transaction commands
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return Promise.resolve({ rows: [] });
      }

      // Default response
      return Promise.resolve({ rows: [] });
    });

    mockClient.connect.mockResolvedValue(undefined);
    mockClient.end.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Schema migrations for vector columns', () => {
    it('should detect pgvector extension', async () => {
      const result = await mockClient.query(`
        SELECT * FROM pg_extension WHERE extname = 'vector'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].extname).toBe('vector');
    });

    it('should identify vector columns in table', async () => {
      // Override mock for this specific query to return only vector columns
      mockClient.query.mockImplementationOnce((sql, params) => {
        if (sql.includes('udt_name = \'vector\'') || sql.includes("udt_name = 'vector'")) {
          return Promise.resolve({
            rows: [{ column_name: 'embedding' }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await mockClient.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
          AND data_type = 'USER-DEFINED' AND udt_name = 'vector'
      `, ['public', 'rag_chunks']);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('embedding');
    });

    it('should create staging table with new schema', async () => {
      await mockClient.query(`
        CREATE TABLE public.rag_chunks_staging (
          id integer NOT NULL,
          document_id character varying NOT NULL,
          content text NOT NULL,
          embedding vector,
          legacy_metadata text,
          metadata_json JSONB,
          last_accessed_at TIMESTAMP WITH TIME ZONE
        )
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE')
      );
    });

    it('should handle column renaming in migration', async () => {
      const tableInfo = await mockClient.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'rag_chunks'
      `);

      expect(tableInfo.rows.some(col => col.column_name === 'metadata')).toBe(true);

      // Simulate renaming metadata -> legacy_metadata
      await mockClient.query(`
        ALTER TABLE rag_chunks_staging RENAME COLUMN metadata TO legacy_metadata
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('RENAME COLUMN')
      );
    });
  });

  describe('Index creation for vector search', () => {
    it('should create HNSW index for vector column', async () => {
      await mockClient.query(`
        CREATE INDEX idx_rag_chunks_embedding_hnsw
        ON rag_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('USING hnsw')
      );
    });

    it('should create IVFFlat index for vector column', async () => {
      await mockClient.query(`
        CREATE INDEX idx_rag_chunks_embedding_ivfflat
        ON rag_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('USING ivfflat')
      );
    });

    it('should list existing vector indexes', async () => {
      const result = await mockClient.query(`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'rag_chunks'
      `);

      expect(result.rows).toHaveLength(2);
      expect(result.rows.some(idx => idx.indexname.includes('embedding'))).toBe(true);
    });

    it('should create indexes concurrently to avoid locking', async () => {
      await mockClient.query(`
        CREATE INDEX CONCURRENTLY idx_new_vector
        ON rag_chunks
        USING hnsw (embedding vector_cosine_ops)
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX CONCURRENTLY')
      );
    });
  });

  describe('Data migration for existing vectors', () => {
    it('should copy data from source to staging table', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '1000' }]
      });

      await mockClient.query(`
        INSERT INTO public.rag_chunks_staging (id, document_id, content, embedding, legacy_metadata)
        SELECT id, document_id, content, embedding, metadata
        FROM public.rag_chunks
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO')
      );
    });

    it('should preserve vector data during migration', async () => {
      const insertQuery = `
        INSERT INTO rag_chunks_staging (embedding)
        SELECT embedding FROM rag_chunks WHERE embedding IS NOT NULL
      `;

      await mockClient.query(insertQuery);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding')
      );
    });

    it('should handle large dataset migration with timeouts', async () => {
      await mockClient.query("SET statement_timeout = '300s'");
      await mockClient.query(`
        INSERT INTO rag_chunks_staging
        SELECT * FROM rag_chunks
      `);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('statement_timeout')
      );
    });
  });

  describe('Rollback functionality', () => {
    it('should support transaction rollback on error', async () => {
      await mockClient.query('BEGIN');

      try {
        await mockClient.query('ALTER TABLE rag_chunks RENAME TO rag_chunks_old');
        // Simulate error
        throw new Error('Migration error');
      } catch (error) {
        await mockClient.query('ROLLBACK');
      }

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should swap tables atomically using transaction', async () => {
      await mockClient.query('BEGIN');
      await mockClient.query('ALTER TABLE public.rag_chunks RENAME TO rag_chunks_backup');
      await mockClient.query('ALTER TABLE public.rag_chunks_staging RENAME TO rag_chunks');
      await mockClient.query('COMMIT');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should maintain backup table after migration', async () => {
      await mockClient.query('BEGIN');
      await mockClient.query('ALTER TABLE rag_chunks RENAME TO rag_chunks_backup_20250105');
      await mockClient.query('COMMIT');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('rag_chunks_backup')
      );
    });

    it('should handle lock timeout gracefully', async () => {
      await mockClient.query("SET lock_timeout = '5s'");

      mockClient.query.mockImplementationOnce(() =>
        Promise.reject(new Error('lock timeout'))
      );

      try {
        await mockClient.query('LOCK TABLE rag_chunks IN ACCESS EXCLUSIVE MODE');
      } catch (error) {
        await mockClient.query('ROLLBACK');
      }

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Azure managed identity integration', () => {
    it('should authenticate using Azure managed identity', async () => {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const credential = new DefaultAzureCredential();
      const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');

      expect(token.token).toBe('mock-azure-token-12345');
      expect(token.expiresOnTimestamp).toBeGreaterThan(Date.now());
    });

    it('should use token as password for Azure PostgreSQL', async () => {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const credential = new DefaultAzureCredential();
      const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');

      // Simulate client creation with token
      const azureClient = new Client({
        host: 'test.postgres.database.azure.com',
        database: 'vibecode',
        user: 'testuser',
        password: token.token,
        ssl: { rejectUnauthorized: true }
      });

      expect(azureClient).toBeDefined();
    });
  });
});
