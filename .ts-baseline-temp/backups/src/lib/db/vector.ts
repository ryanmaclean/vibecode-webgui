import { PrismaClient, Prisma } from '@prisma/client';

export class VectorService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or update a document embedding
   */
  async upsertEmbedding(params: {
    documentId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }) {
    const start = Date.now();
    
    const result = await this.prisma.$executeRaw`
      INSERT INTO document_embeddings (
        document_id, 
        content, 
        embedding, 
        metadata,
        embedding_generation_time_ms
      )
      VALUES (
        ${params.documentId},
        ${params.content},
        ${JSON.stringify(params.embedding)}::vector,
        ${params.metadata || {}}::jsonb,
        ${Date.now() - start}
      )
      ON CONFLICT (document_id) 
      DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        embedding_generation_time_ms = EXCLUDED.embedding_generation_time_ms,
        updated_at = NOW()
      RETURNING id;
    `;

    return result;
  }

  /**
   * Find similar documents using vector similarity search
   */
  async findSimilarDocuments(params: {
    embedding: number[];
    threshold?: number;
    limit?: number;
  }) {
    const { embedding, threshold = 0.7, limit = 5 } = params;

    const results = await this.prisma.$queryRaw<Array<{
      id: number;
      document_id: string;
      content: string;
      similarity: number;
    }>>`
      SELECT 
        id,
        document_id,
        content,
        1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
      FROM document_embeddings
      WHERE 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit};
    `;

    return results;
  }

  /**
   * Get embedding usage statistics
   */
  async getEmbeddingStats() {
    return this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', created_at) AS hour_bucket,
        COUNT(*) AS total_embeddings,
        AVG(LENGTH(content)) AS avg_content_length,
        AVG(embedding_generation_time_ms) AS avg_generation_time_ms,
        SUM(search_count) AS total_searches
      FROM document_embeddings
      GROUP BY hour_bucket
      ORDER BY hour_bucket DESC
      LIMIT 24;
    `;
  }

  /**
   * Clean up old embeddings
   */
  async cleanupOldEmbeddings(daysToKeep: number = 30) {
    const result = await this.prisma.$executeRaw`
      DELETE FROM document_embeddings
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days';
    `;

    return { deletedCount: result };
  }
}
