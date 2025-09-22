/**
 * REAL OpenRouter Integration Tests
 *
 * Tests actual OpenRouter API connectivity and AI model functionality
 * NO MOCKING - Real API calls to verify integration works
 *
 * Staff Engineer Implementation - Replacing over-mocked AI tests
 */

const { describe, test, expect, beforeAll } = require('@jest/globals');

// Skip these tests if not in CI/production environment with real API key
const shouldRunRealTests =
  process.env.ENABLE_REAL_AI_TESTS === 'true' &&
  process.env.RUN_REAL_OPENROUTER_TESTS === 'true' &&
  process.env.OPENROUTER_API_KEY;

// REAL TESTING: Clear all global mocks to enable actual API calls
beforeAll(() => {
  if (shouldRunRealTests) {
    // Restore real fetch for actual API calls
    jest.restoreAllMocks();

    console.log('🌐 Real integration testing enabled - all mocks cleared');
  }
});

let cachedFetch = null;
async function fetchOpenRouter(url, options) {
  if (!cachedFetch) {
    const mod = await import('node-fetch');
    cachedFetch = mod.default || mod;
  }
  return cachedFetch(url, options);
}

const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

if (!shouldRunRealTests) {
  describe.skip('Real OpenRouter Integration Tests (NO MOCKING)', () => {
    test('skipped - requires ENABLE_REAL_AI_TESTS=true and RUN_REAL_OPENROUTER_TESTS=true', () => {
      expect(true).toBe(true)
    })
  })
}

conditionalDescribe('Real OpenRouter Integration Tests (NO MOCKING)', () => {
  const apiKey = process.env.OPENROUTER_API_KEY
  const baseUrl = 'https://openrouter.ai/api/v1'
  const primaryFreeModel = process.env.OPENROUTER_FREE_MODEL?.trim() || 'deepseek/deepseek-chat-v3.1:free'
  const secondaryFreeModel = 'openai/gpt-oss-20b:free'

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY must be set for real integration tests')
    }
    if (/test|fake|mock/i.test(apiKey)) {
      throw new Error('OPENROUTER_API_KEY appears to be a test/fake key - use real API key')
    }
  })

  test('auth endpoint accepts the provided key', async () => {
    const response = await fetchOpenRouter(`${baseUrl}/auth/key`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    expect(response.ok).toBe(true)

    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    expect(data).toHaveProperty('data')
    expect(data.data).toHaveProperty('label')
  }, 15000)

  test('model catalogue includes free-tier models', async () => {
    const response = await fetchOpenRouter(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    expect(response.ok).toBe(true)

    const text = await response.text()
    const data = text ? JSON.parse(text) : { data: [] }
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)

    const modelIds = data.data.map((model: { id: string }) => model.id)
    expect(modelIds).toContain(primaryFreeModel)
    if (modelIds.includes(secondaryFreeModel)) {
      expect(modelIds).toContain(secondaryFreeModel)
    }
  }, 15000)

  test('chat completion succeeds with a free OpenRouter model', async () => {
    const chatRequest = {
      model: primaryFreeModel,
      messages: [
        {
          role: 'user',
          content: 'Provide a tiny TypeScript function named add that adds two numbers.'
        }
      ],
      max_tokens: 120,
      temperature: 0.2
    }

    const response = await fetchOpenRouter(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.dev',
        'X-Title': 'VibeCode WebGUI Integration Test'
      },
      body: JSON.stringify(chatRequest)
    })

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(Array.isArray(data.choices)).toBe(true)
    expect(data.choices.length).toBeGreaterThan(0)
    const content = data.choices[0]?.message?.content ?? ''
    expect(content.length).toBeGreaterThan(10)
  }, 30000)

  test('chat completion works with a secondary free model when available', async () => {
    const chatRequest = {
      model: secondaryFreeModel,
      messages: [
        {
          role: 'user',
          content: 'Briefly describe what an HTTP 404 status code means.'
        }
      ],
      max_tokens: 100,
      temperature: 0.2
    }

    const response = await fetchOpenRouter(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.dev',
        'X-Title': 'VibeCode WebGUI Integration Test'
      },
      body: JSON.stringify(chatRequest)
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      expect(content.length).toBeGreaterThan(10)
    } else {
      expect([402, 422, 429, 503]).toContain(response.status)
    }
  }, 30000)
})
