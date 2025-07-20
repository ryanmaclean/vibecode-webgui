/**
 * Vector Store for RAG (Retrieval-Augmented Generation)
 * Handles vector embeddings and semantic search
 */

import OpenAI from 'openai'
import { prisma } from './prisma'

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

  constructor() {
    // Initialize OpenAI client for embeddings
    if (process.env.OPENROUTER_API_KEY) {
      this.openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      })
    }
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Check OPENROUTER_API_KEY')
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Using OpenAI embedding model via OpenRouter
        input: text,
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating embedding:', error)
      // Fallback: return zero vector
      return new Array(1536).fill(0) // text-embedding-3-small returns 1536-dimensional vectors
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
   * Store vector chunks in the database
   */
  async storeChunks(fileId: number, chunks: Array<{
    content: string
    startLine?: number
    endLine?: number
    tokens: number
  }>): Promise<void> {
    try {
      // Delete existing chunks for this file
      await prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      })

      // Process chunks in batches to avoid rate limits
      const batchSize = 5
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        
        // Process each chunk individually to handle pgvector embedding insertion
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]
          const chunkId = `${fileId}-chunk-${i + j}`
          const embedding = await this.generateEmbedding(chunk.content)
          const embeddingString = `[${embedding.join(',')}]`
          
          // Use raw SQL to insert with pgvector embedding
          await prisma.$executeRawUnsafe(`
            INSERT INTO rag_chunks (file_id, chunk_id, content, start_line, end_line, tokens, embedding, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, NOW())
          `, 
            fileId,
            chunkId,
            chunk.content,
            chunk.startLine || null,
            chunk.endLine || null,
            chunk.tokens,
            embeddingString,
            JSON.stringify({ generatedAt: new Date().toISOString() })
          )
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
   * Search for similar content using pgvector similarity
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
    try {
      const { workspaceId, fileIds, limit = 10, threshold = 0.7 } = options

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query)
      const embeddingString = `[${queryEmbedding.join(',')}]`

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
      const rawResults = await prisma.$queryRawUnsafe<RawResult[]>(sql, ...params)

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
          similarity: parseFloat(row.similarity)
        }))

      console.log(`Vector search found ${results.length} relevant chunks for query: "${query.substring(0, 100)}..."`)
      
      return results
    } catch (error) {
      console.error('Error in vector search:', error)
      // Fallback to simple text search if vector search fails
      return this.fallbackTextSearch(query, options)
    }
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
    try {
      const { workspaceId, fileIds, limit = 10 } = options

      const whereClause: {
        content: { contains: string; mode: string }
        file?: { workspace_id: number }
        file_id?: { in: number[] }
      } = {
        content: {
          contains: query,
          mode: 'insensitive'
        }
      }
      
      if (workspaceId) {
        whereClause.file = {
          workspace_id: workspaceId
        }
      }
      
      if (fileIds && fileIds.length > 0) {
        whereClause.file_id = {
          in: fileIds
        }
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

      return chunks.map(chunk => ({
        chunk: {
          id: chunk.chunk_id,
          content: chunk.content,
          embedding: [],
          metadata: {
            fileId: chunk.file_id,
            fileName: chunk.file.name,
            startLine: chunk.start_line || undefined,
            endLine: chunk.end_line || undefined,
            language: chunk.file.language || undefined,
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
    maxTokens: number = 4000
  ): Promise<string> {
    try {
      const results = await this.search(query, { workspaceId, limit: 20 })
      
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
   * Delete all chunks for a file
   */
  async deleteFileChunks(fileId: number): Promise<void> {
    try {
      await prisma.rAGChunk.deleteMany({
        where: { file_id: fileId }
      })
      console.log(`Deleted vector chunks for file ${fileId}`)
    } catch (error) {
      console.error('Error deleting file chunks:', error)
      throw error
    }
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<{
    totalChunks: number
    totalFiles: number
    averageChunkSize: number
  }> {
    try {
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
    } catch (error) {
      console.error('Error getting vector store stats:', error)
      return {
        totalChunks: 0,
        totalFiles: 0,
        averageChunkSize: 0
      }
    }
  }
}

// Export singleton instance
export const vectorStore = new VectorStore()
export default vectorStore