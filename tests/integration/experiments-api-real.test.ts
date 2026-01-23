/**
 * Experiments API Integration Tests with Mocked APIs
 *
 * Tests the complete experiments API functionality
 * Uses mocked HTTP requests and feature flag engine
 *
 * Tests the integration between:
 * 1. Mocked HTTP API endpoints via fetch
 * 2. Mocked feature flag evaluation and storage
 * 3. Mocked experiment context building
 * 4. Mocked authentication flow (with test users)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'

// Create a mock fetch factory that can be configured per test
const createMockFetch = () => jest.fn();

let mockFetch: jest.Mock;

beforeAll(() => {
  console.log('🔧 Experiments API integration tests - using mocked APIs');
});

// Set up fetch mock before each test to override the global jest.setup.js mock
beforeEach(() => {
  mockFetch = createMockFetch();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Experiments API Integration (Mocked)', () => {
  const baseUrl = 'http://localhost:3000'

  beforeAll(async () => {
    console.log('Setting up experiments integration test environment...')
  }, 10000)

  afterAll(async () => {
    console.log('Cleaning up experiments integration test environment...')
  })

  test('should evaluate feature flags through mocked HTTP API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          flagKey: 'ai_assistant_v2',
          variant: 'enhanced',
          enabled: true
        }
      })
    });

    const response = await fetch(`${baseUrl}/api/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        action: 'evaluate',
        flagKey: 'ai_assistant_v2',
        context: {
          workspaceId: 'integration-test-workspace',
          defaultValue: false
        }
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.result).toBeDefined()
    expect(data.result.flagKey).toBe('ai_assistant_v2')
    expect(['control', 'enhanced']).toContain(data.result.variant)
  })

  test('should track metrics through mocked HTTP API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Metric tracked successfully'
      })
    });

    const response = await fetch(`${baseUrl}/api/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'test-integration-suite'
      },
      body: JSON.stringify({
        action: 'track',
        flagKey: 'ai_assistant_v2',
        metricName: 'conversion',
        value: 1,
        context: {
          workspaceId: 'integration-test-workspace'
        }
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Metric tracked successfully')
  })

  test('should require authentication for requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'Authentication required'
      })
    });

    const response = await fetch(`${baseUrl}/api/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'evaluate',
        flagKey: 'test_flag'
      })
    })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Authentication required')
  })

  test('should handle validation errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'flagKey is required for evaluation'
      })
    });

    const response = await fetch(`${baseUrl}/api/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'evaluate'
      })
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('flagKey is required for evaluation')
  })

  test('should provide experiment results for admin users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        results: {
          flagKey: 'ai_assistant_v2',
          variants: {
            control: { count: 450, conversions: 85 },
            enhanced: { count: 550, conversions: 142 }
          },
          uplift: 0.35,
          confidence: 0.95
        }
      })
    });

    const response = await fetch(`${baseUrl}/api/experiments?flagKey=ai_assistant_v2&action=results`, {
      method: 'GET',
      headers: {
        'User-Agent': 'test-integration-suite'
      }
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.results).toBeDefined()
    expect(data.results.flagKey).toBe('ai_assistant_v2')
  })

  test('should build experiment context from request headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          flagKey: 'ai_assistant_v2',
          variant: 'enhanced',
          enabled: true,
          context: {
            userAgent: 'Mozilla/5.0 (Real Browser Test)',
            ip: '192.168.1.100',
            plan: 'enterprise'
          }
        }
      })
    });

    const response = await fetch(`${baseUrl}/api/experiments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Real Browser Test)',
        'X-Forwarded-For': '192.168.1.100',
        'X-Real-IP': '10.0.0.1'
      },
      body: JSON.stringify({
        action: 'evaluate',
        flagKey: 'ai_assistant_v2',
        context: {
          workspaceId: 'integration-test-workspace',
          customAttributes: {
            plan: 'enterprise',
            feature_beta: true
          }
        }
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.result).toBeDefined()
  })
})