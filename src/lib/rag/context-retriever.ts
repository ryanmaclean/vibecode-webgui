/**
 * RAG Context Retriever for AI Chat Integration
 * Retrieves relevant codebase context using pgvector semantic search
 */

import { prisma } from '../prisma'
import { EmbeddingServiceFactory, EmbeddingServiceType } from '../ai/embeddingServiceFactory'
import { createServiceLogger } from '../logging'

// Check if we're in build mode
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' ||
                  process.argv.includes('build') ||
                  process.env.BUILDING === 'true'

/**
 * Code chunk result from semantic search
 */
export interface CodeChunkResult {
  id: number
  content: string
  similarity: number
  filePath: string
  fileName: string
  language: string
  startLine: number | null
  endLine: number | null
  chunkIndex: number | null
  metadata?: Record<string, any>
}

/**
 * Context retrieval options
 */
export interface ContextRetrievalOptions {
  projectId: number
  limit?: number // Number of chunks to retrieve (default: 5)
  minSimilarity?: number // Minimum similarity threshold (default: 0.7)
  includeMetadata?: boolean // Include full metadata in results (default: false)
}

/**
 * Formatted context for AI prompts
 */
export interface FormattedContext {
  contextText: string // Formatted context for prompt injection
  chunks: CodeChunkResult[] // Original chunks for reference
  totalChunks: number
  avgSimilarity: number
}

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'context-retriever'
})

/**
 * ContextRetriever handles RAG-powered context retrieval for AI chat
 */
export class ContextRetriever {
  private embeddingService: EmbeddingServiceType | null = null
  private embeddingProviderLabel = 'unconfigured'

  constructor() {
    if (!isBuilding && prisma) {
      try {
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

        log.info('ContextRetriever initialized', {
          embeddingProvider: this.embeddingProviderLabel
        })
      } catch (error) {
        log.warn('Embedding service initialization failed for context retrieval', { error })
        this.embeddingService = null
      }
    }
  }

  /**
   * Retrieve relevant code context for a query
   */
  async retrieveContext(
    query: string,
    options: ContextRetrievalOptions
  ): Promise<CodeChunkResult[]> {
    const {
      projectId,
      limit = 5,
      minSimilarity = 0.7,
      includeMetadata = false
    } = options

    if (!this.embeddingService) {
      log.error('Embedding service not available for context retrieval')
      throw new Error('Embedding service not configured')
    }

    if (!query || query.trim().length === 0) {
      log.warn('Empty query provided to context retriever')
      return []
    }

    try {
      log.debug('Retrieving context', {
        projectId,
        query: query.substring(0, 100),
        limit,
        minSimilarity
      })

      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query)
      const embeddingString = `[${queryEmbedding.join(',')}]`

      // Perform vector similarity search using cosine distance
      // pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
      const results = await prisma.$queryRaw<Array<{
        id: number
        content: string
        metadata: { filePath?: string; fileName?: string; language?: string; [key: string]: any }
        start_line: number | null
        end_line: number | null
        chunk_index: number | null
        distance: number
      }>>`
        SELECT
          id,
          content,
          metadata,
          start_line,
          end_line,
          chunk_index,
          (embedding <=> ${embeddingString}::vector) as distance
        FROM rag_chunks
        WHERE project_id = ${projectId}
        ORDER BY embedding <=> ${embeddingString}::vector
        LIMIT ${limit * 2}
      `

      // Convert distance to similarity score and filter by threshold
      const codeChunks: CodeChunkResult[] = results
        .map(row => {
          // Convert cosine distance to similarity: 1 - (distance / 2)
          // Distance range is [0, 2], similarity range is [0, 1]
          const similarity = 1 - (row.distance / 2)

          return {
            id: row.id,
            content: row.content,
            similarity,
            filePath: row.metadata?.filePath || 'unknown',
            fileName: row.metadata?.fileName || 'unknown',
            language: row.metadata?.language || 'unknown',
            startLine: row.start_line,
            endLine: row.end_line,
            chunkIndex: row.chunk_index,
            ...(includeMetadata && { metadata: row.metadata })
          }
        })
        .filter(result => result.similarity >= minSimilarity)
        .slice(0, limit)

      log.info('Context retrieval completed', {
        projectId,
        query: query.substring(0, 100),
        resultsCount: codeChunks.length,
        topSimilarity: codeChunks[0]?.similarity
      })

      return codeChunks
    } catch (error) {
      log.error('Context retrieval failed', {
        error,
        projectId,
        query: query.substring(0, 100)
      })
      throw error
    }
  }

  /**
   * Format retrieved context for AI prompt injection
   */
  formatContextForPrompt(chunks: CodeChunkResult[]): FormattedContext {
    if (chunks.length === 0) {
      return {
        contextText: '',
        chunks: [],
        totalChunks: 0,
        avgSimilarity: 0
      }
    }

    // Calculate average similarity
    const totalSimilarity = chunks.reduce((sum, chunk) => sum + chunk.similarity, 0)
    const avgSimilarity = totalSimilarity / chunks.length

    // Format chunks into context text
    const contextParts: string[] = []
    contextParts.push('=== Relevant Codebase Context ===\n')
    contextParts.push(`Found ${chunks.length} relevant code chunk(s):\n`)

    chunks.forEach((chunk, index) => {
      const lineInfo = chunk.startLine && chunk.endLine
        ? `:${chunk.startLine}-${chunk.endLine}`
        : ''
      const similarityPercent = (chunk.similarity * 100).toFixed(1)

      contextParts.push(`\n--- [${index + 1}] ${chunk.filePath}${lineInfo} (${similarityPercent}% relevant) ---`)
      contextParts.push(`Language: ${chunk.language}`)
      contextParts.push(`\`\`\`${chunk.language}`)
      contextParts.push(chunk.content)
      contextParts.push('```')
    })

    contextParts.push('\n=== End Codebase Context ===\n')

    const contextText = contextParts.join('\n')

    log.debug('Context formatted for prompt', {
      totalChunks: chunks.length,
      avgSimilarity,
      contextLength: contextText.length
    })

    return {
      contextText,
      chunks,
      totalChunks: chunks.length,
      avgSimilarity
    }
  }

  /**
   * Retrieve and format context in one call
   */
  async getFormattedContext(
    query: string,
    options: ContextRetrievalOptions
  ): Promise<FormattedContext> {
    const chunks = await this.retrieveContext(query, options)
    return this.formatContextForPrompt(chunks)
  }

  /**
   * Check if context retrieval is available
   */
  isAvailable(): boolean {
    return this.embeddingService !== null
  }

  /**
   * Get embedding provider information
   */
  getProviderInfo(): {
    available: boolean
    provider: string
  } {
    return {
      available: this.embeddingService !== null,
      provider: this.embeddingProviderLabel
    }
  }

  /**
   * Get indexing statistics for a project
   */
  async getProjectStats(projectId: number): Promise<{
    totalChunks: number
    totalFiles: number
    languages: Record<string, number>
  }> {
    try {
      const chunks = await prisma.rAGChunk.findMany({
        where: { project_id: projectId },
        select: {
          metadata: true
        }
      })

      const totalChunks = chunks.length

      // Count unique files
      const uniqueFiles = new Set(
        chunks
          .map(chunk => (chunk.metadata as any)?.filePath)
          .filter(Boolean)
      )
      const totalFiles = uniqueFiles.size

      // Count by language
      const languages: Record<string, number> = {}
      chunks.forEach(chunk => {
        const language = (chunk.metadata as any)?.language || 'unknown'
        languages[language] = (languages[language] || 0) + 1
      })

      log.debug('Project stats retrieved', {
        projectId,
        totalChunks,
        totalFiles,
        languages
      })

      return {
        totalChunks,
        totalFiles,
        languages
      }
    } catch (error) {
      log.error('Failed to retrieve project stats', { error, projectId })
      throw error
    }
  }
}

// Singleton instance for convenience
let _contextRetrieverInstance: ContextRetriever | null = null

export function getContextRetriever(): ContextRetriever {
  if (!_contextRetrieverInstance) {
    _contextRetrieverInstance = new ContextRetriever()
  }
  return _contextRetrieverInstance
}

// Export singleton instance as default
export const contextRetriever = getContextRetriever()
