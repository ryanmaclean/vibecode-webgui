/**
 * Codebase Indexer for Full Project Semantic Search
 * Automatically indexes entire codebase into pgvector for semantic understanding
 */

import crypto from 'crypto'
import { prisma } from '../prisma'
import { CodeChunker, CodeChunk } from './code-chunker'
import { EmbeddingServiceFactory, EmbeddingServiceType } from '../ai/embeddingServiceFactory'
import fs from 'fs/promises'
import path from 'path'

// Check if we're in build mode
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' ||
                  process.argv.includes('build') ||
                  process.env.BUILDING === 'true'

/**
 * File indexing metadata
 */
export interface FileIndexMetadata {
  filePath: string
  fileHash: string
  language: string
  chunkCount: number
  indexedAt: Date
  lastModifiedAt: Date
}

/**
 * Project indexing status
 */
export interface IndexingStatus {
  projectId: number
  totalFiles: number
  indexedFiles: number
  progress: number // Percentage 0-100
  isIndexing: boolean
  lastIndexedAt?: Date
  totalChunks: number
}

/**
 * Indexing result for a single file
 */
export interface IndexingResult {
  success: boolean
  filePath: string
  chunkCount: number
  error?: string
}

/**
 * CodebaseIndexer handles indexing of entire project codebases
 */
export class CodebaseIndexer {
  private codeChunker: CodeChunker
  private embeddingService: EmbeddingServiceType | null = null
  private embeddingProviderLabel = 'unconfigured'
  private indexingInProgress = new Set<number>() // Track projects being indexed

  constructor() {
    this.codeChunker = new CodeChunker()

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
      } catch (error) {
        console.warn('Embedding service initialization failed for codebase indexing', error)
        this.embeddingService = null
      }
    }
  }

  /**
   * Calculate file hash for change detection
   */
  private calculateFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Generate embedding for chunk content
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not initialized. Check API configuration.')
    }

    const startTime = Date.now()
    try {
      const embedding = await this.embeddingService.generateEmbedding(content)
      const duration = Date.now() - startTime
      console.log(`Embedding (${this.embeddingProviderLabel}) generated in ${duration}ms for ${content.length} chars`)
      return embedding
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`Error generating embedding after ${duration}ms:`, error)
      throw error
    }
  }

  /**
   * Index a single file
   * @param filePath - Path to the file to index
   * @param workspaceId - Workspace ID
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns Indexing result
   */
  async indexFile(
    filePath: string,
    workspaceId: number,
    projectId: number,
    userId: number
  ): Promise<IndexingResult> {
    if (isBuilding || !prisma) {
      console.log('Skipping indexing during build')
      return { success: false, filePath, chunkCount: 0, error: 'Build mode' }
    }

    const startTime = Date.now()

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8')
      const fileHash = this.calculateFileHash(content)
      const language = this.codeChunker.detectLanguage(filePath)

      // Get last modified time
      const stats = await fs.stat(filePath)
      const lastModifiedAt = stats.mtime

      // Check if file is already indexed with same hash (unchanged)
      const existingIndex = await prisma.codebaseIndex.findFirst({
        where: {
          file_path: filePath,
          project_id: projectId,
          file_hash: fileHash,
        },
      })

      if (existingIndex) {
        console.log(`File ${filePath} already indexed with same content, skipping`)
        return { success: true, filePath, chunkCount: existingIndex.chunk_count }
      }

      // Chunk the file
      const chunks = this.codeChunker.chunkFile(filePath, content)

      if (chunks.length === 0) {
        console.log(`File ${filePath} produced no chunks, skipping`)
        return { success: true, filePath, chunkCount: 0 }
      }

      // Find or create File record
      let fileRecord = await prisma.file.findFirst({
        where: {
          name: path.basename(filePath),
          workspace_id: workspaceId,
          project_id: projectId,
        },
      })

      if (!fileRecord) {
        // Create file record if it doesn't exist
        fileRecord = await prisma.file.create({
          data: {
            name: path.basename(filePath),
            path: filePath,
            workspace_id: workspaceId,
            project_id: projectId,
            user_id: userId,
            language: language,
            content: content,
          },
        })
      }

      // Delete existing RAG chunks for this file
      await prisma.rAGChunk.deleteMany({
        where: { file_id: fileRecord.id },
      })

      // Process chunks in batches to avoid rate limits
      const batchSize = 5
      let successfulChunks = 0

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)

        // Process each chunk individually for pgvector embedding insertion
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]
          const chunkIndex = i + j

          try {
            const embedding = await this.generateEmbedding(chunk.content)

            // Store chunk with embedding
            await prisma.$executeRaw`
              INSERT INTO rag_chunks (
                content,
                metadata,
                file_id,
                user_id,
                workspace_id,
                project_id,
                chunk_index,
                token_count,
                start_line,
                end_line,
                tokens,
                chunk_id,
                embedding,
                created_at,
                updated_at
              ) VALUES (
                ${chunk.content},
                ${JSON.stringify({
                  fileName: path.basename(filePath),
                  language: chunk.language,
                  hasImports: chunk.hasImports,
                  filePath: filePath,
                })}::jsonb,
                ${fileRecord.id},
                ${userId},
                ${workspaceId},
                ${projectId},
                ${chunkIndex},
                ${chunk.tokens},
                ${chunk.startLine},
                ${chunk.endLine},
                ${chunk.tokens},
                ${`${fileRecord.id}-chunk-${chunkIndex}`},
                ${JSON.stringify(embedding)}::vector(1536),
                NOW(),
                NOW()
              )
            `

            successfulChunks++
          } catch (error) {
            console.error(`Error processing chunk ${chunkIndex} of ${filePath}:`, error)
            // Continue with other chunks
          }
        }
      }

      // Update or create CodebaseIndex record
      const existingCodebaseIndex = await prisma.codebaseIndex.findFirst({
        where: {
          user_id: userId,
          workspace_id: workspaceId,
          project_id: projectId,
          file_path: filePath,
        },
      })

      if (existingCodebaseIndex) {
        await prisma.codebaseIndex.update({
          where: { id: existingCodebaseIndex.id },
          data: {
            file_hash: fileHash,
            language: language,
            chunk_count: successfulChunks,
            indexed_at: new Date(),
            last_modified_at: lastModifiedAt,
          },
        })
      } else {
        await prisma.codebaseIndex.create({
          data: {
            file_path: filePath,
            file_hash: fileHash,
            user_id: userId,
            workspace_id: workspaceId,
            project_id: projectId,
            language: language,
            chunk_count: successfulChunks,
            indexed_at: new Date(),
            last_modified_at: lastModifiedAt,
          },
        })
      }

      const duration = Date.now() - startTime
      console.log(`Indexed ${filePath}: ${successfulChunks} chunks in ${duration}ms`)

      return { success: true, filePath, chunkCount: successfulChunks }
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`Error indexing file ${filePath} after ${duration}ms:`, error)
      return {
        success: false,
        filePath,
        chunkCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Index all files in a project
   * @param projectId - Project ID
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @param projectPath - Root path of the project
   * @param onProgress - Callback for progress updates
   * @returns Array of indexing results
   */
  async indexProject(
    projectId: number,
    workspaceId: number,
    userId: number,
    projectPath: string,
    onProgress?: (current: number, total: number, currentFile: string) => void
  ): Promise<IndexingResult[]> {
    if (isBuilding || !prisma) {
      console.log('Skipping project indexing during build')
      return []
    }

    if (this.indexingInProgress.has(projectId)) {
      throw new Error(`Project ${projectId} is already being indexed`)
    }

    this.indexingInProgress.add(projectId)

    try {
      const startTime = Date.now()
      console.log(`Starting full codebase indexing for project ${projectId}`)

      // Get all source files (this will be enhanced in subtask-3-2)
      const files = await this.findSourceFiles(projectPath)
      console.log(`Found ${files.length} source files to index`)

      const results: IndexingResult[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (onProgress) {
          onProgress(i + 1, files.length, file)
        }

        const result = await this.indexFile(file, workspaceId, projectId, userId)
        results.push(result)
      }

      const duration = Date.now() - startTime
      const successCount = results.filter(r => r.success).length
      const totalChunks = results.reduce((sum, r) => sum + r.chunkCount, 0)

      console.log(
        `Project indexing complete: ${successCount}/${files.length} files, ` +
        `${totalChunks} chunks in ${duration}ms`
      )

      return results
    } finally {
      this.indexingInProgress.delete(projectId)
    }
  }

  /**
   * Update index for a changed file
   * @param filePath - Path to the changed file
   * @param workspaceId - Workspace ID
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns Indexing result
   */
  async updateIndex(
    filePath: string,
    workspaceId: number,
    projectId: number,
    userId: number
  ): Promise<IndexingResult> {
    // updateIndex is the same as indexFile - it will detect hash changes
    // and re-index if needed
    return this.indexFile(filePath, workspaceId, projectId, userId)
  }

  /**
   * Delete index for a file
   * @param filePath - Path to the file
   * @param projectId - Project ID
   * @returns Success status
   */
  async deleteIndex(filePath: string, projectId: number): Promise<boolean> {
    if (isBuilding || !prisma) {
      console.log('Skipping delete during build')
      return false
    }

    try {
      // Find the CodebaseIndex record
      const indexRecord = await prisma.codebaseIndex.findFirst({
        where: {
          file_path: filePath,
          project_id: projectId,
        },
      })

      if (!indexRecord) {
        console.log(`No index found for ${filePath}`)
        return true // Already deleted
      }

      // Delete the CodebaseIndex record
      await prisma.codebaseIndex.delete({
        where: { id: indexRecord.id },
      })

      // Find the File record and delete associated RAG chunks
      const fileRecord = await prisma.file.findFirst({
        where: {
          path: filePath,
          project_id: projectId,
        },
      })

      if (fileRecord) {
        await prisma.rAGChunk.deleteMany({
          where: { file_id: fileRecord.id },
        })
      }

      console.log(`Deleted index for ${filePath}`)
      return true
    } catch (error) {
      console.error(`Error deleting index for ${filePath}:`, error)
      return false
    }
  }

  /**
   * Get indexing status for a project
   * @param projectId - Project ID
   * @returns Indexing status
   */
  async getIndexStatus(projectId: number): Promise<IndexingStatus> {
    if (isBuilding || !prisma) {
      return {
        projectId,
        totalFiles: 0,
        indexedFiles: 0,
        progress: 0,
        isIndexing: false,
        totalChunks: 0,
      }
    }

    try {
      // Get all indexed files for this project
      const indexedFiles = await prisma.codebaseIndex.findMany({
        where: { project_id: projectId },
        select: {
          chunk_count: true,
          indexed_at: true,
        },
      })

      const indexedCount = indexedFiles.length
      const totalChunks = indexedFiles.reduce((sum, f) => sum + f.chunk_count, 0)
      const lastIndexedAt = indexedFiles.length > 0
        ? new Date(Math.max(...indexedFiles.map(f => f.indexed_at.getTime())))
        : undefined

      // For now, we'll estimate totalFiles based on indexed files
      // This will be improved in phase-4 with file watching
      const totalFiles = indexedCount

      return {
        projectId,
        totalFiles,
        indexedFiles: indexedCount,
        progress: totalFiles > 0 ? (indexedCount / totalFiles) * 100 : 0,
        isIndexing: this.indexingInProgress.has(projectId),
        lastIndexedAt,
        totalChunks,
      }
    } catch (error) {
      console.error(`Error getting index status for project ${projectId}:`, error)
      return {
        projectId,
        totalFiles: 0,
        indexedFiles: 0,
        progress: 0,
        isIndexing: false,
        totalChunks: 0,
      }
    }
  }

  /**
   * Find source files in a project directory
   * This is a basic implementation that will be enhanced in subtask-3-2
   * with .gitignore and .vibecodeindexignore support
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const sourceFiles: string[] = []
    const sourceExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.go', '.rs', '.java',
      '.cpp', '.c', '.h', '.hpp',
      '.md', '.markdown'
    ]

    const traverseDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)

          // Skip common directories to ignore
          if (entry.isDirectory()) {
            // Basic exclusions (will be enhanced in subtask-3-2)
            if (
              entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === 'coverage' ||
              entry.name === '.next'
            ) {
              continue
            }

            await traverseDirectory(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (sourceExtensions.includes(ext)) {
              sourceFiles.push(fullPath)
            }
          }
        }
      } catch (error) {
        console.error(`Error traversing directory ${dirPath}:`, error)
      }
    }

    await traverseDirectory(projectPath)
    return sourceFiles
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.codeChunker.dispose()
  }
}

/**
 * Singleton instance for convenience
 */
let defaultInstance: CodebaseIndexer | null = null

/**
 * Get the default CodebaseIndexer instance
 */
export function getCodebaseIndexer(): CodebaseIndexer {
  if (!defaultInstance) {
    defaultInstance = new CodebaseIndexer()
  }
  return defaultInstance
}

export default CodebaseIndexer
