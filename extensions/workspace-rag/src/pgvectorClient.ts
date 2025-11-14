// src/pgvectorClient.ts
import { Pool, PoolConfig, PoolClient } from 'pg';
import { Logger } from './logger';
import { TracingManager } from './tracing';

export class PgvectorClient {
    private pool: Pool;
    private logger: Logger;
    private tracing: TracingManager;

    constructor(config: PoolConfig, logger: Logger, tracing: TracingManager) {
        this.logger = logger;
        this.tracing = tracing;
        this.pool = new Pool(config);
        this.logger.debug('pgvector client initialized', config);
    }

    public async connect(): Promise<void> {
        return this.tracing.trace('pg.connect', async (span) => {
            try {
                const client = await this.pool.connect();
                client.release();
                span.setTag('db.operation', 'connect');
                this.logger.info('Successfully connected to PostgreSQL');
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to connect to PostgreSQL', error);
                throw error;
            }
        });
    }

    public async initializeDatabase(): Promise<void> {
        return this.tracing.trace('pg.initialize', async (span) => {
            const client = await this.pool.connect();
            try {
                // Enable vector extension
                await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
                span.setTag('step', 'create_extension');
                
                // Create table for document storage
                await client.query(`
                    CREATE TABLE IF NOT EXISTS workspace_documents (
                        id SERIAL PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        filepath TEXT NOT NULL,
                        content TEXT NOT NULL,
                        embedding vector(1536),
                        last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(workspace_id, filepath)
                    );
                `);
                span.setTag('step', 'create_table');
                
                // Create index for efficient similarity search
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_documents_embedding 
                    ON workspace_documents 
                    USING ivfflat (embedding vector_cosine_ops) 
                    WITH (lists = 100);
                `);
                span.setTag('step', 'create_embedding_index');
                
                // Create index for workspace and file path
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_workspace_path 
                    ON workspace_documents (workspace_id, filepath);
                `);
                span.setTag('step', 'create_path_index');
                
                this.logger.info('Database schema initialized successfully');
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to initialize database', error);
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public async clearWorkspace(workspaceId: string): Promise<void> {
        return this.tracing.trace('pg.clearWorkspace', async (span) => {
            span.setTag('workspace.id', workspaceId);
            const client = await this.pool.connect();
            try {
                const result = await client.query(
                    'DELETE FROM workspace_documents WHERE workspace_id = $1',
                    [workspaceId]
                );
                span.setTag('rows_deleted', result.rowCount || 0);
                this.logger.info(`Cleared workspace ${workspaceId} (${result.rowCount} documents)`);
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to clear workspace', error);
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public async insertDocument(
        workspaceId: string,
        filepath: string,
        content: string,
        embedding: number[]
    ): Promise<void> {
        return this.tracing.trace('pg.insertDocument', async (span) => {
            span.setTag('workspace.id', workspaceId);
            span.setTag('file.path', filepath);
            span.setTag('content.length', content.length);
            span.setTag('embedding.dimension', embedding.length);

            const client = await this.pool.connect();
            try {
                const query = `
                    INSERT INTO workspace_documents 
                    (workspace_id, filepath, content, embedding)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (workspace_id, filepath) 
                    DO UPDATE SET 
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        last_modified = CURRENT_TIMESTAMP
                `;
                
                const embeddingStr = `[${embedding.join(',')}]`;
                await client.query(query, [workspaceId, filepath, content, embeddingStr]);
                this.logger.debug(`Inserted document: ${filepath}`);
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error(`Failed to insert document ${filepath}`, error);
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public async getDocumentCount(workspaceId: string): Promise<number> {
        return this.tracing.trace('pg.getDocumentCount', async (span) => {
            span.setTag('workspace.id', workspaceId);
            const client = await this.pool.connect();
            try {
                const result = await client.query(
                    'SELECT COUNT(*) FROM workspace_documents WHERE workspace_id = $1',
                    [workspaceId]
                );
                const count = parseInt(result.rows[0].count, 10);
                span.setTag('document.count', count);
                return count;
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to get document count', error);
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public async search(
        workspaceId: string,
        queryEmbedding: number[],
        limit: number = 5
    ): Promise<Array<{ filepath: string; content: string; similarity: number }>> {
        return this.tracing.trace('pg.vectorSearch', async (span) => {
            span.setTag('workspace.id', workspaceId);
            span.setTag('vector.dimension', queryEmbedding.length);
            span.setTag('search.limit', limit);

            const client = await this.pool.connect();
            try {
                const embeddingStr = `[${queryEmbedding.join(',')}]`;
                const query = `
                    SELECT 
                        filepath, 
                        content, 
                        1 - (embedding <=> $1::vector) as similarity
                    FROM workspace_documents
                    WHERE workspace_id = $2
                    ORDER BY embedding <=> $1::vector
                    LIMIT $3
                `;
                
                const result = await client.query(query, [embeddingStr, workspaceId, limit]);
                
                span.setTag('search.results_count', result.rows.length);
                if (result.rows.length > 0) {
                    span.setTag('search.best_similarity', result.rows[0].similarity);
                }
                
                return result.rows;
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to search documents', error);
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public async getWorkspaceFiles(workspaceId: string): Promise<Array<{ filepath: string; last_modified: Date }>> {
        return this.tracing.trace('pg.getWorkspaceFiles', async (span) => {
            span.setTag('workspace.id', workspaceId);
            const client = await this.pool.connect();
            try {
                const result = await client.query(
                    'SELECT DISTINCT filepath, last_modified FROM workspace_documents WHERE workspace_id = $1',
                    [workspaceId]
                );
                span.setTag('files.count', result.rows.length);
                return result.rows.map(row => ({
                    filepath: row.filepath,
                    last_modified: new Date(row.last_modified)
                }));
            } catch (error: any) {
                span.setTag('error', true);
                span.setTag('error.msg', error.message);
                this.logger.error('Failed to get workspace files', error);
                throw error;
            } finally {
                client.release();
            }
        });
    }

    public async close(): Promise<void> {
        await this.pool.end();
        this.logger.debug('Database connection pool closed');
    }
}

