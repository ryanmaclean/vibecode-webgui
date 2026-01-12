/**
 * Tests for Vector Database Types
 */

import {
  VectorChunk,
  SearchResult,
  SearchOptions,
  VectorDatabaseProvider,
  VectorDatabaseConfig
} from '@/lib/vector-db/vector-types'

describe('Vector Database Types', () => {
  describe('VectorChunk', () => {
    it('should have required properties', () => {
      const chunk: VectorChunk = {
        id: '123',
        content: 'function test() {}',
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          fileId: 1,
          fileName: 'test.ts',
          tokens: 10
        }
      }

      expect(chunk.id).toBe('123')
      expect(chunk.content).toBe('function test() {}')
      expect(chunk.embedding).toEqual([0.1, 0.2, 0.3])
      expect(chunk.metadata.fileId).toBe(1)
      expect(chunk.metadata.fileName).toBe('test.ts')
      expect(chunk.metadata.tokens).toBe(10)
    })

    it('should allow optional metadata fields', () => {
      const chunk: VectorChunk = {
        id: '456',
        content: 'const x = 1;',
        embedding: [0.4, 0.5],
        metadata: {
          fileId: 2,
          fileName: 'app.ts',
          startLine: 10,
          endLine: 15,
          language: 'typescript',
          tokens: 5
        }
      }

      expect(chunk.metadata.startLine).toBe(10)
      expect(chunk.metadata.endLine).toBe(15)
      expect(chunk.metadata.language).toBe('typescript')
    })

    it('should work with empty content', () => {
      const chunk: VectorChunk = {
        id: '789',
        content: '',
        embedding: [],
        metadata: {
          fileId: 3,
          fileName: 'empty.ts',
          tokens: 0
        }
      }

      expect(chunk.content).toBe('')
      expect(chunk.embedding).toEqual([])
    })

    it('should handle large embeddings', () => {
      const largeEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536)
      const chunk: VectorChunk = {
        id: 'large',
        content: 'large content',
        embedding: largeEmbedding,
        metadata: {
          fileId: 4,
          fileName: 'large.ts',
          tokens: 100
        }
      }

      expect(chunk.embedding.length).toBe(1536)
    })

    it('should support various languages', () => {
      const languages = ['typescript', 'javascript', 'python', 'java', 'go']

      languages.forEach(lang => {
        const chunk: VectorChunk = {
          id: `chunk-${lang}`,
          content: `// ${lang} code`,
          embedding: [0.1, 0.2],
          metadata: {
            fileId: 1,
            fileName: `file.${lang}`,
            language: lang,
            tokens: 5
          }
        }

        expect(chunk.metadata.language).toBe(lang)
      })
    })
  })

  describe('SearchResult', () => {
    it('should contain chunk and similarity', () => {
      const result: SearchResult = {
        chunk: {
          id: '123',
          content: 'test',
          embedding: [0.1],
          metadata: {
            fileId: 1,
            fileName: 'test.ts',
            tokens: 5
          }
        },
        similarity: 0.95
      }

      expect(result.chunk).toBeDefined()
      expect(result.similarity).toBe(0.95)
    })

    it('should allow optional metadata', () => {
      const result: SearchResult = {
        chunk: {
          id: '456',
          content: 'test',
          embedding: [0.1],
          metadata: {
            fileId: 1,
            fileName: 'test.ts',
            tokens: 5
          }
        },
        similarity: 0.85,
        metadata: {
          provider: 'postgres',
          cacheHit: true,
          queryTime: 50
        }
      }

      expect(result.metadata?.provider).toBe('postgres')
      expect(result.metadata?.cacheHit).toBe(true)
      expect(result.metadata?.queryTime).toBe(50)
    })

    it('should handle similarity scores from 0 to 1', () => {
      const scores = [0, 0.25, 0.5, 0.75, 1.0]

      scores.forEach(score => {
        const result: SearchResult = {
          chunk: {
            id: '123',
            content: 'test',
            embedding: [0.1],
            metadata: {
              fileId: 1,
              fileName: 'test.ts',
              tokens: 5
            }
          },
          similarity: score
        }

        expect(result.similarity).toBe(score)
      })
    })

    it('should work without metadata', () => {
      const result: SearchResult = {
        chunk: {
          id: '789',
          content: 'test',
          embedding: [0.1],
          metadata: {
            fileId: 1,
            fileName: 'test.ts',
            tokens: 5
          }
        },
        similarity: 0.9
      }

      expect(result.metadata).toBeUndefined()
    })
  })

  describe('SearchOptions', () => {
    it('should allow empty options', () => {
      const options: SearchOptions = {}

      expect(options).toEqual({})
    })

    it('should allow workspaceId', () => {
      const options: SearchOptions = {
        workspaceId: 123
      }

      expect(options.workspaceId).toBe(123)
    })

    it('should allow fileIds array', () => {
      const options: SearchOptions = {
        fileIds: [1, 2, 3, 4, 5]
      }

      expect(options.fileIds).toEqual([1, 2, 3, 4, 5])
    })

    it('should allow limit', () => {
      const options: SearchOptions = {
        limit: 10
      }

      expect(options.limit).toBe(10)
    })

    it('should allow threshold', () => {
      const options: SearchOptions = {
        threshold: 0.8
      }

      expect(options.threshold).toBe(0.8)
    })

    it('should allow useCache flag', () => {
      const options: SearchOptions = {
        useCache: true
      }

      expect(options.useCache).toBe(true)
    })

    it('should allow language filter', () => {
      const options: SearchOptions = {
        language: 'typescript'
      }

      expect(options.language).toBe('typescript')
    })

    it('should allow contentTypes array', () => {
      const options: SearchOptions = {
        contentTypes: ['code', 'documentation', 'tests']
      }

      expect(options.contentTypes).toEqual(['code', 'documentation', 'tests'])
    })

    it('should allow all options combined', () => {
      const options: SearchOptions = {
        workspaceId: 456,
        fileIds: [10, 20, 30],
        limit: 5,
        threshold: 0.75,
        useCache: true,
        language: 'python',
        contentTypes: ['code']
      }

      expect(options.workspaceId).toBe(456)
      expect(options.fileIds).toEqual([10, 20, 30])
      expect(options.limit).toBe(5)
      expect(options.threshold).toBe(0.75)
      expect(options.useCache).toBe(true)
      expect(options.language).toBe('python')
      expect(options.contentTypes).toEqual(['code'])
    })
  })

  describe('VectorDatabaseProvider', () => {
    it('should define POSTGRES provider', () => {
      expect(VectorDatabaseProvider.POSTGRES).toBe('postgres')
    })

    it('should define SQLSERVER provider', () => {
      expect(VectorDatabaseProvider.SQLSERVER).toBe('sqlserver')
    })

    it('should define COSMOSDB provider', () => {
      expect(VectorDatabaseProvider.COSMOSDB).toBe('cosmosdb')
    })

    it('should define REDIS provider', () => {
      expect(VectorDatabaseProvider.REDIS).toBe('redis')
    })

    it('should define AZURE_SEARCH provider', () => {
      expect(VectorDatabaseProvider.AZURE_SEARCH).toBe('azure-search')
    })

    it('should have exactly 5 providers', () => {
      const providers = Object.values(VectorDatabaseProvider)
      expect(providers.length).toBe(5)
    })

    it('should have unique provider values', () => {
      const providers = Object.values(VectorDatabaseProvider)
      const uniqueProviders = new Set(providers)
      expect(providers.length).toBe(uniqueProviders.size)
    })
  })

  describe('VectorDatabaseConfig', () => {
    it('should require provider', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES
      }

      expect(config.provider).toBe(VectorDatabaseProvider.POSTGRES)
    })

    it('should allow connectionString', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        connectionString: 'postgresql://user:pass@localhost:5432/db'
      }

      expect(config.connectionString).toBe('postgresql://user:pass@localhost:5432/db')
    })

    it('should allow individual connection properties', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        host: 'localhost',
        port: 5432,
        username: 'admin',
        password: 'secret',
        database: 'vectordb',
        schema: 'public'
      }

      expect(config.host).toBe('localhost')
      expect(config.port).toBe(5432)
      expect(config.username).toBe('admin')
      expect(config.password).toBe('secret')
      expect(config.database).toBe('vectordb')
      expect(config.schema).toBe('public')
    })

    it('should allow cache configuration', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        cacheEnabled: true,
        cacheTtl: 3600
      }

      expect(config.cacheEnabled).toBe(true)
      expect(config.cacheTtl).toBe(3600)
    })

    it('should allow retry configuration', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        retryAttempts: 3,
        retryDelay: 1000
      }

      expect(config.retryAttempts).toBe(3)
      expect(config.retryDelay).toBe(1000)
    })

    it('should allow observability flags', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        enableMetrics: true,
        enableLogging: true
      }

      expect(config.enableMetrics).toBe(true)
      expect(config.enableLogging).toBe(true)
    })

    it('should allow pool size configuration', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        maxPoolSize: 20,
        minPoolSize: 2
      }

      expect(config.maxPoolSize).toBe(20)
      expect(config.minPoolSize).toBe(2)
    })

    it('should support all providers', () => {
      const providers = [
        VectorDatabaseProvider.POSTGRES,
        VectorDatabaseProvider.SQLSERVER,
        VectorDatabaseProvider.COSMOSDB,
        VectorDatabaseProvider.REDIS,
        VectorDatabaseProvider.AZURE_SEARCH
      ]

      providers.forEach(provider => {
        const config: VectorDatabaseConfig = {
          provider,
          connectionString: 'test://connection'
        }

        expect(config.provider).toBe(provider)
      })
    })

    it('should allow complete configuration', () => {
      const config: VectorDatabaseConfig = {
        provider: VectorDatabaseProvider.POSTGRES,
        connectionString: 'postgresql://localhost:5432/db',
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'pass',
        database: 'vectordb',
        schema: 'vectors',
        cacheEnabled: true,
        cacheTtl: 7200,
        retryAttempts: 5,
        retryDelay: 2000,
        enableMetrics: true,
        enableLogging: true,
        maxPoolSize: 50,
        minPoolSize: 5
      }

      expect(config.provider).toBe(VectorDatabaseProvider.POSTGRES)
      expect(config.connectionString).toBeDefined()
      expect(config.host).toBeDefined()
      expect(config.cacheEnabled).toBe(true)
      expect(config.retryAttempts).toBe(5)
      expect(config.enableMetrics).toBe(true)
      expect(config.maxPoolSize).toBe(50)
    })
  })

  describe('type compatibility', () => {
    it('should allow VectorChunk in SearchResult', () => {
      const chunk: VectorChunk = {
        id: 'test',
        content: 'test content',
        embedding: [0.1, 0.2],
        metadata: {
          fileId: 1,
          fileName: 'test.ts',
          tokens: 10
        }
      }

      const result: SearchResult = {
        chunk,
        similarity: 0.9
      }

      expect(result.chunk).toBe(chunk)
    })

    it('should allow SearchResult in array', () => {
      const results: SearchResult[] = [
        {
          chunk: {
            id: '1',
            content: 'content 1',
            embedding: [0.1],
            metadata: { fileId: 1, fileName: 'f1.ts', tokens: 5 }
          },
          similarity: 0.9
        },
        {
          chunk: {
            id: '2',
            content: 'content 2',
            embedding: [0.2],
            metadata: { fileId: 2, fileName: 'f2.ts', tokens: 8 }
          },
          similarity: 0.8
        }
      ]

      expect(results.length).toBe(2)
      expect(results[0].similarity).toBe(0.9)
      expect(results[1].similarity).toBe(0.8)
    })
  })
})
