/**
 * Vector Store for RAG (Retrieval-Augmented Generation)
 * Handles vector embeddings and semantic search
 */

import OpenAI from 'openai'
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { EmbeddingServiceFactory, EmbeddingServiceType } from './ai/embeddingServiceFactory'
import { generateLocalEmbedding } from './ai/localEmbedding'
import { VectorConnectionPoolFactory, VectorConnectionPool } from './db/vector-connection-pool'

// Check if we're in build mode
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || 
                  process.argv.includes('build') ||
                  process.env.BUILDING === 'true'

interface VectorChunk {
  id: string
  content: string
  embedding: number[]
  metadata: {
    fileId: number
    fileName: string
    startLine?: number
    endLine?: number
    language?: string
    tokens: number
  }
}

interface SearchResult {
  chunk: VectorChunk
  similarity: number
}

class VectorStore {
  private openai: OpenAI | null = null
  private embeddingService: EmbeddingServiceType | null = null
  private embeddingProviderLabel = 'unconfigured'
  private openrouterEmbeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small'
  private useLocalEmbeddings = process.env.USE_LOCAL_EMBEDDINGS === 'true'
  private localEmbeddingDimensions = parseInt(process.env.LOCAL_EMBEDDING_DIM || '1536', 10)
  private connectionPool: VectorConnectionPool | null = null

  constructor() {
    // Initialize connection pool for vector operations
    this.initializeConnectionPool()

    if (!isBuilding && prisma) {
      try {
        if (this.useLocalEmbeddings) {
          this.embeddingProviderLabel = 'local-hash'
          this.embeddingService = null
        } else {
          const factory = new EmbeddingServiceFactory(prisma)
          this.embeddingService = factory.createEmbeddingServiceFromEnv()

          if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
            this.embeddingProviderLabel = 'azure-openai'
          } else if (process.env.OPENROUTER_API_KEY && process.env.OPENAI_API_KEY) {
            this.embeddingProviderLabel = 'openrouter-byok'
          } else if (process.env.OPENAI_API_KEY) {
            this.embeddingProviderLabel = 'openai'
          } else {
            this.embeddingProviderLabel = 'custom'
          }
        }
      } catch (error) {
        console.warn('Embedding service initialization failed; falling back to OpenRouter/local', error)
        this.embeddingService = null
      }
    }

    if (!this.useLocalEmbeddings && !this.embeddingService && process.env.OPENROUTER_API_KEY) {
      const allowBrowserClient = process.env.ALLOW_TEST_OPENAI === 'true' || process.env.NODE_ENV === 'test'
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        dangerouslyAllowBrowser: allowBrowserClient,
      })
      this.embeddingProviderLabel = 'openrouter'
    }
  }

  /**
   * Initialize vector database connection pool
   */
  private initializeConnectionPool(): void {
    if (isBuilding || !prisma) {
      return
    }

    try {
      // Get existing pool or create new one for vector operations
      this.connectionPool = VectorConnectionPoolFactory.getPool('vector-store') || null
      
      if (!this.connectionPool) {
        // Create connection pool with optimized settings for vector operations
        this.connectionPool = VectorConnectionPoolFactory.createPool(
          {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          },
          {
            min: 2,  // Minimum connections for vector operations
            max: 8,  // Maximum connections optimized for vector workloads
            acquireTimeoutMillis: 60000, // Longer timeout for vector queries
            idleTimeoutMillis: 300000,   // 5 minutes idle timeout
            testOnBorrow: true,
          },
          'vector-store'
        )
        
        console.log('Initialized vector database connection pool')
      }
    } catch (error) {
      console.warn('Failed to initialize vector connection pool, falling back to Prisma:', error)
      this.connectionPool = null
    }
  }

  /**
   * Generate embeddings for text content with performance tracking
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now()
    try {
      if (this.useLocalEmbeddings) {
        const embedding = generateLocalEmbedding(text, this.localEmbeddingDimensions)
        const duration = Date.now() - startTime
        console.log(`Embedding (local-hash) generated in ${duration}ms for ${text.length} chars`)
        return embedding
      }

      if (this.embeddingService) {
        const embedding = await this.embeddingService.generateEmbedding(text)
        const duration = Date.now() - startTime
        console.log(`Embedding (${this.embeddingProviderLabel}) generated in ${duration}ms for ${text.length} chars`)
        return embedding
      }

      if (!this.openai) {
        throw new Error('No embedding provider configured. Configure Azure/OpenAI/OpenRouter credentials.')
      }

      const response = await this.openai.embeddings.create({
        model: this.openrouterEmbeddingModel,
        input: text,
      })

      const duration = Date.now() - startTime
      console.log(`Embedding (openrouter) generated in ${duration}ms for ${text.length} chars`)

      return response.data[0].embedding
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`Error generating embedding after ${duration}ms:`, error)
      if (this.embeddingService && this.openai) {
        try {
          const response = await this.openai.embeddings.create({
            model: this.openrouterEmbeddingModel,
            input: text,
          })
          console.warn('Primary embedding provider failed; used openrouter fallback')
          return response.data[0].embedding
        } catch (fallbackError) {
          console.error('Fallback embedding generation failed:', fallbackError)
        }
      }
      return new Array(1536).fill(0)
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }

    magnitudeA = Math.sqrt(magnitudeA)
    magnitudeB = Math.sqrt(magnitudeB)

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0
    }

    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Store vector chunks in the database with connection pooling optimization
   */
  async storeChunks(fileId: number, chunks: Array<{
    content: string
    startLine?: number
    endLine?: number
    tokens: number
  }>): Promise<void> {
    if (isBuilding || !prisma) {
      console.log('Skipping vector storage during build')
      return
    }
    
    try {
      // Get file information first using connection pool if available
      const fileInfo = await (this.connectionPool ? 
        this.getFileInfoWithPool(fileId) : 
        prisma.file.findUnique({
          where: { id: fileId },
          select: {
            name: true,
            language: true,
            workspace_id: true,
            workspace: {
              select: {
                workspace_id: true,
                name: true
              }
            }
          }
        })
      )

      // Delete existing chunks using connection pool if available
      if (this.connectionPool) {
        await this.connectionPool.query(
          'DELETE FROM rag_chunks WHERE file_id = $1',
          [fileId]
        )
      } else {
        await prisma.rAGChunk.deleteMany({
          where: { file_id: fileId }
        })
      }

      console.log(`Processing ${chunks.length} chunks with ${this.connectionPool ? 'connection pooling' : 'Prisma'} for file ${fileId}`)

      // Process chunks in batches to optimize connection usage and avoid rate limits
      const batchSize = 5
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        
        // Use connection pooling for batch operations when available
        if (this.connectionPool) {
          await this.processBatchWithPool(batch, fileId, i, fileInfo)
        } else {
          await this.processBatchWithPrisma(batch, fileId, i, fileInfo)
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Stored ${chunks.length} vector chunks for file ${fileId}`)
    } catch (error) {
      console.error('Error storing vector chunks:', error)
      throw error
    }
  }

  /**
   * Get file info using connection pool
   */
  private async getFileInfoWithPool(fileId: number) {
    if (!this.connectionPool) {
      throw new Error('Connection pool not available')
    }

    const result = await this.connectionPool.query(`
      SELECT f.name, f.language, f.workspace_id, w.workspace_id as workspace_slug, w.name as workspace_name
      FROM files f
      LEFT JOIN workspaces w ON f.workspace_id = w.id
      WHERE f.id = $1
    `, [fileId])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      name: row.name,
      language: row.language,
      workspace_id: row.workspace_id,
      workspace: {
        workspace_id: row.workspace_slug,
        name: row.workspace_name
      }
    }
  }

  /**
   * Process batch of chunks using connection pool for optimal performance
   */
  private async processBatchWithPool(
    batch: Array<{ content: string; startLine?: number; endLine?: number; tokens: number }>,
    fileId: number,
    batchStartIndex: number,
    fileInfo: any
  ): Promise<void> {
    if (!this.connectionPool) {
      throw new Error('Connection pool not available')
    }

    // Use a transaction for batch operations to ensure atomicity
    await this.connectionPool.withTransaction(async (client) => {
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        const chunkId = `${fileId}-chunk-${batchStartIndex + j}`
        const embedding = await this.generateEmbedding(chunk.content)
        const embeddingString = `[${embedding.join(',')}]`
        
        // Insert with pgvector embedding using pooled connection
        await client.query(`
          INSERT INTO rag_chunks (file_id, chunk_id, content, start_line, end_line, tokens, embedding, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb, NOW())
        `, [
          fileId,
          chunkId,
          chunk.content,
          chunk.startLine || null,
          chunk.endLine || null,
          chunk.tokens,
          embeddingString,
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            provider: this.embeddingProviderLabel,
            workspaceSlug: fileInfo?.workspace?.workspace_id,
            workspaceId: fileInfo?.workspace_id,
            workspaceName: fileInfo?.workspace?.name,
            fileName: fileInfo?.name,
            language: fileInfo?.language
          })
        ])
      }
    })
  }

  /**
   * Process batch of chunks using Prisma (fallback method)
   */
  private async processBatchWithPrisma(
    batch: Array<{ content: string; startLine?: number; endLine?: number; tokens: number }>,
    fileId: number,
    batchStartIndex: number,
    fileInfo: any
  ): Promise<void> {
    // Process each chunk individually to handle pgvector embedding insertion
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const chunkId = `${fileId}-chunk-${batchStartIndex + j}`
      const embedding = await this.generateEmbedding(chunk.content)
      const embeddingString = `[${embedding.join(',')}]`
      
      // Use raw SQL to insert with pgvector embedding
      await prisma.$executeRawUnsafe(`
        INSERT INTO rag_chunks (file_id, chunk_id, content, start_line, end_line, tokens, embedding, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb, NOW())
      `, 
        fileId,
        chunkId,
        chunk.content,
        chunk.startLine || null,
        chunk.endLine || null,
        chunk.tokens,
        embeddingString,
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          provider: this.embeddingProviderLabel,
          workspaceSlug: fileInfo?.workspace?.workspace_id,
          workspaceId: fileInfo?.workspace_id,
          workspaceName: fileInfo?.workspace?.name,
          fileName: fileInfo?.name,
          language: fileInfo?.language
        })
      )
    }
  }

  /**
   * Search for similar content using pgvector similarity with connection pooling optimization
   */
  async search(
    query: string, 
    options: {
      workspaceId?: number
      fileIds?: number[]
      limit?: number
      threshold?: number
    } = {}
  ): Promise<SearchResult[]> {
    if (isBuilding || !prisma) {
      console.log('Skipping vector search during build')
      return []
    }
    
    try {
      const { workspaceId, fileIds, limit = 10, threshold = 0.7 } = options

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query)
      const embeddingString = `[${queryEmbedding.join(',')}]`

      // Use connection pooling for vector search when available
      if (this.connectionPool) {
        return await this.searchWithPool(queryEmbedding, embeddingString, { workspaceId, fileIds, limit, threshold }, query)
      } else {
        return await this.searchWithPrisma(embeddingString, { workspaceId, fileIds, limit, threshold }, query)
      }
    } catch (error) {
      console.error('Error in vector search:', error)
      // Fallback to simple text search if vector search fails
      return this.fallbackTextSearch(query, options)
    }
  }

  /**
   * Execute vector search using connection pool
   */
  private async searchWithPool(
    queryEmbedding: number[],
    embeddingString: string,
    options: { workspaceId?: number; fileIds?: number[]; limit: number; threshold: number },
    query: string
  ): Promise<SearchResult[]> {
    if (!this.connectionPool) {
      throw new Error('Connection pool not available')
    }

    const { workspaceId, fileIds, limit, threshold } = options

    // Build WHERE clause for filtering
    const whereConditions: string[] = []
    const params: (string | number | number[])[] = [embeddingString, embeddingString, limit] // embedding used twice in the query
    let paramIndex = 4

    if (workspaceId) {
      whereConditions.push(`f.workspace_id = $${paramIndex}`)
      params.push(workspaceId)
      paramIndex++
    }

    if (fileIds && fileIds.length > 0) {
      whereConditions.push(`rc.file_id = ANY($${paramIndex}::int[])`)
      params.push(fileIds)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Optimized pgvector query using connection pool for fast similarity search
    const sql = `
      SELECT 
        rc.chunk_id,
        rc.content,
        rc.start_line,
        rc.end_line,
        rc.tokens,
        rc.file_id,
        f.name as file_name,
        f.language,
        (1 - (rc.embedding <=> $1::vector)) as similarity
      FROM rag_chunks rc
      JOIN files f ON rc.file_id = f.id
      ${whereClause}
      ORDER BY rc.embedding <=> $2::vector
      LIMIT $3
    `

    const result = await this.connectionPool.query(sql, params)

    // Filter by threshold and format results
    const results: SearchResult[] = result.rows
      .filter((row: any) => row.similarity >= threshold)
      .map((row: any) => ({
        chunk: {
          id: row.chunk_id,
          content: row.content,
          embedding: [], // Don't return embedding in response for performance
          metadata: {
            fileId: row.file_id,
            fileName: row.file_name,
            startLine: row.start_line || undefined,
            endLine: row.end_line || undefined,
            language: row.language || undefined,
            tokens: row.tokens || 0
          }
        },
        similarity: row.similarity
      }))

    console.log(`Vector search (pooled) found ${results.length} relevant chunks for query: "${query.substring(0, 100)}..."`)
    return results
  }

  /**
   * Execute vector search using Prisma (fallback method)
   */
  private async searchWithPrisma(
    embeddingString: string,
    options: { workspaceId?: number; fileIds?: number[]; limit: number; threshold: number },
    query: string
  ): Promise<SearchResult[]> {
    const { workspaceId, fileIds, limit, threshold } = options

    // Build WHERE clause for filtering
    const whereConditions: string[] = []
    const params: (string | number | number[])[] = []
    let paramIndex = 1

    if (workspaceId) {
      whereConditions.push(`f.workspace_id = $${paramIndex}`)
      params.push(workspaceId)
      paramIndex++
    }

    if (fileIds && fileIds.length > 0) {
      whereConditions.push(`rc.file_id = ANY($${paramIndex}::int[])`)
      params.push(`{${fileIds.join(',')}}`)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Add embedding parameter
    const embeddingParamIndex = paramIndex++
    const limitParamIndex = paramIndex++

    // Use pgvector for fast similarity search with cosine distance
    const sql = `
      SELECT 
        rc.chunk_id,
        rc.content,
        rc.start_line,
        rc.end_line,
        rc.tokens,
        rc.file_id,
        f.name as file_name,
        f.language,
        (1 - (rc.embedding <=> $${embeddingParamIndex}::vector)) as similarity
      FROM rag_chunks rc
      JOIN files f ON rc.file_id = f.id
      ${whereClause}
      ORDER BY rc.embedding <=> $${embeddingParamIndex}::vector
      LIMIT $${limitParamIndex}
    `

    // Add parameters in the correct order
    params.push(embeddingString, limit)

    // Define interface for raw SQL result
    interface RawResult {
      chunk_id: string
      content: string
      start_line: number | null
      end_line: number | null
      tokens: number
      file_id: number
      file_name: string
      language: string | null
      similarity: number
    }

    // Execute raw SQL query using Prisma
    const rawResults = await prisma.$queryRawUnsafe(sql, ...params) as RawResult[]

    // Filter by threshold and format results
    const results: SearchResult[] = rawResults
      .filter((row) => row.similarity >= threshold)
      .map((row) => ({
        chunk: {
          id: row.chunk_id,
          content: row.content,
          embedding: [], // Don't return embedding in response for performance
          metadata: {
            fileId: row.file_id,
            fileName: row.file_name,
            startLine: row.start_line || undefined,
            endLine: row.end_line || undefined,
            language: row.language || undefined,
            tokens: row.tokens || 0
          }
        },
        similarity: row.similarity
      }))

    console.log(`Vector search found ${results.length} relevant chunks for query: "${query.substring(0, 100)}..."`)
    
    return results
  }

  /**
   * Fallback text search when vector search is not available
   */
  private async fallbackTextSearch(
    query: string,
    options: {
      workspaceId?: number
      fileIds?: number[]
      limit?: number
    }
  ): Promise<SearchResult[]> {
    if (isBuilding || !prisma) {
      return []
    }
    
    try {
      const { workspaceId, fileIds, limit = 10 } = options

      const whereClause: any = {
        content: {
          contains: query,
          mode: 'insensitive' as any
        }
      }
      
      if (workspaceId) {
        whereClause.file = { is: { workspace_id: workspaceId } }
      }
      
      if (fileIds && fileIds.length > 0) {
        whereClause.file_id = { in: fileIds }
      }

      const chunks = await prisma.rAGChunk.findMany({
        where: whereClause,
        include: {
          file: {
            select: {
              id: true,
              name: true,
              language: true
            }
          }
        },
        take: limit,
        orderBy: {
          created_at: 'desc'
        }
      })

      return chunks.filter(chunk => chunk.chunk_id && chunk.file_id && chunk.file).map(chunk => ({
        chunk: {
          id: chunk.chunk_id!,
          content: chunk.content,
          embedding: [],
          metadata: {
            fileId: chunk.file_id!,
            fileName: chunk.file!.name,
            startLine: chunk.start_line || undefined,
            endLine: chunk.end_line || undefined,
            language: chunk.file!.language || undefined,
            tokens: chunk.tokens || 0
          }
        },
        similarity: 0.5 // Default similarity for text search
      }))
    } catch (error) {
      console.error('Error in fallback text search:', error)
      return []
    }
  }

  /**
   * Get relevant context for AI prompts
   */
  async getContext(
    query: string,
    workspaceId?: number,
    maxTokens: number = 4000,
    threshold?: number
  ): Promise<string> {
    try {
      const results = await this.search(query, { workspaceId, limit: 20, threshold })
      
      if (results.length === 0) {
        return ''
      }

      let context = ''
      let tokenCount = 0

      for (const result of results) {
        const chunkText = `\n--- ${result.chunk.metadata.fileName} (lines ${result.chunk.metadata.startLine}-${result.chunk.metadata.endLine}) ---\n${result.chunk.content}\n`
        
        if (tokenCount + result.chunk.metadata.tokens > maxTokens) {
          break
        }

        context += chunkText
        tokenCount += result.chunk.metadata.tokens
      }

      return context
    } catch (error) {
      console.error('Error getting context:', error)
      return ''
    }
  }

  /**
   * Delete all chunks for a file using connection pooling when available
   */
  async deleteFileChunks(fileId: number): Promise<void> {
    if (isBuilding || !prisma) {
      console.log('Skipping delete during build')
      return
    }
    
    try {
      if (this.connectionPool) {
        // Use connection pooling for delete operation
        await this.connectionPool.query(
          'DELETE FROM rag_chunks WHERE file_id = $1',
          [fileId]
        )
        console.log(`Deleted vector chunks for file ${fileId} (using connection pool)`)
      } else {
        // Fallback to Prisma
        await prisma.rAGChunk.deleteMany({
          where: { file_id: fileId }
        })
        console.log(`Deleted vector chunks for file ${fileId}`)
      }
    } catch (error) {
      console.error('Error deleting file chunks:', error)
      throw error
    }
  }

  /**
   * Get statistics about the vector store with connection pooling optimization
   */
  async getStats(): Promise<{
    totalChunks: number
    totalFiles: number
    averageChunkSize: number
  }> {
    if (isBuilding || !prisma) {
      console.log('Skipping stats during build')
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      }
    }
    
    try {
      if (this.connectionPool) {
        // Use connection pooling for statistics queries
        const [chunksResult, filesResult, avgResult] = await Promise.all([
          this.connectionPool.query('SELECT COUNT(*) as total FROM rag_chunks'),
          this.connectionPool.query('SELECT COUNT(DISTINCT file_id) as total FROM rag_chunks'),
          this.connectionPool.query('SELECT AVG(tokens) as avg_tokens FROM rag_chunks WHERE tokens IS NOT NULL')
        ])

        return {
          totalChunks: parseInt(chunksResult.rows[0].total),
          totalFiles: parseInt(filesResult.rows[0].total),
          averageChunkSize: parseFloat(avgResult.rows[0].avg_tokens) || 0
        }
      } else {
        // Fallback to Prisma
        const totalChunks = await prisma.rAGChunk.count()
        const totalFiles = await prisma.rAGChunk.groupBy({
          by: ['file_id'],
          _count: true
        })

        const avgTokens = await prisma.rAGChunk.aggregate({
          _avg: {
            tokens: true
          }
        })

        return {
          totalChunks,
          totalFiles: totalFiles.length,
          averageChunkSize: avgTokens._avg.tokens || 0
        }
      }
    } catch (error) {
      console.error('Error getting vector store stats:', error)
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      }
    }
  }

  /**
   * Get connection pool metrics for monitoring
   */
  getConnectionPoolMetrics(): any {
    if (!this.connectionPool) {
      return {
        available: false,
        reason: 'Connection pool not initialized'
      }
    }

    const status = this.connectionPool.getStatus()
    const metrics = this.connectionPool.getMetrics()

    return {
      available: true,
      status,
      metrics: {
        totalCreated: metrics.totalCreated,
        totalAcquired: metrics.totalAcquired,
        totalReleased: metrics.totalReleased,
        totalErrors: metrics.totalErrors,
        avgAcquireTime: metrics.avgAcquireTime,
        utilization: metrics.utilization
      }
    }
  }

  /**
   * Perform health check on connection pool
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    if (!this.connectionPool) {
      return {
        healthy: false,
        details: { error: 'Connection pool not available' }
      }
    }

    try {
      const isHealthy = await this.connectionPool.healthCheck()
      const metrics = this.connectionPool.getMetrics()
      
      return {
        healthy: isHealthy,
        details: {
          poolStatus: this.connectionPool.getStatus(),
          metrics: {
            activeConnections: metrics.activeConnections,
            availableConnections: metrics.availableConnections,
            utilization: metrics.utilization,
            totalErrors: metrics.totalErrors,
            avgAcquireTime: metrics.avgAcquireTime
          }
        }
      }
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}

// Export singleton instance
export const vectorStore = new VectorStore()
export default vectorStore
