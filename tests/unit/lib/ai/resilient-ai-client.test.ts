/**
 * Unit Tests for Resilient AI Client
 *
 * Tests the resilient AI client with circuit breaker protection,
 * intelligent fallback chains, and provider health management.
 *
 * Target coverage: 80%+
 */

import { jest } from '@jest/globals'

// Define mocks with jest.fn() inside the jest.mock factory
// This avoids hoisting issues
jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn()
  }
}))

// Create mock objects inside the factory to avoid hoisting issues
jest.mock('@/lib/ai/circuit-breaker', () => {
  const mockExecute = jest.fn()
  const mockGetState = jest.fn().mockReturnValue('CLOSED')
  const mockGetHealthStatus = jest.fn().mockReturnValue({
    provider: 'openai',
    state: 'CLOSED',
    isHealthy: true,
    failureRate: 0,
    averageResponseTimeMs: 100,
    uptimeMs: 10000,
    lastStateChangeTime: Date.now(),
    metrics: {}
  })
  const mockReset = jest.fn()
  const mockForceState = jest.fn()
  const mockOn = jest.fn()
  const mockOff = jest.fn()
  const mockDestroy = jest.fn()

  const mockCircuitBreaker = {
    execute: mockExecute,
    getState: mockGetState,
    getHealthStatus: mockGetHealthStatus,
    reset: mockReset,
    forceState: mockForceState,
    on: mockOn,
    off: mockOff,
    destroy: mockDestroy
  }

  const mockGetCircuitBreaker = jest.fn().mockReturnValue(mockCircuitBreaker)
  const mockExecuteManager = jest.fn()
  const mockGetAllHealthStatuses = jest.fn().mockReturnValue(new Map([
    ['openai', { isHealthy: true, state: 'CLOSED' }],
    ['anthropic', { isHealthy: true, state: 'CLOSED' }]
  ]))
  const mockGetAggregateHealth = jest.fn().mockReturnValue({
    totalProviders: 2,
    healthyProviders: 2,
    openCircuits: [],
    overallHealth: 'healthy'
  })
  const mockAddGlobalListener = jest.fn()
  const mockRemoveGlobalListener = jest.fn()
  const mockResetAll = jest.fn()
  const mockResetManager = jest.fn()
  const mockDestroyManager = jest.fn()

  const mockManager = {
    getCircuitBreaker: mockGetCircuitBreaker,
    execute: mockExecuteManager,
    getAllHealthStatuses: mockGetAllHealthStatuses,
    getAggregateHealth: mockGetAggregateHealth,
    addGlobalListener: mockAddGlobalListener,
    removeGlobalListener: mockRemoveGlobalListener,
    resetAll: mockResetAll,
    reset: mockResetManager,
    destroy: mockDestroyManager,
    // Store references for test access
    _mockCircuitBreaker: mockCircuitBreaker
  }

  return {
    AICircuitBreaker: jest.fn(() => mockCircuitBreaker),
    AICircuitBreakerManager: jest.fn(() => mockManager),
    aiCircuitBreakerManager: mockManager,
    CircuitState: {
      CLOSED: 'CLOSED',
      OPEN: 'OPEN',
      HALF_OPEN: 'HALF_OPEN'
    }
  }
})

import {
  ResilientAIClient,
  createResilientAIClient,
  resilientAIClient
} from '@/lib/ai/resilient-ai-client'
import type { ProviderConfig } from '@/lib/ai/resilient-ai-client'
import { CircuitState, aiCircuitBreakerManager } from '@/lib/ai/circuit-breaker'
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics'

// Get references to the mocked objects
const mockManager = aiCircuitBreakerManager as any
const mockCircuitBreaker = mockManager._mockCircuitBreaker

describe('ResilientAIClient', () => {
  let client: ResilientAIClient
  const mockConfigs: ProviderConfig[] = [
    {
      name: 'openai',
      priority: 1,
      enabled: true,
      isConfigured: () => true,
      circuitBreakerConfig: { failureThreshold: 5 }
    },
    {
      name: 'anthropic',
      priority: 2,
      enabled: true,
      isConfigured: () => true,
      circuitBreakerConfig: { failureThreshold: 5 }
    },
    {
      name: 'azure-openai',
      priority: 3,
      enabled: true,
      isConfigured: () => false, // Not configured
      circuitBreakerConfig: { failureThreshold: 3 }
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset mock circuit breaker
    mockCircuitBreaker.execute.mockReset()
    mockCircuitBreaker.getState.mockReturnValue(CircuitState.CLOSED)
    mockCircuitBreaker.getHealthStatus.mockReturnValue({
      provider: 'openai',
      state: CircuitState.CLOSED,
      isHealthy: true,
      failureRate: 0,
      averageResponseTimeMs: 100,
      uptimeMs: 10000,
      lastStateChangeTime: Date.now(),
      metrics: {}
    })

    mockManager.getCircuitBreaker.mockReturnValue(mockCircuitBreaker)
    mockManager.getAllHealthStatuses.mockReturnValue(new Map([
      ['openai', { isHealthy: true, state: CircuitState.CLOSED }],
      ['anthropic', { isHealthy: true, state: CircuitState.CLOSED }]
    ]))
    mockManager.getAggregateHealth.mockReturnValue({
      totalProviders: 2,
      healthyProviders: 2,
      openCircuits: [],
      overallHealth: 'healthy'
    })

    client = new ResilientAIClient(mockConfigs, mockManager as any)
  })

  afterEach(() => {
    client.destroy()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with provider configurations', () => {
      expect(client).toBeInstanceOf(ResilientAIClient)
    })

    it('should pre-initialize circuit breakers for configured providers', () => {
      expect(mockManager.getCircuitBreaker).toHaveBeenCalledWith(
        'openai',
        expect.any(Object)
      )
      expect(mockManager.getCircuitBreaker).toHaveBeenCalledWith(
        'anthropic',
        expect.any(Object)
      )
    })

    it('should set up event logging', () => {
      expect(mockManager.addGlobalListener).toHaveBeenCalled()
    })
  })

  describe('getAvailableProviders', () => {
    it('should return only enabled and configured providers', () => {
      const providers = client.getAvailableProviders()

      expect(providers).toContain('openai')
      expect(providers).toContain('anthropic')
      expect(providers).not.toContain('azure-openai')
    })

    it('should return providers sorted by priority', () => {
      const providers = client.getAvailableProviders()

      expect(providers[0]).toBe('openai')
      expect(providers[1]).toBe('anthropic')
    })
  })

  describe('getFallbackChain', () => {
    it('should return available providers excluding specified one', () => {
      const chain = client.getFallbackChain('openai')

      expect(chain).not.toContain('openai')
      expect(chain).toContain('anthropic')
    })

    it('should exclude providers with OPEN circuit state', () => {
      mockCircuitBreaker.getState.mockReturnValue(CircuitState.OPEN)

      const chain = client.getFallbackChain()

      expect(chain).toEqual([])
    })

    it('should include HALF_OPEN providers', () => {
      mockCircuitBreaker.getState.mockReturnValue(CircuitState.HALF_OPEN)

      const chain = client.getFallbackChain()

      expect(chain.length).toBeGreaterThan(0)
    })
  })

  describe('execute', () => {
    it('should execute operation with preferred provider', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: true,
        result: 'response',
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      const result = await client.execute(operation, {
        preferredProvider: 'openai',
        operationName: 'test_operation'
      })

      expect(result.success).toBe(true)
      expect(result.provider).toBe('openai')
      expect(mockCircuitBreaker.execute).toHaveBeenCalled()
    })

    it('should fallback to next provider on failure', async () => {
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: false,
        error: new Error('Provider failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: true,
        result: 'fallback response',
        durationMs: 150,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      const result = await client.execute(operation, {
        preferredProvider: 'openai'
      })

      expect(result.success).toBe(true)
      expect(result.failedProviders).toContain('openai')
    })

    it('should track failed providers', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      const result = await client.execute(operation, { maxFallbackAttempts: 1 })

      expect(result.failedProviders.length).toBeGreaterThan(0)
    })

    it('should respect maxFallbackAttempts', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      await client.execute(operation, { maxFallbackAttempts: 1 })

      expect(mockCircuitBreaker.execute.mock.calls.length).toBeLessThanOrEqual(2)
    })

    it('should throw when no providers are available', async () => {
      const emptyClient = new ResilientAIClient([], mockManager as any)

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      await expect(emptyClient.execute(operation)).rejects.toThrow('No AI providers are available')

      emptyClient.destroy()
    })

    it('should return complete failure result when all providers fail', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.OPEN
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      const result = await client.execute(operation, { maxFallbackAttempts: 0 })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('All providers failed')
    })

    it('should record metrics for operations', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: true,
        result: 'response',
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      await client.execute(operation, { operationName: 'test_op' })

      expect(datadogMetrics.histogram).toHaveBeenCalledWith(
        'resilient_ai.operation_latency',
        expect.any(Number),
        expect.any(Object)
      )
      expect(datadogMetrics.increment).toHaveBeenCalledWith(
        'resilient_ai.operations',
        1,
        expect.any(Object)
      )
    })
  })

  describe('executeWithProvider', () => {
    it('should execute operation with specific provider', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: true,
        result: 'response',
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn(() => Promise.resolve('result'))

      const result = await client.executeWithProvider('anthropic', operation)

      expect(result.success).toBe(true)
    })
  })

  describe('Provider Health', () => {
    it('should get health for all providers', () => {
      const health = client.getProviderHealth()

      expect(health).toBeInstanceOf(Map)
      expect(mockManager.getAllHealthStatuses).toHaveBeenCalled()
    })

    it('should get overall health status', () => {
      const health = client.getOverallHealth()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('totalProviders')
      expect(health).toHaveProperty('healthyProviders')
    })

    it('should report healthy when all providers are healthy', () => {
      mockManager.getAggregateHealth.mockReturnValue({
        totalProviders: 2,
        healthyProviders: 2,
        openCircuits: [],
        overallHealth: 'healthy'
      })

      const health = client.getOverallHealth()

      expect(health.healthy).toBe(true)
    })
  })

  describe('Metrics', () => {
    it('should return all metrics', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: true,
        result: 'response',
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))
      await client.execute(operation)

      const metrics = client.getMetrics()

      expect(metrics).toHaveProperty('providerHealth')
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics.totalRequests).toBe(1)
    })
  })

  describe('Provider Management', () => {
    it('should reset specific provider', () => {
      client.resetProvider('openai')

      expect(mockManager.reset).toHaveBeenCalledWith('openai')
    })

    it('should reset all providers and metrics', () => {
      client.resetAll()

      expect(mockManager.resetAll).toHaveBeenCalled()
      expect(client.getMetrics().totalRequests).toBe(0)
    })

    it('should add new provider', () => {
      const newConfig: ProviderConfig = {
        name: 'gemini',
        priority: 5,
        enabled: true,
        isConfigured: () => true
      }

      client.addProvider(newConfig)

      const providers = client.getAvailableProviders()
      expect(providers).toContain('gemini')
    })

    it('should enable/disable providers', () => {
      client.setProviderEnabled('openai', false)

      const providers = client.getAvailableProviders()
      expect(providers).not.toContain('openai')

      client.setProviderEnabled('openai', true)

      const providersAfter = client.getAvailableProviders()
      expect(providersAfter).toContain('openai')
    })

    it('should force provider state', () => {
      client.forceProviderState('openai', CircuitState.OPEN)

      expect(mockCircuitBreaker.forceState).toHaveBeenCalledWith(CircuitState.OPEN)
    })
  })

  describe('Cleanup', () => {
    it('should destroy circuit breaker manager', () => {
      client.destroy()

      expect(mockManager.destroy).toHaveBeenCalled()
    })
  })
})

describe('createResilientAIClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create client with default configs', () => {
    const client = createResilientAIClient()

    expect(client).toBeInstanceOf(ResilientAIClient)
    client.destroy()
  })

  it('should create client with custom configs', () => {
    const customConfigs: ProviderConfig[] = [
      {
        name: 'custom-provider',
        priority: 1,
        enabled: true,
        isConfigured: () => true
      }
    ]

    const client = createResilientAIClient(customConfigs)

    expect(client).toBeInstanceOf(ResilientAIClient)
    expect(client.getAvailableProviders()).toContain('custom-provider')
    client.destroy()
  })
})

describe('Singleton Instance', () => {
  it('should export singleton resilientAIClient', () => {
    expect(resilientAIClient).toBeInstanceOf(ResilientAIClient)
  })
})
