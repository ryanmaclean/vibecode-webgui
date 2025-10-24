/**
 * Unit tests for embedding-service.ts
 * Tests embedding service interfaces and implementations
 */

import {
  EmbeddingService,
  EmbeddingServiceConfig,
  EmbeddingServiceFactory,
  BaseEmbeddingService,
  MockEmbeddingService,
} from '../embedding-service'

describe('EmbeddingService', () => {
  describe('MockEmbeddingService', () => {
    let service: MockEmbeddingService

    beforeEach(() => {
      service = new MockEmbeddingService()
    })

    describe('Constructor', () => {
      it('should initialize with default configuration', () => {
        expect(service).toBeDefined()
        expect(service.getModelName()).toBe('mock-embedding-model')
        expect(service.getDimension()).toBe(384)
      })

      it('should initialize with custom configuration', () => {
        const config: EmbeddingServiceConfig = {
          model: 'custom-model',
          dimensions: 512,
        }
        const customService = new MockEmbeddingService(config)

        expect(customService.getModelName()).toBe('custom-model')
        expect(customService.getDimension()).toBe(512)
      })

      it('should inherit from BaseEmbeddingService', () => {
        expect(service).toBeInstanceOf(BaseEmbeddingService)
        expect(service).toBeInstanceOf(MockEmbeddingService)
      })
    })

    describe('generateEmbedding', () => {
      it('should generate embeddings for text', async () => {
        const text = 'Hello world'
        const embedding = await service.generateEmbedding(text)

        expect(Array.isArray(embedding)).toBe(true)
        expect(embedding).toHaveLength(384) // Default dimension
        expect(embedding.every(val => typeof val === 'number')).toBe(true)
      })

      it('should generate deterministic embeddings', async () => {
        const text = 'Test text'
        const embedding1 = await service.generateEmbedding(text)
        const embedding2 = await service.generateEmbedding(text)

        expect(embedding1).toEqual(embedding2)
      })

      it('should generate different embeddings for different texts', async () => {
        const embedding1 = await service.generateEmbedding('Hello')
        const embedding2 = await service.generateEmbedding('World')

        expect(embedding1).not.toEqual(embedding2)
      })

      it('should generate normalized embeddings', async () => {
        const text = 'Normalization test'
        const embedding = await service.generateEmbedding(text)

        // Calculate the magnitude of the vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
        
        // Should be approximately 1 (normalized)
        expect(magnitude).toBeCloseTo(1, 5)
      })

      it('should handle empty text', async () => {
        const embedding = await service.generateEmbedding('')

        expect(Array.isArray(embedding)).toBe(true)
        expect(embedding).toHaveLength(384)
      })

      it('should handle special characters', async () => {
        const text = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?'
        const embedding = await service.generateEmbedding(text)

        expect(Array.isArray(embedding)).toBe(true)
        expect(embedding).toHaveLength(384)
      })
    })

    describe('generateEmbeddings', () => {
      it('should generate embeddings for multiple texts', async () => {
        const texts = ['Hello', 'World', 'Test']
        const embeddings = await service.generateEmbeddings(texts)

        expect(Array.isArray(embeddings)).toBe(true)
        expect(embeddings).toHaveLength(3)
        embeddings.forEach(embedding => {
          expect(Array.isArray(embedding)).toBe(true)
          expect(embedding).toHaveLength(384)
        })
      })

      it('should handle empty array', async () => {
        const embeddings = await service.generateEmbeddings([])

        expect(Array.isArray(embeddings)).toBe(true)
        expect(embeddings).toHaveLength(0)
      })

      it('should handle single text', async () => {
        const texts = ['Single text']
        const embeddings = await service.generateEmbeddings(texts)

        expect(embeddings).toHaveLength(1)
        expect(embeddings[0]).toHaveLength(384)
      })

      it('should process texts in batches', async () => {
        // Create a service with small batch size for testing
        const config: EmbeddingServiceConfig = {
          maxBatchSize: 2,
        }
        const batchService = new MockEmbeddingService(config)

        const texts = ['Text1', 'Text2', 'Text3', 'Text4', 'Text5']
        const embeddings = await batchService.generateEmbeddings(texts)

        expect(embeddings).toHaveLength(5)
        embeddings.forEach(embedding => {
          expect(embedding).toHaveLength(384)
        })
      })
    })

    describe('getDimension', () => {
      it('should return correct dimension', () => {
        expect(service.getDimension()).toBe(384)
      })

      it('should return custom dimension when configured', () => {
        const config: EmbeddingServiceConfig = {
          dimensions: 1024,
        }
        const customService = new MockEmbeddingService(config)

        expect(customService.getDimension()).toBe(1024)
      })
    })

    describe('getModelName', () => {
      it('should return correct model name', () => {
        expect(service.getModelName()).toBe('mock-embedding-model')
      })

      it('should return custom model name when configured', () => {
        const config: EmbeddingServiceConfig = {
          model: 'custom-model-name',
        }
        const customService = new MockEmbeddingService(config)

        expect(customService.getModelName()).toBe('custom-model-name')
      })
    })

    describe('healthCheck', () => {
      it('should return true for healthy service', async () => {
        const isHealthy = await service.healthCheck()

        expect(isHealthy).toBe(true)
      })

      it('should validate embedding dimensions in health check', async () => {
        const isHealthy = await service.healthCheck()

        expect(isHealthy).toBe(true)
      })
    })

    describe('Private Methods', () => {
      describe('simpleHash', () => {
        it('should generate consistent hash values', () => {
          const text = 'Test string'
          const hash1 = (service as any).simpleHash(text)
          const hash2 = (service as any).simpleHash(text)

          expect(hash1).toBe(hash2)
          expect(typeof hash1).toBe('number')
          expect(hash1).toBeGreaterThanOrEqual(0)
        })

        it('should generate different hash values for different strings', () => {
          const hash1 = (service as any).simpleHash('String 1')
          const hash2 = (service as any).simpleHash('String 2')

          expect(hash1).not.toBe(hash2)
        })

        it('should handle empty string', () => {
          const hash = (service as any).simpleHash('')

          expect(typeof hash).toBe('number')
          expect(hash).toBeGreaterThanOrEqual(0)
        })
      })
    })
  })

  describe('BaseEmbeddingService', () => {
    let service: BaseEmbeddingService

    beforeEach(() => {
      // Create a concrete implementation for testing
      service = new MockEmbeddingService()
    })

    describe('Configuration', () => {
      it('should apply default configuration values', () => {
        const config = (service as any).config

        expect(config.timeout).toBe(30000)
        expect(config.maxBatchSize).toBe(20)
        expect(config.concurrentRequests).toBe(5)
        expect(config.retryAttempts).toBe(3)
        expect(config.retryDelay).toBe(1000)
        expect(config.useCache).toBe(true)
        expect(config.cacheTtl).toBe(86400)
      })

      it('should override default configuration with custom values', () => {
        const customConfig: EmbeddingServiceConfig = {
          timeout: 60000,
          maxBatchSize: 10,
          retryAttempts: 5,
        }
        const customService = new MockEmbeddingService(customConfig)
        const config = (customService as any).config

        expect(config.timeout).toBe(60000)
        expect(config.maxBatchSize).toBe(10)
        expect(config.retryAttempts).toBe(5)
        // Other values should remain default
        expect(config.concurrentRequests).toBe(5)
        expect(config.retryDelay).toBe(1000)
      })
    })

    describe('generateEmbeddings batching', () => {
      it('should handle large arrays efficiently', async () => {
        const texts = Array.from({ length: 50 }, (_, i) => `Text ${i}`)
        const embeddings = await service.generateEmbeddings(texts)

        expect(embeddings).toHaveLength(50)
        embeddings.forEach(embedding => {
          expect(embedding).toHaveLength(384)
        })
      })

      it('should respect maxBatchSize configuration', async () => {
        const config: EmbeddingServiceConfig = {
          maxBatchSize: 3,
        }
        const batchService = new MockEmbeddingService(config)

        const texts = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        const embeddings = await batchService.generateEmbeddings(texts)

        expect(embeddings).toHaveLength(7)
      })
    })
  })

  describe('EmbeddingServiceFactory', () => {
    it('should create MockEmbeddingService by default', () => {
      const service = EmbeddingServiceFactory.create({})

      expect(service).toBeInstanceOf(MockEmbeddingService)
    })

    it('should create service with custom configuration', () => {
      const config: EmbeddingServiceConfig = {
        model: 'test-model',
        dimensions: 256,
      }
      const service = EmbeddingServiceFactory.create(config)

      expect(service).toBeInstanceOf(MockEmbeddingService)
      expect(service.getModelName()).toBe('test-model')
      expect(service.getDimension()).toBe(256)
    })
  })

  describe('EmbeddingService Interface', () => {
    let service: EmbeddingService

    beforeEach(() => {
      service = new MockEmbeddingService()
    })

    it('should implement all required methods', () => {
      expect(typeof service.generateEmbedding).toBe('function')
      expect(typeof service.generateEmbeddings).toBe('function')
      expect(typeof service.getDimension).toBe('function')
      expect(typeof service.getModelName).toBe('function')
      expect(typeof service.healthCheck).toBe('function')
    })

    it('should return correct types from methods', async () => {
      const embedding = await service.generateEmbedding('test')
      const embeddings = await service.generateEmbeddings(['test1', 'test2'])
      const dimension = service.getDimension()
      const modelName = service.getModelName()
      const isHealthy = await service.healthCheck()

      expect(Array.isArray(embedding)).toBe(true)
      expect(Array.isArray(embeddings)).toBe(true)
      expect(typeof dimension).toBe('number')
      expect(typeof modelName).toBe('string')
      expect(typeof isHealthy).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    let service: MockEmbeddingService

    beforeEach(() => {
      service = new MockEmbeddingService()
    })

    it('should handle null and undefined inputs gracefully', async () => {
      // The service should handle these edge cases by converting to string
      await expect(service.generateEmbedding(null as any)).rejects.toThrow()
      await expect(service.generateEmbedding(undefined as any)).rejects.toThrow()
    })

    it('should handle very long text inputs', async () => {
      const longText = 'A'.repeat(10000)
      const embedding = await service.generateEmbedding(longText)

      expect(Array.isArray(embedding)).toBe(true)
      expect(embedding).toHaveLength(384)
    })

    it('should handle unicode characters', async () => {
      const unicodeText = 'Hello 世界 🌍 emoji test'
      const embedding = await service.generateEmbedding(unicodeText)

      expect(Array.isArray(embedding)).toBe(true)
      expect(embedding).toHaveLength(384)
    })
  })

  describe('Performance', () => {
    let service: MockEmbeddingService

    beforeEach(() => {
      service = new MockEmbeddingService()
    })

    it('should generate embeddings quickly', async () => {
      const start = Date.now()
      await service.generateEmbedding('Performance test')
      const duration = Date.now() - start

      // Should complete quickly (less than 100ms for mock service)
      expect(duration).toBeLessThan(100)
    })

    it('should handle batch processing efficiently', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`)
      
      const start = Date.now()
      const embeddings = await service.generateEmbeddings(texts)
      const duration = Date.now() - start

      expect(embeddings).toHaveLength(100)
      // Should complete batch processing quickly
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Mathematical Properties', () => {
    let service: MockEmbeddingService

    beforeEach(() => {
      service = new MockEmbeddingService()
    })

    it('should generate embeddings with expected mathematical properties', async () => {
      const text = 'Mathematical test'
      const embedding = await service.generateEmbedding(text)

      // Check that all values are finite numbers
      embedding.forEach(value => {
        expect(Number.isFinite(value)).toBe(true)
      })

      // Check that the vector is normalized (magnitude ≈ 1)
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('should generate consistent embeddings for identical inputs', async () => {
      const text = 'Consistency test'
      const embedding1 = await service.generateEmbedding(text)
      const embedding2 = await service.generateEmbedding(text)

      // Should be exactly equal
      expect(embedding1).toEqual(embedding2)
    })

    it('should generate different embeddings for different inputs', async () => {
      const embedding1 = await service.generateEmbedding('Input 1')
      const embedding2 = await service.generateEmbedding('Input 2')

      // Should be different
      expect(embedding1).not.toEqual(embedding2)
    })
  })
})
