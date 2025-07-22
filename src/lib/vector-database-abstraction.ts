// Vector Database Abstraction Layer
// Unified interface for multiple vector database providers (pgvector, Chroma, Weaviate - all open source)

export interface VectorDocument {
  id: string
  content: string
  embedding?: number[]
  metadata: Record<string, any>
  score?: number
}

export interface VectorSearchOptions {
  limit?: number
  threshold?: number
  filter?: Record<string, any>
  includeMetadata?: boolean
  includeEmbeddings?: boolean
}

export interface VectorSearchResult {
  documents: VectorDocument[]
  totalResults: number
  searchTime: number
  provider: string
}

export interface VectorDatabaseConfig {
  provider: 'pgvector' | 'chroma' | 'weaviate'
  connectionString?: string
  apiKey?: string
  environment?: string
  indexName?: string
  dimensions?: number
}

export abstract class VectorDatabaseProvider {
  protected config: VectorDatabaseConfig
  
  constructor(config: VectorDatabaseConfig) {
    this.config = config
  }

  abstract initialize(): Promise<void>
  abstract isConnected(): Promise<boolean>
  abstract upsert(documents: VectorDocument[]): Promise<void>
  abstract search(query: number[], options: VectorSearchOptions): Promise<VectorSearchResult>
  abstract delete(ids: string[]): Promise<void>
  abstract createIndex(name: string, dimensions: number): Promise<void>
  abstract deleteIndex(name: string): Promise<void>
  abstract getStats(): Promise<{ documentCount: number; indexSize: number }>
}

// PostgreSQL with pgvector implementation
export class PgVectorProvider extends VectorDatabaseProvider {
  private client: any = null

  async initialize(): Promise<void> {
    // Import pg dynamically to avoid build issues
    const { Client } = await import('pg')
    this.client = new Client({ connectionString: this.config.connectionString })
    await this.client.connect()
    
    // Ensure vector extension is enabled
    await this.client.query('CREATE EXTENSION IF NOT EXISTS vector')
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.client) return false
      await this.client.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    for (const doc of documents) {
      await this.client.query(`
        INSERT INTO embeddings (id, content, embedding, metadata, workspace_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        doc.id,
        doc.content,
        JSON.stringify(doc.embedding),
        JSON.stringify(doc.metadata),
        doc.metadata.workspaceId || null
      ])
    }
  }

  async search(query: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult> {
    if (!this.client) throw new Error('Not connected')
    
    const startTime = Date.now()
    const { limit = 10, threshold = 0.7, filter = {} } = options
    
    let whereClause = ''
    const params = [JSON.stringify(query), limit]
    let paramIndex = 3
    
    if (filter.workspaceId) {
      whereClause += ` AND workspace_id = $${paramIndex}`
      params.push(filter.workspaceId)
      paramIndex++
    }
    
    const result = await this.client.query(`
      SELECT id, content, metadata, 
             1 - (embedding::vector <=> $1::vector) as score
      FROM embeddings
      WHERE 1 - (embedding::vector <=> $1::vector) > $2
      ${whereClause}
      ORDER BY embedding::vector <=> $1::vector
      LIMIT $2
    `, [JSON.stringify(query), threshold, ...params.slice(2)])
    
    const documents: VectorDocument[] = result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      score: row.score
    }))
    
    return {
      documents,
      totalResults: documents.length,
      searchTime: Date.now() - startTime,
      provider: 'pgvector'
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    await this.client.query(
      'DELETE FROM embeddings WHERE id = ANY($1)',
      [ids]
    )
  }

  async createIndex(name: string, dimensions: number): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    await this.client.query(`
      CREATE INDEX IF NOT EXISTS ${name}_embedding_idx 
      ON embeddings USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)
  }

  async deleteIndex(name: string): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    await this.client.query(`DROP INDEX IF EXISTS ${name}_embedding_idx`)
  }

  async getStats(): Promise<{ documentCount: number; indexSize: number }> {
    if (!this.client) throw new Error('Not connected')
    
    const countResult = await this.client.query('SELECT COUNT(*) FROM embeddings')
    const sizeResult = await this.client.query(`
      SELECT pg_total_relation_size('embeddings') as size
    `)
    
    return {
      documentCount: parseInt(countResult.rows[0].count),
      indexSize: parseInt(sizeResult.rows[0].size)
    }
  }
}

// Chroma implementation
export class ChromaProvider extends VectorDatabaseProvider {
  private client: any = null

  async initialize(): Promise<void> {
    // Dynamic import for Chroma client
    const { ChromaClient } = await import('chromadb')
    this.client = new ChromaClient({
      path: this.config.connectionString || 'http://localhost:8000'
    })
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.client) return false
      await this.client.heartbeat()
      return true
    } catch {
      return false
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    const collection = await this.client.getOrCreateCollection({
      name: this.config.indexName || 'vibecode-documents'
    })
    
    await collection.upsert({
      ids: documents.map(doc => doc.id),
      documents: documents.map(doc => doc.content),
      embeddings: documents.map(doc => doc.embedding),
      metadatas: documents.map(doc => doc.metadata)
    })
  }

  async search(query: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult> {
    if (!this.client) throw new Error('Not connected')
    
    const startTime = Date.now()
    const { limit = 10, filter = {} } = options
    
    const collection = await this.client.getCollection({
      name: this.config.indexName || 'vibecode-documents'
    })
    
    const results = await collection.query({
      queryEmbeddings: [query],
      nResults: limit,
      where: Object.keys(filter).length > 0 ? filter : undefined
    })
    
    const documents: VectorDocument[] = results.ids[0].map((id: string, index: number) => ({
      id,
      content: results.documents[0][index],
      metadata: results.metadatas[0][index],
      score: 1 - (results.distances[0][index] || 0) // Convert distance to similarity
    }))
    
    return {
      documents,
      totalResults: documents.length,
      searchTime: Date.now() - startTime,
      provider: 'chroma'
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    const collection = await this.client.getCollection({
      name: this.config.indexName || 'vibecode-documents'
    })
    
    await collection.delete({ ids })
  }

  async createIndex(name: string, dimensions: number): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    await this.client.createCollection({
      name,
      metadata: { dimensions }
    })
  }

  async deleteIndex(name: string): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    await this.client.deleteCollection({ name })
  }

  async getStats(): Promise<{ documentCount: number; indexSize: number }> {
    if (!this.client) throw new Error('Not connected')
    
    const collection = await this.client.getCollection({
      name: this.config.indexName || 'vibecode-documents'
    })
    
    const count = await collection.count()
    
    return {
      documentCount: count,
      indexSize: 0 // Chroma doesn't provide index size info
    }
  }
}

// Weaviate implementation (open source vector database)
export class WeaviateProvider extends VectorDatabaseProvider {
  private client: any = null

  async initialize(): Promise<void> {
    // Dynamic import for Weaviate client
    const weaviate = await import('weaviate-ts-client')
    
    this.client = weaviate.default.client({
      scheme: 'http',
      host: this.config.connectionString || 'localhost:8080',
      apiKey: this.config.apiKey ? 
        new weaviate.ApiKey(this.config.apiKey) : undefined
    })
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.client) return false
      await this.client.misc().liveChecker().do()
      return true
    } catch {
      return false
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    const className = this.config.indexName || 'VibeCodeDocument'
    
    // Batch insert documents
    let batcher = this.client.batch().objectsBatcher()
    
    for (const doc of documents) {
      batcher = batcher.withObject({
        class: className,
        id: doc.id,
        properties: {
          content: doc.content,
          metadata: JSON.stringify(doc.metadata)
        },
        vector: doc.embedding
      })
    }
    
    await batcher.do()
  }

  async search(query: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult> {
    if (!this.client) throw new Error('Not connected')
    
    const startTime = Date.now()
    const { limit = 10 } = options
    const className = this.config.indexName || 'VibeCodeDocument'
    
    const results = await this.client.graphql
      .get()
      .withClassName(className)
      .withFields('content metadata _additional { id distance }')
      .withNearVector({ vector: query })
      .withLimit(limit)
      .do()
    
    const documents: VectorDocument[] = results.data.Get[className].map((item: any) => ({
      id: item._additional.id,
      content: item.content,
      metadata: JSON.parse(item.metadata || '{}'),
      score: 1 - item._additional.distance // Convert distance to similarity
    }))
    
    return {
      documents,
      totalResults: documents.length,
      searchTime: Date.now() - startTime,
      provider: 'weaviate'
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    const className = this.config.indexName || 'VibeCodeDocument'
    
    for (const id of ids) {
      await this.client.data().deleter()
        .withClassName(className)
        .withId(id)
        .do()
    }
  }

  async createIndex(name: string, dimensions: number): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    const schema = {
      class: name,
      vectorizer: 'none',
      properties: [
        {
          name: 'content',
          dataType: ['text']
        },
        {
          name: 'metadata',
          dataType: ['text']
        }
      ]
    }
    
    await this.client.schema().classCreator().withClass(schema).do()
  }

  async deleteIndex(name: string): Promise<void> {
    if (!this.client) throw new Error('Not connected')
    
    await this.client.schema().classDeleter().withClassName(name).do()
  }

  async getStats(): Promise<{ documentCount: number; indexSize: number }> {
    if (!this.client) throw new Error('Not connected')
    
    const className = this.config.indexName || 'VibeCodeDocument'
    
    try {
      const result = await this.client.graphql
        .aggregate()
        .withClassName(className)
        .withFields('meta { count }')
        .do()
      
      const count = result.data.Aggregate[className]?.[0]?.meta?.count || 0
      
      return {
        documentCount: count,
        indexSize: 0 // Weaviate doesn't provide index size info
      }
    } catch {
      return { documentCount: 0, indexSize: 0 }
    }
  }
}

// Factory function to create vector database providers
export function createVectorDatabase(config: VectorDatabaseConfig): VectorDatabaseProvider {
  switch (config.provider) {
    case 'pgvector':
      return new PgVectorProvider(config)
    case 'chroma':
      return new ChromaProvider(config)
    case 'weaviate':
      return new WeaviateProvider(config)
    default:
      throw new Error(`Unsupported vector database provider: ${config.provider}`)
  }
}

// Enhanced vector store with provider abstraction
export class UnifiedVectorStore {
  private providers: Map<string, VectorDatabaseProvider> = new Map()
  private primaryProvider: string
  private fallbackProviders: string[]

  constructor(configs: VectorDatabaseConfig[], primaryProvider: string) {
    this.primaryProvider = primaryProvider
    this.fallbackProviders = configs
      .map(config => config.provider)
      .filter(provider => provider !== primaryProvider)

    // Initialize all providers
    for (const config of configs) {
      const provider = createVectorDatabase(config)
      this.providers.set(config.provider, provider)
    }
  }

  async initialize(): Promise<void> {
    // Initialize all providers in parallel
    await Promise.allSettled(
      Array.from(this.providers.values()).map(provider => provider.initialize())
    )
  }

  async search(
    query: number[], 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult> {
    // Try primary provider first
    const primary = this.providers.get(this.primaryProvider)
    if (primary && await primary.isConnected()) {
      try {
        return await primary.search(query, options)
      } catch (error) {
        console.warn(`Primary provider ${this.primaryProvider} failed:`, error)
      }
    }

    // Try fallback providers
    for (const fallbackProvider of this.fallbackProviders) {
      const provider = this.providers.get(fallbackProvider)
      if (provider && await provider.isConnected()) {
        try {
          console.log(`Using fallback provider: ${fallbackProvider}`)
          return await provider.search(query, options)
        } catch (error) {
          console.warn(`Fallback provider ${fallbackProvider} failed:`, error)
        }
      }
    }

    throw new Error('All vector database providers are unavailable')
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    // Upsert to all available providers for redundancy
    const results = await Promise.allSettled(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        if (await provider.isConnected()) {
          return provider.upsert(documents)
        }
        throw new Error(`Provider ${name} not connected`)
      })
    )

    // Check if at least one provider succeeded
    const successes = results.filter(result => result.status === 'fulfilled')
    if (successes.length === 0) {
      throw new Error('Failed to upsert to any vector database provider')
    }
  }

  async getProviderStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {}
    
    await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        status[name] = await provider.isConnected()
      })
    )
    
    return status
  }

  async getStats(): Promise<Record<string, { documentCount: number; indexSize: number }>> {
    const stats: Record<string, { documentCount: number; indexSize: number }> = {}
    
    await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        if (await provider.isConnected()) {
          try {
            stats[name] = await provider.getStats()
          } catch (error) {
            stats[name] = { documentCount: 0, indexSize: 0 }
          }
        } else {
          stats[name] = { documentCount: 0, indexSize: 0 }
        }
      })
    )
    
    return stats
  }
}

// Export configured instance for VibeCode
export const createVibeCodeVectorStore = () => {
  const configs: VectorDatabaseConfig[] = [
    {
      provider: 'pgvector',
      connectionString: process.env.DATABASE_URL!,
      indexName: 'vibecode-embeddings'
    }
  ]

  // Add Chroma if available
  if (process.env.CHROMA_URL) {
    configs.push({
      provider: 'chroma',
      connectionString: process.env.CHROMA_URL,
      indexName: 'vibecode-documents'
    })
  }

  // Add Weaviate if configured
  if (process.env.WEAVIATE_URL) {
    configs.push({
      provider: 'weaviate',
      connectionString: process.env.WEAVIATE_URL,
      apiKey: process.env.WEAVIATE_API_KEY,
      indexName: process.env.WEAVIATE_CLASS_NAME || 'VibeCodeDocument'
    })
  }

  return new UnifiedVectorStore(configs, 'pgvector')
}