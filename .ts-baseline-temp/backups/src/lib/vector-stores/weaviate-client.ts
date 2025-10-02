/**
 * Weaviate Vector Database Client
 * Enterprise-grade vector database for AI applications
 * Provides advanced vector search, hybrid search, and generative AI capabilities
 */

import weaviate from 'weaviate-ts-client'

export interface WeaviateDocument {
  id?: string
  content: string
  metadata: {
    fileName: string
    filePath: string
    language?: string
    fileId: number
    workspaceId: number
    startLine?: number
    endLine?: number
    tokens: number
    chunkIndex: number
    createdAt: string
  }
  vector?: number[]
}

export interface WeaviateSearchOptions {
  query: string
  limit?: number
  certainty?: number
  workspaceId?: number
  fileIds?: number[]
  language?: string
  hybrid?: boolean
  generative?: {
    singlePrompt: string
  }
}

export interface WeaviateSearchResult {
  id: string
  content: string
  metadata: WeaviateDocument['metadata']
  certainty: number
  distance?: number
  generatedText?: string
}

export interface WeaviateStats {
  totalObjects: number
  totalVectors: number
  indexes: Array<{
    className: string
    objectCount: number
    properties: string[]
  }>
  memoryUsage?: {
    indexSize: string
    vectorSize: string
  }
}

export class WeaviateVectorStore {
  private client: any // WeaviateClient
  private className: string
  private isConnected: boolean = false

  constructor(config: {
    host?: string
    apiKey?: string
    className?: string
    openaiApiKey?: string
  }) {
    const {
      host = process.env.WEAVIATE_HOST || 'http://localhost:8080',
      apiKey = process.env.WEAVIATE_API_KEY,
      className = 'VibeCodeDocument',
      openaiApiKey = process.env.OPENAI_API_KEY
    } = config

    // Initialize Weaviate client with proper configuration
    try {
      this.client = weaviate.client({
        scheme: host.startsWith('https') ? 'https' : 'http',
        host: host.replace(/^https?:\/\//, ''),
        apiKey: apiKey,
        ...(openaiApiKey ? { additionalHeaders: { 'X-OpenAI-Api-Key': openaiApiKey } } : {})
      })
    } catch (error) {
      console.warn('Failed to initialize Weaviate client:', error)
      // Use a mock client that will fail gracefully
      this.client = {
        misc: {
          readyChecker: () => ({ do: () => Promise.resolve(false) }),
          metaGetter: () => ({ do: () => Promise.resolve({}) })
        },
        schema: {
          getter: () => ({ do: () => Promise.resolve({ classes: [] }) }),
          classCreator: () => ({ withClass: () => ({ do: () => Promise.resolve() }) })
        },
        batch: {
          objectsBatcher: () => ({
            withObject: (_obj: any) => ({
              withObject: (_obj: any) => this.client.batch.objectsBatcher(),
              do: () => Promise.resolve()
            }),
            do: () => Promise.resolve()
          }),
          objectsBatchDeleter: () => ({
            withClassName: () => ({
              withWhere: () => ({ do: () => Promise.resolve({ results: { successful: 0 } }) })
            })
          })
        },
        graphQL: {
          get: () => ({
            withClassName: () => ({
              withFields: () => ({
                withLimit: () => ({
                  withNearText: () => ({ do: () => Promise.resolve({ data: {} }) }),
                  withHybrid: () => ({ do: () => Promise.resolve({ data: {} }) }),
                  withWhere: () => ({ do: () => Promise.resolve({ data: {} }) }),
                  withGenerate: () => ({ do: () => Promise.resolve({ data: {} }) }),
                  do: () => Promise.resolve({ data: {} })
                })
              })
            })
          }),
          aggregate: () => ({
            withClassName: () => ({
              withFields: () => ({ do: () => Promise.resolve({ data: {} }) })
            })
          })
        }
      }
    }
    this.className = className
  }

  /**
   * Initialize Weaviate schema and connection
   */
  async initialize(): Promise<boolean> {
    try {
      // Test connection
      const ready = await this.client.misc.readyChecker().do()
      if (!ready) {
        console.warn('Weaviate not ready')
        return false
      }

      // Check if schema exists
      const schema = await this.client.schema.getter().do()
      const classExists = schema.classes?.some(c => c.class === this.className)

      if (!classExists) {
        await this.createSchema()
      }

      this.isConnected = true
      console.log('✅ Weaviate connected and schema ready')
      return true
    } catch (error) {
      console.error('Failed to initialize Weaviate:', error)
      this.isConnected = false
      return false
    }
  }

  /**
   * Create Weaviate schema for VibeCode documents
   */
  private async createSchema(): Promise<void> {
    const classDefinition = {
      class: this.className,
      description: 'VibeCode document chunks for RAG and semantic search',
      vectorizer: 'text2vec-openai',
      moduleConfig: {
        'text2vec-openai': {
          model: 'text-embedding-3-small',
          dimensions: 1536,
          type: 'text'
        },
        'generative-openai': {
          model: 'gpt-3.5-turbo'
        }
      },
      properties: [
        {
          name: 'content',
          dataType: ['text'],
          description: 'The actual text content of the document chunk',
          moduleConfig: {
            'text2vec-openai': {
              skip: false,
              vectorizePropertyName: false
            }
          }
        },
        {
          name: 'fileName',
          dataType: ['text'],
          description: 'Name of the source file',
          moduleConfig: {
            'text2vec-openai': { skip: true }
          }
        },
        {
          name: 'filePath',
          dataType: ['text'],
          description: 'Full path to the source file',
          moduleConfig: {
            'text2vec-openai': { skip: true }
          }
        },
        {
          name: 'language',
          dataType: ['text'],
          description: 'Programming language or file type',
          moduleConfig: {
            'text2vec-openai': { skip: true }
          }
        },
        {
          name: 'fileId',
          dataType: ['int'],
          description: 'Database file ID reference'
        },
        {
          name: 'workspaceId',
          dataType: ['int'],
          description: 'Workspace ID for isolation'
        },
        {
          name: 'startLine',
          dataType: ['int'],
          description: 'Starting line number in source file'
        },
        {
          name: 'endLine',
          dataType: ['int'],
          description: 'Ending line number in source file'
        },
        {
          name: 'tokens',
          dataType: ['int'],
          description: 'Estimated token count for this chunk'
        },
        {
          name: 'chunkIndex',
          dataType: ['int'],
          description: 'Index of this chunk within the file'
        },
        {
          name: 'createdAt',
          dataType: ['date'],
          description: 'When this chunk was indexed'
        }
      ]
    }

    await this.client.schema.classCreator().withClass(classDefinition).do()
    console.log(`✅ Created Weaviate schema for class: ${this.className}`)
  }

  /**
   * Check if Weaviate is available and connected
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isConnected) {
      return await this.initialize()
    }
    return true
  }

  /**
   * Store document chunks in Weaviate
   */
  async storeDocuments(documents: WeaviateDocument[]): Promise<boolean> {
    if (!await this.isAvailable()) {
      throw new Error('Weaviate not available')
    }

    try {
      // Prepare batch operation
      let batch = this.client.batch.objectsBatcher()
      let batchSize = 0

      for (const doc of documents) {
        const object = {
          class: this.className,
          properties: {
            content: doc.content,
            fileName: doc.metadata.fileName,
            filePath: doc.metadata.filePath,
            language: doc.metadata.language,
            fileId: doc.metadata.fileId,
            workspaceId: doc.metadata.workspaceId,
            startLine: doc.metadata.startLine,
            endLine: doc.metadata.endLine,
            tokens: doc.metadata.tokens,
            chunkIndex: doc.metadata.chunkIndex,
            createdAt: doc.metadata.createdAt
          },
          id: doc.id
        }

        batch = batch.withObject(object)
        batchSize++

        // Process batch when it reaches 100 objects
        if (batchSize >= 100) {
          await batch.do()
          batch = this.client.batch.objectsBatcher()
          batchSize = 0
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Process remaining objects
      if (batchSize > 0) {
        await batch.do()
      }

      console.log(`✅ Stored ${documents.length} documents in Weaviate`)
      return true
    } catch (error) {
      console.error('Failed to store documents in Weaviate:', error)
      throw error
    }
  }

  /**
   * Semantic search with optional hybrid search
   */
  async search(options: WeaviateSearchOptions): Promise<WeaviateSearchResult[]> {
    if (!await this.isAvailable()) {
      throw new Error('Weaviate not available')
    }

    const {
      query,
      limit = 10,
      certainty = 0.7,
      workspaceId,
      fileIds,
      language,
      hybrid = false,
      generative
    } = options

    try {
      let queryBuilder = this.client.graphQL.get()
        .withClassName(this.className)
        .withFields('content fileName filePath language fileId workspaceId startLine endLine tokens chunkIndex createdAt _additional { id certainty distance }')
        .withLimit(limit)

      if (hybrid) {
        // Hybrid search combining vector and keyword search
        queryBuilder = queryBuilder.withHybrid({
          query,
          alpha: 0.7 // 0.7 = more vector, 0.3 = more keyword
        })
      } else {
        // Pure vector search
        queryBuilder = queryBuilder.withNearText({
          concepts: [query],
          certainty
        })
      }

      // Add filters
      const whereFilters: any[] = []

      if (workspaceId) {
        whereFilters.push({
          path: ['workspaceId'],
          operator: 'Equal',
          valueInt: workspaceId
        })
      }

      if (fileIds && fileIds.length > 0) {
        whereFilters.push({
          path: ['fileId'],
          operator: 'ContainsAny',
          valueInt: fileIds
        })
      }

      if (language) {
        whereFilters.push({
          path: ['language'],
          operator: 'Equal',
          valueText: language
        })
      }

      if (whereFilters.length > 0) {
        const whereClause = whereFilters.length === 1 
          ? whereFilters[0] 
          : { operator: 'And', operands: whereFilters }
        
        queryBuilder = queryBuilder.withWhere(whereClause)
      }

      // Add generative search if requested
      if (generative) {
        queryBuilder = queryBuilder.withGenerate({
          singlePrompt: generative.singlePrompt
        })
      }

      const result = await queryBuilder.do()
      
      const objects = result.data?.Get?.[this.className] || []
      
      return objects.map((obj: any) => ({
        id: obj._additional.id,
        content: obj.content,
        metadata: {
          fileName: obj.fileName,
          filePath: obj.filePath,
          language: obj.language,
          fileId: obj.fileId,
          workspaceId: obj.workspaceId,
          startLine: obj.startLine,
          endLine: obj.endLine,
          tokens: obj.tokens,
          chunkIndex: obj.chunkIndex,
          createdAt: obj.createdAt
        },
        certainty: obj._additional.certainty,
        distance: obj._additional.distance,
        generatedText: obj._additional?.generate?.singleResult
      }))
    } catch (error) {
      console.error('Weaviate search failed:', error)
      throw error
    }
  }

  /**
   * Delete documents by workspace or file
   */
  async deleteDocuments(options: {
    workspaceId?: number
    fileIds?: number[]
  }): Promise<number> {
    if (!await this.isAvailable()) {
      throw new Error('Weaviate not available')
    }

    const { workspaceId, fileIds } = options
    const whereFilters: any[] = []

    if (workspaceId) {
      whereFilters.push({
        path: ['workspaceId'],
        operator: 'Equal',
        valueInt: workspaceId
      })
    }

    if (fileIds && fileIds.length > 0) {
      whereFilters.push({
        path: ['fileId'],
        operator: 'ContainsAny',
        valueInt: fileIds
      })
    }

    if (whereFilters.length === 0) {
      throw new Error('Must specify workspaceId or fileIds for deletion')
    }

    try {
      const whereClause = whereFilters.length === 1 
        ? whereFilters[0] 
        : { operator: 'And', operands: whereFilters }

      const result = await this.client.batch
        .objectsBatchDeleter()
        .withClassName(this.className)
        .withWhere(whereClause)
        .do()

      const deletedCount = result.results?.successful || 0
      console.log(`🗑️  Deleted ${deletedCount} documents from Weaviate`)
      return deletedCount
    } catch (error) {
      console.error('Failed to delete documents from Weaviate:', error)
      throw error
    }
  }

  /**
   * Get database statistics and health info
   */
  async getStats(): Promise<WeaviateStats> {
    if (!await this.isAvailable()) {
      throw new Error('Weaviate not available')
    }

    try {
      const schema = await this.client.schema.getter().do()
      const meta = await this.client.misc.metaGetter().do()
      
      const indexes = schema.classes?.map(cls => ({
        className: cls.class || 'Unknown',
        objectCount: 0, // Would need aggregate query to get actual count
        properties: cls.properties?.map(prop => prop.name) || []
      })) || []

      // Get object count for our class
      const aggregate = await this.client.graphQL
        .aggregate()
        .withClassName(this.className)
        .withFields('meta { count }')
        .do()

      const objectCount = aggregate.data?.Aggregate?.[this.className]?.[0]?.meta?.count || 0

      return {
        totalObjects: objectCount,
        totalVectors: objectCount,
        indexes: indexes.map(idx => 
          idx.className === this.className 
            ? { ...idx, objectCount } 
            : idx
        ),
        memoryUsage: {
          indexSize: 'Unknown', // Would need cluster stats
          vectorSize: 'Unknown'
        }
      }
    } catch (error) {
      console.error('Failed to get Weaviate stats:', error)
      return {
        totalObjects: 0,
        totalVectors: 0,
        indexes: []
      }
    }
  }

  /**
   * Health check for Weaviate instance
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    details: {
      connected: boolean
      schemaReady: boolean
      version?: string
      modules?: string[]
    }
  }> {
    try {
      const ready = await this.client.misc.readyChecker().do()
      const meta = await this.client.misc.metaGetter().do()
      
      return {
        status: ready && this.isConnected ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          schemaReady: ready,
          version: meta.version,
          modules: meta.modules ? Object.keys(meta.modules) : []
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          schemaReady: false
        }
      }
    }
  }
}

// Export singleton instance
export const weaviateStore = new WeaviateVectorStore({
  host: process.env.WEAVIATE_HOST,
  apiKey: process.env.WEAVIATE_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY
})

export default weaviateStore
