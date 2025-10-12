/**
 * SQL Server Vector Database Adapter
 * Implementation of vector database operations using Microsoft SQL Server with vector extensions
 */

import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { VectorChunk, SearchResult, SearchOptions } from './vector-types';
import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';

/**
 * SQL Server-specific configuration options
 */
export interface SqlServerVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.SQLSERVER;
  schema?: string;
  connectionTimeout?: number;
  requestTimeout?: number;
  enableArithAbort?: boolean;
  enableAnsiWarnings?: boolean;
}

/**
 * SQL Server Vector Database Adapter
 */
export class SqlServerVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private connection: any = null; // SQL Server connection
  private sqlserverConfig: SqlServerVectorDatabaseConfig;
  private errorHandler: VectorDbErrorHandler;

  /**
   * Constructor for SQL Server Vector Database Adapter
   */
  constructor(config: SqlServerVectorDatabaseConfig) {
    super(config);
    this.sqlserverConfig = config;
    this.errorHandler = new VectorDbErrorHandler();
  }

  /**
   * Initialize the SQL Server vector database connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize SQL Server connection using mssql package
      const sql = await import('mssql');

      this.connection = new sql.ConnectionPool({
        server: this.sqlserverConfig.host,
        port: this.sqlserverConfig.port,
        user: this.sqlserverConfig.username,
        password: this.sqlserverConfig.password,
        database: this.sqlserverConfig.database,
        connectionTimeout: this.sqlserverConfig.connectionTimeout || 30000,
        requestTimeout: this.sqlserverConfig.requestTimeout || 30000,
        options: {
          enableArithAbort: this.sqlserverConfig.enableArithAbort !== false,
          enableAnsiWarnings: this.sqlserverConfig.enableAnsiWarnings !== false,
          trustServerCertificate: true // For development - use proper certificates in production
        }
      });

      await this.connection.connect();

      // Create vector table if it doesn't exist
      await this.createVectorTable();

      this.isInitialized = true;
      console.log('SQL Server vector database adapter initialized successfully');

    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'initialize');
      throw vectorDbError;
    }
  }

  /**
   * Close the SQL Server connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    this.isInitialized = false;
  }

  /**
   * Check if the SQL Server connection is healthy
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.connection) return false;

      const request = new (await import('mssql')).Request(this.connection);
      await request.query('SELECT 1 as test');
      return true;
    } catch (error) {
      console.error('SQL Server ping failed:', error);
      return false;
    }
  }

  /**
   * Check if connected to SQL Server
   */
  isConnected(): boolean {
    return this.connection !== null && this.isInitialized;
  }

  /**
   * Create the vector table if it doesn't exist
   */
  private async createVectorTable(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      // Create vector table with vector support (assuming SQL Server 2022+ with vector extensions)
      await request.query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VectorChunks' AND xtype='U')
        CREATE TABLE VectorChunks (
          id NVARCHAR(255) PRIMARY KEY,
          content NVARCHAR(MAX) NOT NULL,
          embedding VECTOR(1536) NOT NULL, -- Assuming OpenAI embedding dimensions
          metadata NVARCHAR(MAX),
          workspaceId INT DEFAULT 0,
          fileId INT DEFAULT 0,
          fileName NVARCHAR(500),
          language NVARCHAR(100),
          tokens INT DEFAULT 0,
          createdAt DATETIME2 DEFAULT GETUTCDATE(),
          updatedAt DATETIME2 DEFAULT GETUTCDATE()
        );
      `);

      // Create index for vector similarity search
      await request.query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VectorChunks_Embedding')
        CREATE INDEX IX_VectorChunks_Embedding ON VectorChunks (embedding)
        WITH (VECTOR_INDEX = 'HNSW');
      `);

    } catch (error) {
      console.error('Failed to create vector table:', error);
      // Don't throw here as the table might already exist
    }
  }

  /**
   * Store vector embeddings for the given chunks
   */
  async store(chunks: VectorChunk[]): Promise<number> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      let storedCount = 0;

      for (const chunk of chunks) {
        const request = new sql.Request(this.connection);

        request.input('id', sql.NVarChar, chunk.id);
        request.input('content', sql.NVarChar, chunk.content);
        request.input('embedding', sql.NVarChar, JSON.stringify(chunk.embedding)); // Store as JSON string
        request.input('metadata', sql.NVarChar, JSON.stringify(chunk.metadata));
        request.input('workspaceId', sql.Int, chunk.metadata.fileId || 0);
        request.input('fileId', sql.Int, chunk.metadata.fileId || 0);
        request.input('fileName', sql.NVarChar, chunk.metadata.fileName || '');
        request.input('language', sql.NVarChar, chunk.metadata.language || '');
        request.input('tokens', sql.Int, chunk.metadata.tokens || 0);

        await request.query(`
          IF EXISTS (SELECT 1 FROM VectorChunks WHERE id = @id)
          BEGIN
            UPDATE VectorChunks
            SET content = @content,
                embedding = @embedding,
                metadata = @metadata,
                workspaceId = @workspaceId,
                fileId = @fileId,
                fileName = @fileName,
                language = @language,
                tokens = @tokens,
                updatedAt = GETUTCDATE()
            WHERE id = @id
          END
          ELSE
          BEGIN
            INSERT INTO VectorChunks (id, content, embedding, metadata, workspaceId, fileId, fileName, language, tokens, createdAt, updatedAt)
            VALUES (@id, @content, @embedding, @metadata, @workspaceId, @fileId, @fileName, @language, @tokens, GETUTCDATE(), GETUTCDATE())
          END
        `);

        storedCount++;
      }

      return storedCount;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'store');
      throw vectorDbError;
    }
  }

  /**
   * Search for similar vectors using the provided query embedding
   */
  async searchWithVector(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      request.input('queryEmbedding', sql.NVarChar, JSON.stringify(queryEmbedding));
      request.input('threshold', sql.Float, threshold);
      request.input('limit', sql.Int, limit);

      // Use VECTOR_DISTANCE function for similarity search (SQL Server 2022+)
      const result = await request.query(`
        SELECT TOP (@limit)
          id,
          content,
          embedding,
          metadata,
          VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) as distance,
          1 - VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) as similarity
        FROM VectorChunks
        WHERE VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) <= (1 - @threshold)
        ORDER BY VECTOR_DISTANCE('cosine', @queryEmbedding, embedding)
      `);

      return result.recordset.map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: JSON.parse(row.embedding),
          metadata: JSON.parse(row.metadata || '{}')
        },
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithVector');
      throw vectorDbError;
    }
  }

  /**
   * Search for similar vectors using text query (generates embedding internally)
   */
  async searchWithText(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      // Generate embedding for the text query (placeholder)
      const queryEmbedding = await this.generateEmbedding(query);

      return this.searchWithVector(queryEmbedding, options);
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithText');
      throw vectorDbError;
    }
  }

  /**
   * Delete vectors by their IDs
   */
  async delete(ids: string[]): Promise<number> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      // Create a table-valued parameter for the IDs
      const idTable = ids.map((id, index) => ({ id, index })).reduce((acc, item) => {
        acc[item.index] = item.id;
        return acc;
      }, {});

      request.input('ids', sql.NVarChar, JSON.stringify(ids));

      const result = await request.query(`
        DELETE FROM VectorChunks
        WHERE id IN (SELECT value FROM OPENJSON(@ids))
      `);

      return result.rowsAffected[0] || 0;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'delete');
      throw vectorDbError;
    }
  }

  /**
   * Get statistics about the vector database
   */
  async getStats(): Promise<{
    totalVectors: number;
    indexSize: number;
    lastUpdated: Date;
  }> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      const result = await request.query(`
        SELECT
          COUNT(*) as totalVectors,
          MAX(updatedAt) as lastUpdated
        FROM VectorChunks
      `);

      const row = result.recordset[0];

      return {
        totalVectors: row.totalVectors || 0,
        indexSize: (row.totalVectors || 0) * 1000, // Rough estimate
        lastUpdated: row.lastUpdated || new Date()
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getStats');
      throw vectorDbError;
    }
  }

  /**
   * Generate embeddings for the given text (placeholder implementation)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // This would integrate with an embedding service (OpenAI, etc.)
    // For now, return a placeholder embedding
    const dimensions = 1536; // OpenAI text-embedding-ada-002 dimensions
    return new Array(dimensions).fill(0).map(() => Math.random() * 2 - 1);
  }

  /**
   * Get the dimensionality of vectors in this database
   */
  getDimensions(): number {
    return 1536; // Standard for OpenAI embeddings
  }

  /**
   * Clear all vectors from the database
   */
  async clear(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      await request.query('DELETE FROM VectorChunks');
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'clear');
      throw vectorDbError;
    }
  }

  /**
   * Create an index for the given field if it doesn't exist
   */
  async createIndex(field: string, options?: any): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      // Create vector index for similarity search
      await request.query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = '${field}_vector_idx')
        CREATE INDEX ${field}_vector_idx ON VectorChunks (${field})
        WITH (VECTOR_INDEX = 'HNSW');
      `);
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'createIndex');
      throw vectorDbError;
    }
  }

  /**
   * Delete an index for the given field
   */
  async deleteIndex(field: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      await request.query(`DROP INDEX IF EXISTS ${field}_vector_idx ON VectorChunks`);
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'deleteIndex');
      throw vectorDbError;
    }
  }

  /**
   * Get all available indexes
   */
  async getIndexes(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      const result = await request.query(`
        SELECT name FROM sys.indexes
        WHERE object_id = OBJECT_ID('VectorChunks')
        AND type_desc LIKE '%VECTOR%'
      `);

      return result.recordset.map((row: any) => row.name);
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getIndexes');
      throw vectorDbError;
    }
  }

  /**
   * Invalidate cache for specific table and content type
   */
  async invalidateCache(table: string, contentType?: string): Promise<number> {
    // SQL Server doesn't have traditional cache invalidation
    // This would integrate with your caching layer
    return 0;
  }

  /**
   * Get vector by ID
   */
  async getById(id: string): Promise<VectorChunk | null> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      request.input('id', sql.NVarChar, id);

      const result = await request.query(`
        SELECT id, content, embedding, metadata, workspaceId, fileId, fileName, language, tokens
        FROM VectorChunks
        WHERE id = @id
      `);

      if (result.recordset.length === 0) {
        return null;
      }

      const row = result.recordset[0];

      return {
        id: row.id,
        content: row.content,
        embedding: JSON.parse(row.embedding),
        metadata: JSON.parse(row.metadata || '{}')
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getById');
      throw vectorDbError;
    }
  }

  /**
   * Update vector by ID
   */
  async update(id: string, chunk: Partial<VectorChunk>): Promise<boolean> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      request.input('id', sql.NVarChar, id);

      const updateFields: string[] = [];
      const inputs: Array<{ name: string; type: any; value: any }> = [];

      if (chunk.content !== undefined) {
        updateFields.push('content = @content');
        inputs.push({ name: 'content', type: sql.NVarChar, value: chunk.content });
      }

      if (chunk.embedding !== undefined) {
        updateFields.push('embedding = @embedding');
        inputs.push({ name: 'embedding', type: sql.NVarChar, value: JSON.stringify(chunk.embedding) });
      }

      if (chunk.metadata !== undefined) {
        updateFields.push('metadata = @metadata');
        inputs.push({ name: 'metadata', type: sql.NVarChar, value: JSON.stringify(chunk.metadata) });
      }

      if (updateFields.length === 0) {
        return false;
      }

      // Add inputs to request
      inputs.forEach(input => {
        request.input(input.name, input.type, input.value);
      });

      const result = await request.query(`
        UPDATE VectorChunks
        SET ${updateFields.join(', ')}, updatedAt = GETUTCDATE()
        WHERE id = @id
      `);

      return result.rowsAffected[0] > 0;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'update');
      throw vectorDbError;
    }
  }

  /**
   * Batch operation for multiple vectors
   */
  async batch(operations: Array<{
    type: 'insert' | 'update' | 'delete';
    data?: VectorChunk;
    id?: string;
  }>): Promise<number> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    let processedCount = 0;

    try {
      for (const operation of operations) {
        switch (operation.type) {
          case 'insert':
            if (operation.data) {
              await this.store([operation.data]);
              processedCount++;
            }
            break;

          case 'update':
            if (operation.id && operation.data) {
              await this.update(operation.id, operation.data);
              processedCount++;
            }
            break;

          case 'delete':
            if (operation.id) {
              await this.delete([operation.id]);
              processedCount++;
            }
            break;
        }
      }

      return processedCount;
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'batch');
      throw vectorDbError;
    }
  }

  /**
   * Get similar vectors within a specific workspace
   */
  async searchByWorkspace(
    workspaceId: number,
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      request.input('workspaceId', sql.Int, workspaceId);
      request.input('queryEmbedding', sql.NVarChar, JSON.stringify(queryEmbedding));
      request.input('threshold', sql.Float, threshold);
      request.input('limit', sql.Int, limit);

      const result = await request.query(`
        SELECT TOP (@limit)
          id,
          content,
          embedding,
          metadata,
          VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) as distance,
          1 - VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) as similarity
        FROM VectorChunks
        WHERE workspaceId = @workspaceId
        AND VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) <= (1 - @threshold)
        ORDER BY VECTOR_DISTANCE('cosine', @queryEmbedding, embedding)
      `);

      return result.recordset.map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: JSON.parse(row.embedding),
          metadata: JSON.parse(row.metadata || '{}')
        },
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchByWorkspace');
      throw vectorDbError;
    }
  }

  /**
   * Get vectors by file IDs
   */
  async getByFileIds(fileIds: number[]): Promise<VectorChunk[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      // Create a table-valued parameter for file IDs
      const fileIdList = fileIds.join(',');
      request.input('fileIds', sql.NVarChar, fileIdList);

      const result = await request.query(`
        SELECT id, content, embedding, metadata
        FROM VectorChunks
        WHERE fileId IN (SELECT value FROM STRING_SPLIT(@fileIds, ','))
      `);

      return result.recordset.map((row: any) => ({
        id: row.id,
        content: row.content,
        embedding: JSON.parse(row.embedding),
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getByFileIds');
      throw vectorDbError;
    }
  }

  /**
   * Search with hybrid scoring (semantic + keyword)
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    options: SearchOptions & {
      keywordWeight?: number;
      semanticWeight?: number;
    }
  ): Promise<SearchResult[]> {
    // For SQL Server, hybrid search would need more complex implementation
    // For now, fall back to semantic search
    return this.searchWithVector(queryEmbedding, options);
  }

  /**
   * Get recommendations based on user behavior
   */
  async getRecommendations(
    userId: string,
    currentFileId: number,
    options: {
      limit?: number;
      excludeCurrentFile?: boolean;
    }
  ): Promise<VectorChunk[]> {
    // Simplified implementation for SQL Server
    return [];
  }

  /**
   * Get trending content based on recent activity
   */
  async getTrendingContent(
    workspaceId: number,
    options: {
      limit?: number;
      timeWindow?: number;
    }
  ): Promise<VectorChunk[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      const limit = options.limit || 10;
      request.input('workspaceId', sql.Int, workspaceId);
      request.input('limit', sql.Int, limit);

      const result = await request.query(`
        SELECT TOP (@limit) id, content, embedding, metadata
        FROM VectorChunks
        WHERE workspaceId = @workspaceId
        ORDER BY updatedAt DESC
      `);

      return result.recordset.map((row: any) => ({
        id: row.id,
        content: row.content,
        embedding: JSON.parse(row.embedding),
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getTrendingContent');
      throw vectorDbError;
    }
  }

  /**
   * Search with filters
   */
  async searchWithFilters(
    queryEmbedding: number[],
    filters: {
      language?: string;
      fileType?: string;
      minTokens?: number;
      maxTokens?: number;
      dateRange?: { start: Date; end: Date };
    },
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      request.input('queryEmbedding', sql.NVarChar, JSON.stringify(queryEmbedding));
      request.input('threshold', sql.Float, threshold);
      request.input('limit', sql.Int, limit);

      let whereClause = 'VECTOR_DISTANCE(\'cosine\', @queryEmbedding, embedding) <= (1 - @threshold)';
      const inputs: Array<{ name: string; type: any; value: any }> = [];

      if (filters.language) {
        whereClause += ' AND language = @language';
        inputs.push({ name: 'language', type: sql.NVarChar, value: filters.language });
      }

      if (filters.minTokens) {
        whereClause += ' AND tokens >= @minTokens';
        inputs.push({ name: 'minTokens', type: sql.Int, value: filters.minTokens });
      }

      if (filters.maxTokens) {
        whereClause += ' AND tokens <= @maxTokens';
        inputs.push({ name: 'maxTokens', type: sql.Int, value: filters.maxTokens });
      }

      // Add inputs to request
      inputs.forEach(input => {
        request.input(input.name, input.type, input.value);
      });

      const result = await request.query(`
        SELECT TOP (@limit)
          id,
          content,
          embedding,
          metadata,
          VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) as distance,
          1 - VECTOR_DISTANCE('cosine', @queryEmbedding, embedding) as similarity
        FROM VectorChunks
        WHERE ${whereClause}
        ORDER BY VECTOR_DISTANCE('cosine', @queryEmbedding, embedding)
      `);

      return result.recordset.map((row: any) => ({
        chunk: {
          id: row.id,
          content: row.content,
          embedding: JSON.parse(row.embedding),
          metadata: JSON.parse(row.metadata || '{}')
        },
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'searchWithFilters');
      throw vectorDbError;
    }
  }

  /**
   * Get content analytics
   */
  async getAnalytics(workspaceId: number): Promise<{
    totalFiles: number;
    totalChunks: number;
    languageBreakdown: Record<string, number>;
    recentActivity: Array<{
      date: Date;
      filesAdded: number;
      searchesPerformed: number;
    }>;
  }> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const sql = await import('mssql');
      const request = new sql.Request(this.connection);

      request.input('workspaceId', sql.Int, workspaceId);

      // Get total counts
      const countResult = await request.query(`
        SELECT
          COUNT(DISTINCT fileId) as totalFiles,
          COUNT(*) as totalChunks
        FROM VectorChunks
        WHERE workspaceId = @workspaceId
      `);

      // Get language breakdown
      const languageResult = await request.query(`
        SELECT
          language,
          COUNT(*) as count
        FROM VectorChunks
        WHERE workspaceId = @workspaceId AND language IS NOT NULL
        GROUP BY language
      `);

      const languageBreakdown: Record<string, number> = {};
      languageResult.recordset.forEach((row: any) => {
        languageBreakdown[row.language] = row.count;
      });

      const row = countResult.recordset[0];

      return {
        totalFiles: row.totalFiles || 0,
        totalChunks: row.totalChunks || 0,
        languageBreakdown,
        recentActivity: [
          {
            date: new Date(),
            filesAdded: row.totalFiles || 0,
            searchesPerformed: 0 // Would need search tracking
          }
        ]
      };
    } catch (error) {
      const vectorDbError = this.errorHandler.handleError(error, 'getAnalytics');
      throw vectorDbError;
    }
  }
}
