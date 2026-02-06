/**
 * Unit Tests for Resilient AI Client
 *
 * Tests the resilient AI client with circuit breaker protection,
 * intelligent fallback chains, and provider health management.
 *
 * Target coverage: 80%+
 */

import { jest } from '@jest/globals'

// Mock dependencies before imports
jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn()
  }
}))

// Create mock objects that will be used by jest.mock
const mockCircuitBreaker = {
  execute: jest.fn(),
  getState: jest.fn().mockReturnValue('CLOSED'),
  getHealthStatus: jest.fn().mockReturnValue({
    provider: 'openai',
    state: 'CLOSED',
    isHealthy: true,
    failureRate: 0,
    averageResponseTimeMs: 100,
    uptimeMs: 10000,
    lastStateChangeTime: Date.now(),
    metrics: {}
  }),
  reset: jest.fn(),
  forceState: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn()
}

const mockCircuitBreakerManager = {
  getCircuitBreaker: jest.fn().mockReturnValue(mockCircuitBreaker),
  execute: jest.fn(),
  getAllHealthStatuses: jest.fn().mockReturnValue(new Map([
    ['openai', { isHealthy: true, state: 'CLOSED' }],
    ['anthropic', { isHealthy: true, state: 'CLOSED' }]
  ])),
  getAggregateHealth: jest.fn().mockReturnValue({
    totalProviders: 2,
    healthyProviders: 2,
    openCircuits: [],
    overallHealth: 'healthy'
  }),
  addGlobalListener: jest.fn(),
  removeGlobalListener: jest.fn(),
  resetAll: jest.fn(),
  reset: jest.fn(),
  destroy: jest.fn()
}

// Use jest.doMock to avoid hoisting issues
jest.mock('@/lib/ai/circuit-breaker', () => {
  return {
    AICircuitBreaker: jest.fn().mockImplementation(() => mockCircuitBreaker),
    AICircuitBreakerManager: jest.fn().mockImplementation(() => mockCircuitBreakerManager),
    aiCircuitBreakerManager: mockCircuitBreakerManager,
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
import { CircuitState } from '@/lib/ai/circuit-breaker'
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics'

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

    mockCircuitBreakerManager.getCircuitBreaker.mockReturnValue(mockCircuitBreaker)
    mockCircuitBreakerManager.getAllHealthStatuses.mockReturnValue(new Map([
      ['openai', { isHealthy: true, state: CircuitState.CLOSED }],
      ['anthropic', { isHealthy: true, state: CircuitState.CLOSED }]
    ]))
    mockCircuitBreakerManager.getAggregateHealth.mockReturnValue({
      totalProviders: 2,
      healthyProviders: 2,
      openCircuits: [],
      overallHealth: 'healthy'
    })

    client = new ResilientAIClient(mockConfigs, mockCircuitBreakerManager as any)
  })

  afterEach(() => {
    client.destroy()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with provider configurations', () => {
      expect(client).toBeInstanceOf(ResilientAIClient)
    })

    it('should pre-initialize circuit breakers for configured providers', () => {
      // Only openai and anthropic are configured (isConfigured returns true)
      expect(mockCircuitBreakerManager.getCircuitBreaker).toHaveBeenCalledWith(
        'openai',
        expect.any(Object)
      )
      expect(mockCircuitBreakerManager.getCircuitBreaker).toHaveBeenCalledWith(
        'anthropic',
        expect.any(Object)
      )
    })

    it('should set up event logging', () => {
      expect(mockCircuitBreakerManager.addGlobalListener).toHaveBeenCalled()
    })
  })

  describe('getAvailableProviders', () => {
    it('should return only enabled and configured providers', () => {
      const providers = client.getAvailableProviders()

      expect(providers).toContain('openai')
      expect(providers).toContain('anthropic')
      expect(providers).not.toContain('azure-openai') // Not configured
    })

    it('should return providers sorted by priority', () => {
      const providers = client.getAvailableProviders()

      expect(providers[0]).toBe('openai') // priority 1
      expect(providers[1]).toBe('anthropic') // priority 2
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
      // First call fails
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: false,
        error: new Error('Provider failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })
      // Second call succeeds
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

      const result = await client.execute(operation, { maxFallbackAttempts: 1 })

      // Should only attempt original + 1 fallback = 2 calls max
      expect(mockCircuitBreaker.execute.mock.calls.length).toBeLessThanOrEqual(2)
    })

    it('should throw when no providers are available', async () => {
      const emptyClient = new ResilientAIClient([], mockCircuitBreakerManager as any)

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

    it('should record fallback metrics when fallback is used', async () => {
      // First fails
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })
      // Second succeeds
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: true,
        result: 'response',
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))

      await client.execute(operation)

      expect(datadogMetrics.increment).toHaveBeenCalledWith(
        'resilient_ai.fallback_used',
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
      expect(mockCircuitBreakerManager.getCircuitBreaker).toHaveBeenCalledWith(
        'anthropic',
        expect.anything()
      )
    })

    it('should not use fallback chain', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.OPEN
      })

      const operation = jest.fn(() => Promise.resolve('result'))

      const result = await client.executeWithProvider('openai', operation)

      expect(result.success).toBe(false)
      // Should only call execute once (no fallback)
      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe('Provider Health', () => {
    it('should get health for all providers', () => {
      const health = client.getProviderHealth()

      expect(health).toBeInstanceOf(Map)
      expect(mockCircuitBreakerManager.getAllHealthStatuses).toHaveBeenCalled()
    })

    it('should get overall health status', () => {
      const health = client.getOverallHealth()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('totalProviders')
      expect(health).toHaveProperty('healthyProviders')
      expect(health).toHaveProperty('openCircuits')
    })

    it('should report healthy when all providers are healthy', () => {
      mockCircuitBreakerManager.getAggregateHealth.mockReturnValue({
        totalProviders: 2,
        healthyProviders: 2,
        openCircuits: [],
        overallHealth: 'healthy'
      })

      const health = client.getOverallHealth()

      expect(health.healthy).toBe(true)
    })

    it('should report unhealthy when some providers are down', () => {
      mockCircuitBreakerManager.getAggregateHealth.mockReturnValue({
        totalProviders: 2,
        healthyProviders: 1,
        openCircuits: ['openai'],
        overallHealth: 'degraded'
      })

      const health = client.getOverallHealth()

      expect(health.healthy).toBe(false)
      expect(health.degradedProviders).toBe(1)
      expect(health.openCircuits).toContain('openai')
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
      expect(metrics).toHaveProperty('fallbackChain')
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('fallbackExecutions')
      expect(metrics).toHaveProperty('completeFailures')
      expect(metrics.totalRequests).toBe(1)
    })

    it('should track fallback executions', async () => {
      // First fails
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })
      // Second succeeds
      mockCircuitBreaker.execute.mockResolvedValueOnce({
        success: true,
        result: 'response',
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.CLOSED
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))
      await client.execute(operation)

      const metrics = client.getMetrics()
      expect(metrics.fallbackExecutions).toBe(1)
    })

    it('should track complete failures', async () => {
      mockCircuitBreaker.execute.mockResolvedValue({
        success: false,
        error: new Error('Failed'),
        durationMs: 100,
        usedFallback: false,
        circuitState: CircuitState.OPEN
      })

      const operation = jest.fn((provider: string) => Promise.resolve('result'))
      await client.execute(operation, { maxFallbackAttempts: 0 })

      const metrics = client.getMetrics()
      expect(metrics.completeFailures).toBe(1)
    })
  })

  describe('Provider Management', () => {
    it('should reset specific provider', () => {
      client.resetProvider('openai')

      expect(mockCircuitBreakerManager.reset).toHaveBeenCalledWith('openai')
    })

    it('should reset all providers and metrics', () => {
      client.resetAll()

      expect(mockCircuitBreakerManager.resetAll).toHaveBeenCalled()
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

    it('should update provider configuration', () => {
      client.updateProviderConfig('openai', { priority: 10, enabled: false })

      // The provider should still exist but be disabled
      const providers = client.getAvailableProviders()
      expect(providers).not.toContain('openai')
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

  describe('Event Logging', () => {
    it('should log state changes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Get the listener that was added
      const addListenerCalls = mockCircuitBreakerManager.addGlobalListener.mock.calls
      expect(addListenerCalls.length).toBeGreaterThan(0)

      const listener = addListenerCalls[0][0]

      // Simulate state change event
      listener({
        type: 'state_change',
        provider: 'openai',
        previousState: CircuitState.CLOSED,
        currentState: CircuitState.OPEN,
        timestamp: Date.now(),
        metrics: {}
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should log failures', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const addListenerCalls = mockCircuitBreakerManager.addGlobalListener.mock.calls
      const listener = addListenerCalls[0][0]

      listener({
        type: 'failure',
        provider: 'openai',
        currentState: CircuitState.CLOSED,
        timestamp: Date.now(),
        error: new Error('Test error'),
        metrics: {}
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('Cleanup', () => {
    it('should destroy circuit breaker manager', () => {
      client.destroy()

      expect(mockCircuitBreakerManager.destroy).toHaveBeenCalled()
    })
  })
})

describe('createResilientAIClient', () => {
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
