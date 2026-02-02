// src/pgvectorClient.ts
import { Pool, PoolConfig } from 'pg';
import { Logger } from './logger';

export class PgvectorClient {
    private pool: Pool;
    private logger: Logger;

    constructor(config: PoolConfig, logger: Logger) {
        this.logger = logger;
        this.pool = new Pool(config);
        this.logger.info('pgvector client initialized');
    }

    public async connect(): Promise<void> {
        try {
            await this.pool.connect();
            this.logger.info('Successfully connected to PostgreSQL');
        } catch (error) {
            this.logger.error('Failed to connect to PostgreSQL', error);
            throw error;
        }
    }

    public async initializeDatabase(): Promise<void> {
        const client = await this.pool.connect();
        try {
            // Enable vector extension if not already enabled
            await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
            
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
            
            // Create index for efficient similarity search
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_documents_embedding 
                ON workspace_documents 
                USING ivfflat (embedding vector_cosine_ops) 
                WITH (lists = 100);
            `);
            
            // Create index for workspace and file path for efficient lookups
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_workspace_path 
                ON workspace_documents (workspace_id, filepath);
            `);
            
            this.logger.info('Database schema initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize database', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async clearWorkspace(workspaceId: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(
                'DELETE FROM workspace_documents WHERE workspace_id = $1',
                [workspaceId]
            );
            this.logger.info(`Cleared workspace ${workspaceId} from database`);
        } catch (error) {
            this.logger.error('Failed to clear workspace', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async insertDocument(
        workspaceId: string,
        filepath: string,
        content: string,
        embedding: number[]
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO workspace_documents 
                (workspace_id, filepath, content, embedding)
                VALUES ($1, $2, $3, $4::vector)
                ON CONFLICT (workspace_id, filepath)
                DO UPDATE SET 
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding::vector,
                    last_modified = CURRENT_TIMESTAMP
            `;
            
            const embeddingStr = `[${embedding.join(',')}]`;
            await client.query(query, [workspaceId, filepath, content, embeddingStr]);
            this.logger.debug(`Inserted document: ${filepath}`);
        } catch (error) {
            this.logger.error(`Failed to insert document ${filepath}`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async getDocumentCount(workspaceId: string): Promise<number> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT COUNT(*) FROM workspace_documents WHERE workspace_id = $1',
                [workspaceId]
            );
            return parseInt(result.rows[0].count, 10);
        } catch (error) {
            this.logger.error('Failed to get document count', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async search(
        workspaceId: string,
        queryEmbedding: number[],
        limit: number = 5
    ): Promise<any[]> {
        const client = await this.pool.connect();
        try {
            const embeddingStr = `[${queryEmbedding.join(',')}]`;
            // The <=> operator calculates cosine distance
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
            return result.rows;
        } catch (error) {
            this.logger.error('Failed to search documents', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async getWorkspaceFiles(workspaceId: string): Promise<{ filepath: string, last_modified: Date }[]> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT filepath, last_modified FROM workspace_documents WHERE workspace_id = $1',
                [workspaceId]
            );
            return result.rows.map(row => ({
                filepath: row.filepath,
                last_modified: new Date(row.last_modified)
            }));
        } catch (error) {
            this.logger.error('Failed to get workspace files', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
        this.logger.info('Database connection pool closed');
    }
}

