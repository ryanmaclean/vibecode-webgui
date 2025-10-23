import { PrismaClient } from '@prisma/client';

import { BaseVectorDatabaseAdapter } from './base-vector-database-adapter';
import { SearchOptions, SearchResult, VectorDatabaseConfig, VectorDatabaseProvider } from './vector-types';
import { VectorCacheInvalidator } from '../cache/vector-cache-invalidator';
import { PgVectorSearch } from '../cache/pgvector-search';
// import { logger } from '@/lib/logger';

export interface PostgresVectorDatabaseConfig extends VectorDatabaseConfig {
  provider: VectorDatabaseProvider.POSTGRES;
  schema?: string;
}

export class PostgresVectorDatabaseAdapter extends BaseVectorDatabaseAdapter {
  private prisma: PrismaClient | null = null;
  private cacheInvalidator: VectorCacheInvalidator | null = null;
  private readonly postgresConfig: PostgresVectorDatabaseConfig;

  constructor(config: PostgresVectorDatabaseConfig) {
    super(config);
    this.postgresConfig = { ...config };
  }

  protected async initializeProvider(): Promise<void> {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.postgresConfig.connectionString ?? process.env.VECTOR_DB_CONNECTION_STRING ?? process.env.DATABASE_URL,
        },
      },
      log: this.config.enableLogging ? ['warn', 'error'] : ['error'],
    });

    await this.prisma.$connect();

    if (this.config.cacheEnabled) {
      this.cacheInvalidator = VectorCacheInvalidator.getInstance();
      await this.cacheInvalidator.initialize();
    }
  }

  protected async closeProvider(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  protected async pingProvider(): Promise<boolean> {
    if (!this.prisma) {
      return false;
    }

    await this.prisma.$queryRaw`SELECT 1`;
    return true;
  }

  public async storeChunks(
    fileId: number,
    chunks: Array<{
      content: string;
      startLine?: number;
      endLine?: number;
      tokens: number;
    }>,
  ): Promise<void> {
    if (!this.prisma) {
      throw new Error('PostgreSQL adapter not initialized');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rAGChunk.deleteMany({ where: { file_id: fileId } });

      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const embedding = await this.generateEmbedding(chunk.content);
        const chunkId = `${fileId}-${index}`;

        await tx.$executeRawUnsafe(
          `
            INSERT INTO "rag_chunks" (file_id, chunk_id, content, start_line, end_line, tokens, embedding, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW(), NOW())
          `,
          fileId,
          chunkId,
          chunk.content,
          chunk.startLine ?? null,
          chunk.endLine ?? null,
          chunk.tokens,
          `[${embedding.join(', ')}]`,
          JSON.stringify({ chunkIndex: index }),
        );
      }
    });

    if (this.cacheInvalidator) {
      await this.cacheInvalidator.manuallyInvalidateCache('rag_chunks');
    }
  }

  public async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.prisma) {
      throw new Error('PostgreSQL adapter not initialized');
    }

    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0.7;

    if (this.config.cacheEnabled && options.useCache !== false) {
      try {
        const cached = await PgVectorSearch.findSimilarCode(embedding, {
          limit,
          minSimilarity: threshold,
          workspace: options.workspaceId ? String(options.workspaceId) : undefined,
          useCache: true,
        });

        if (cached.length > 0) {
          return cached.map((result) => ({
            chunk: {
              id: result.metadata?.chunk_id ?? result.id,
              content: result.content,
              embedding: [],
              metadata: {
                fileId: result.metadata?.file_id ?? 0,
                fileName: result.metadata?.path ?? '',
                startLine: result.metadata?.start_line ?? undefined,
                endLine: result.metadata?.end_line ?? undefined,
                language: result.metadata?.language ?? undefined,
                tokens: result.metadata?.tokens ?? 0,
              },
            },
            similarity: result.similarity,
          }));
        }
      } catch (error) {
        if (this.config.enableLogging) {
          console.warn('PgVector cache search failed; falling back to direct query', { error });
        }
      }
    }

    const distanceExpression = 'embedding <=> $1::vector';
    const similarityExpression = `1 - (${distanceExpression})`;

    const rows = await this.prisma.$queryRawUnsafe<Array<{
      chunk_id: string;
      content: string;
      start_line: number | null;
      end_line: number | null;
      tokens: number | null;
      file_id: number | null;
      similarity: number;
    }>>(
      `
        SELECT
          chunk_id,
          content,
          start_line,
          end_line,
          tokens,
          file_id,
          ${similarityExpression} AS similarity
        FROM "rag_chunks"
        WHERE ${similarityExpression} >= $2
        ORDER BY ${distanceExpression}
        LIMIT $3
      `,
      `[${embedding.join(', ')}]`,
      threshold,
      limit,
    );

    return rows.map((row) => ({
      chunk: {
        id: row.chunk_id,
        content: row.content,
        embedding: [],
        metadata: {
          fileId: row.file_id ?? 0,
          fileName: '',
          startLine: row.start_line ?? undefined,
          endLine: row.end_line ?? undefined,
          language: undefined,
          tokens: row.tokens ?? 0,
        },
      },
      similarity: row.similarity,
    }));
  }

  public async deleteFileChunks(fileId: number): Promise<void> {
    if (!this.prisma) {
      throw new Error('PostgreSQL adapter not initialized');
    }

    await this.prisma.rAGChunk.deleteMany({ where: { file_id: fileId } });
  }

  public async getStats(): Promise<{
    totalChunks: number;
    totalFiles: number;
    averageChunkSize: number;
  }> {
    if (!this.prisma) {
      throw new Error('PostgreSQL adapter not initialized');
    }

    const [aggregate, grouped] = await this.prisma.$transaction([
      this.prisma.rAGChunk.aggregate({
        _count: { id: true },
        _avg: { tokens: true },
      }),
      this.prisma.rAGChunk.groupBy({
        by: ['file_id'],
        _count: { file_id: true },
      }),
    ]);

    return {
      totalChunks: aggregate._count.id ?? 0,
      totalFiles: grouped.length,
      averageChunkSize: aggregate._avg.tokens ?? 0,
    };
  }

  public async invalidateCache(_table: string, contentType?: string): Promise<number> {
    if (!this.cacheInvalidator) {
      return 0;
    }

    return this.cacheInvalidator.manuallyInvalidateCache('rag_chunks', contentType);
  }

}

export default PostgresVectorDatabaseAdapter;
