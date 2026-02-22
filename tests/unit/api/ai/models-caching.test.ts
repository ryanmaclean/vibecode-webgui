/**
 * @jest-environment node
 */

/**
 * Tests for /api/ai/models caching behavior
 * Verifies cache key generation, TTL usage, HTTP cache headers, and cache-aside pattern
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/ai/models/route'
import { cacheGetOrSet, CacheKeyGenerators, TTLPresets } from '@/lib/cache/cache-utils'
import { CACHE_HEADER_PRESETS } from '@/lib/cache/http-cache-headers'
import { modelRegistry } from '@/lib/ai/models/model-registry'
import { createAPIRateLimit } from '@/lib/rate-limiting'

// Mock dependencies
jest.mock('@/lib/cache/cache-utils', () => ({
  cacheGetOrSet: jest.fn(),
  CacheKeyGenerators: {
    aiModels: jest.fn(() => 'ai:models:all'),
    aiModelsWithParams: jest.fn((params: string) => `ai:models:${params}`),
  },
  TTLPresets: {
    AI_MODELS: 600,
  },
}))

jest.mock('@/lib/cache/http-cache-headers', () => ({
  CACHE_HEADER_PRESETS: {
    AI_MODELS: { 'Cache-Control': 'public, s-maxage=300, max-age=300, stale-while-revalidate=3600' },
  },
}))

jest.mock('@/lib/ai/models/model-registry', () => ({
  modelRegistry: {
    searchModels: jest.fn(),
    getRecommendation: jest.fn(),
    getModelCount: jest.fn(),
    getProviders: jest.fn(),
    getAllTags: jest.fn(),
    loadFromOpenRouter: jest.fn(),
  },
}))

jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() =>
    jest.fn().mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60000,
    })
  ),
}))

// Default mock return values
const mockSearchResult = {
  models: [
    {
      id: 'anthropic/claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: { id: 'anthropic', name: 'Anthropic', tier: 'premium', available: true },
      qualityTier: 'excellent',
      speedTier: 'fast',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  hasNextPage: false,
}

const mockResponseData = {
  success: true,
  data: mockSearchResult,
  meta: {
    totalModels: 42,
    providers: [{ id: 'anthropic', name: 'Anthropic', tier: 'premium', available: true }],
    availableTags: ['chat', 'code'],
  },
}

describe('/api/ai/models caching behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default: cacheGetOrSet executes the factory immediately
    ;(cacheGetOrSet as jest.Mock).mockImplementation(async (_key, factory, _opts) => {
      return factory()
    })

    // Default model registry mocks
    ;(modelRegistry.searchModels as jest.Mock).mockReturnValue(mockSearchResult)
    ;(modelRegistry.getModelCount as jest.Mock).mockReturnValue(42)
    ;(modelRegistry.getProviders as jest.Mock).mockReturnValue([
      { id: 'anthropic', name: 'Anthropic', tier: 'premium', available: true },
    ])
    ;(modelRegistry.getAllTags as jest.Mock).mockReturnValue(['chat', 'code'])
    ;(modelRegistry.loadFromOpenRouter as jest.Mock).mockResolvedValue(undefined)
  })

  describe('GET - cache key generation', () => {
    it('should use aiModels() cache key when no query params', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/models')
      await GET(request)

      expect(CacheKeyGenerators.aiModels).toHaveBeenCalled()
      expect(CacheKeyGenerators.aiModelsWithParams).not.toHaveBeenCalled()
      expect(cacheGetOrSet).toHaveBeenCalledWith(
        'ai:models:all',
        expect.any(Function),
        expect.objectContaining({ ttl: TTLPresets.AI_MODELS })
      )
    })

    it('should use aiModelsWithParams() cache key when query params are present', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/ai/models?query=claude&sortBy=name'
      )
      await GET(request)

      expect(CacheKeyGenerators.aiModelsWithParams).toHaveBeenCalledWith('query=claude&sortBy=name')
      expect(CacheKeyGenerators.aiModels).not.toHaveBeenCalled()
    })

    it('should use TTLPresets.AI_MODELS (600s) as the TTL', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/models')
      await GET(request)

      expect(cacheGetOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { ttl: 600 }
      )
    })
  })

  describe('GET - cache-aside pattern', () => {
    it('should return cached data without calling model registry on cache hit', async () => {
      ;(cacheGetOrSet as jest.Mock).mockResolvedValue(mockResponseData)

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(modelRegistry.searchModels).not.toHaveBeenCalled()
      expect(modelRegistry.loadFromOpenRouter).not.toHaveBeenCalled()
    })

    it('should call model registry factory on cache miss', async () => {
      ;(cacheGetOrSet as jest.Mock).mockImplementation(async (_key, factory, _opts) => {
        return factory()
      })

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      await GET(request)

      expect(modelRegistry.searchModels).toHaveBeenCalled()
      expect(modelRegistry.getModelCount).toHaveBeenCalled()
      expect(modelRegistry.getProviders).toHaveBeenCalled()
      expect(modelRegistry.getAllTags).toHaveBeenCalled()
    })

    it('should trigger loadFromOpenRouter non-blocking on cache miss', async () => {
      ;(cacheGetOrSet as jest.Mock).mockImplementation(async (_key, factory, _opts) => {
        return factory()
      })

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      await GET(request)

      expect(modelRegistry.loadFromOpenRouter).toHaveBeenCalled()
    })

    it('should silently ignore loadFromOpenRouter errors', async () => {
      ;(modelRegistry.loadFromOpenRouter as jest.Mock).mockRejectedValue(
        new Error('OpenRouter unavailable')
      )

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      // Error is silenced, response still succeeds
      expect(response.status).toBe(200)
    })
  })

  describe('GET - HTTP cache headers', () => {
    it('should include AI_MODELS cache headers in response', async () => {
      ;(cacheGetOrSet as jest.Mock).mockResolvedValue(mockResponseData)

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.headers.get('Cache-Control')).toBe(
        'public, s-maxage=300, max-age=300, stale-while-revalidate=3600'
      )
    })

    it('should apply CACHE_HEADER_PRESETS.AI_MODELS to the response', async () => {
      ;(cacheGetOrSet as jest.Mock).mockResolvedValue(mockResponseData)

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      const expectedHeaders = CACHE_HEADER_PRESETS.AI_MODELS
      for (const [key, value] of Object.entries(expectedHeaders)) {
        expect(response.headers.get(key)).toBe(value)
      }
    })
  })

  describe('GET - response shape', () => {
    it('should return 200 with success data on cache hit', async () => {
      ;(cacheGetOrSet as jest.Mock).mockResolvedValue(mockResponseData)

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.meta).toBeDefined()
    })

    it('should include totalModels, providers, and availableTags in meta', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.meta.totalModels).toBe(42)
      expect(Array.isArray(data.meta.providers)).toBe(true)
      expect(Array.isArray(data.meta.availableTags)).toBe(true)
    })

    it('should shape provider data correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      const data = await response.json()
      const provider = data.meta.providers[0]
      expect(provider.id).toBeDefined()
      expect(provider.name).toBeDefined()
      expect(provider.tier).toBeDefined()
      expect(provider.available).toBeDefined()
    })
  })

  describe('GET - query parameter handling', () => {
    it('should pass query params to searchModels', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/ai/models?query=claude&sortBy=name&sortDirection=asc'
      )
      await GET(request)

      expect(modelRegistry.searchModels).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'claude', sortBy: 'name', sortDirection: 'asc' })
      )
    })

    it('should parse providers as comma-separated list', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/ai/models?providers=anthropic,openai'
      )
      await GET(request)

      expect(modelRegistry.searchModels).toHaveBeenCalledWith(
        expect.objectContaining({ providers: ['anthropic', 'openai'] })
      )
    })

    it('should parse boolean params correctly', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/ai/models?requiresVision=true&includeDeprecated=false'
      )
      await GET(request)

      expect(modelRegistry.searchModels).toHaveBeenCalledWith(
        expect.objectContaining({ requiresVision: true, includeDeprecated: false })
      )
    })

    it('should return 400 for invalid sortBy value', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/ai/models?sortBy=invalid_field'
      )
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid query parameters')
    })
  })

  describe('GET - rate limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Override the rate limiter to simulate exceeded limit
      const rateLimitFn = jest.fn().mockResolvedValue({
        success: false,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      })
      ;(createAPIRateLimit as jest.Mock).mockReturnValue(rateLimitFn)

      // Re-import to get fresh module with updated mock
      jest.resetModules()
      jest.mock('@/lib/rate-limiting', () => ({
        createAPIRateLimit: jest.fn(() =>
          jest.fn().mockResolvedValue({
            success: false,
            limit: 120,
            remaining: 0,
            reset: Date.now() + 60000,
            retryAfter: 60,
          })
        ),
      }))

      const { GET: freshGET } = await import('@/app/api/ai/models/route')
      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await freshGET(request)

      expect(response.status).toBe(429)
    })
  })

  describe('GET - error handling', () => {
    it('should return 500 when cacheGetOrSet throws', async () => {
      ;(cacheGetOrSet as jest.Mock).mockRejectedValue(new Error('Cache layer failure'))

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Cache layer failure')
    })

    it('should return 500 when modelRegistry.searchModels throws', async () => {
      ;(modelRegistry.searchModels as jest.Mock).mockImplementation(() => {
        throw new Error('Registry failure')
      })

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Registry failure')
    })

    it('should return generic error message for non-Error throws', async () => {
      ;(cacheGetOrSet as jest.Mock).mockRejectedValue('string error')

      const request = new NextRequest('http://localhost:3000/api/ai/models')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to fetch models')
    })
  })

  describe('POST - model recommendations', () => {
    it('should return recommendation for valid action=recommend payload', async () => {
      ;(modelRegistry.getRecommendation as jest.Mock).mockReturnValue({
        model: {
          id: 'anthropic/claude-3-5-sonnet',
          name: 'Claude 3.5 Sonnet',
          provider: { name: 'Anthropic' },
          qualityTier: 'excellent',
          performance: { speedTier: 'fast' },
          pricing: { inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
          limits: { maxContextTokens: 200000 },
        },
        confidence: 0.95,
        reason: 'Best balance of quality and speed',
        estimatedCost: 0.01,
        alternatives: [],
      })

      const request = new NextRequest('http://localhost:3000/api/ai/models', {
        method: 'POST',
        body: JSON.stringify({
          action: 'recommend',
          params: { taskType: 'code_generation' },
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.recommendation).toBeDefined()
      expect(data.recommendation.model.id).toBe('anthropic/claude-3-5-sonnet')
      expect(data.recommendation.confidence).toBe(0.95)
    })

    it('should return 400 for invalid recommendation params', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/models', {
        method: 'POST',
        body: JSON.stringify({
          action: 'recommend',
          params: { taskType: 'not_a_valid_task' },
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid recommendation parameters')
    })

    it('should return 400 for unknown action', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/models', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknown_action' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid action')
    })

    it('should return 500 when getRecommendation throws', async () => {
      ;(modelRegistry.getRecommendation as jest.Mock).mockImplementation(() => {
        throw new Error('Registry recommendation error')
      })

      const request = new NextRequest('http://localhost:3000/api/ai/models', {
        method: 'POST',
        body: JSON.stringify({
          action: 'recommend',
          params: { taskType: 'chat' },
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Registry recommendation error')
    })
  })
})
