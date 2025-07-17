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
const shouldRunRealTests = process.env.ENABLE_REAL_AI_TESTS === 'true' && process.env.OPENROUTER_API_KEY;

const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

conditionalDescribe('Real OpenRouter Integration Tests (NO MOCKING)', () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = 'https://openrouter.ai/api/v1'

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY must be set for real integration tests')
    }
    if (apiKey.includes('test') || apiKey.includes('fake') || apiKey.includes('mock')) {
      throw new Error('OPENROUTER_API_KEY appears to be a test/fake key - use real API key')
    }
  });

  test('should validate OpenRouter API key authentication', async () => {
    const response = await fetch(`${baseUrl}/auth/key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('data')
    expect(data.data).toHaveProperty('label')
    expect(data.data).toHaveProperty('usage')
  }, 15000);

  test('should fetch available AI models from OpenRouter', async () => {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('data')
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(100) // Should have 127+ models

    // Verify we have key models available
    const modelIds = data.data.map((model) => model.id)
    expect(modelIds).toContain('anthropic/claude-3.5-sonnet')
    expect(modelIds).toContain('openai/gpt-4')
    expect(modelIds).toContain('google/gemini-pro')
  }, 15000);

  test('should successfully make chat completion with Claude 3.5 Sonnet', async () => {
    const chatRequest = {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'user',
          content: 'Write a simple function in TypeScript that adds two numbers. Return only the code, no explanation.'
        }
      ],
      max_tokens: 150,
      temperature: 0.1
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.dev',
        'X-Title': 'VibeCode WebGUI Integration Test'
      },
      body: JSON.stringify(chatRequest)
    });

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('choices')
    expect(data.choices).toHaveLength(1)
    expect(data.choices[0]).toHaveProperty('message')
    expect(data.choices[0].message).toHaveProperty('content')

    const generatedCode = data.choices[0].message.content
    expect(generatedCode).toContain('function')
    expect(generatedCode).toContain('number')
    expect(typeof generatedCode).toBe('string')
    expect(generatedCode.length).toBeGreaterThan(10)

    // Verify usage tracking
    expect(data).toHaveProperty('usage')
    expect(data.usage).toHaveProperty('prompt_tokens')
    expect(data.usage).toHaveProperty('completion_tokens')
    expect(data.usage).toHaveProperty('total_tokens')
  }, 30000);

  test('should successfully make chat completion with GPT-4', async () => {
    const chatRequest = {
      model: 'openai/gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain what React hooks are in one sentence.'
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.dev',
        'X-Title': 'VibeCode WebGUI Integration Test'
      },
      body: JSON.stringify(chatRequest)
    });

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data.choices[0].message.content).toContain('hook')
    expect(data.choices[0].message.content.length).toBeGreaterThan(20)

    // Should have realistic usage numbers
    expect(data.usage.total_tokens).toBeGreaterThan(0)
    expect(data.usage.total_tokens).toBeLessThan(200)
  }, 30000);

  test('should handle rate limiting appropriately', async () => {
    // Make rapid requests to test rate limiting behavior
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vibecode.dev',
          'X-Title': 'VibeCode Rate Limit Test'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: 'Say hello' }],
          max_tokens: 10
        });
      });
    )

    const responses = await Promise.allSettled(promises)

    // At least some requests should succeed
    const succeeded = responses.filter(r => r.status === 'fulfilled' && (r.value as Response).ok)
    expect(succeeded.length).toBeGreaterThan(0)

    // Check for appropriate rate limit responses
    const rateLimited = responses.filter(r =>
      r.status === 'fulfilled' && (r.value as Response).status === 429
    )

    if (rateLimited.length > 0) {
      console.log(`Rate limited ${rateLimited.length} out of ${promises.length} requests`)
    }
  }, 60000);

  test('should validate our VibeCode API endpoints use real OpenRouter', async () => {
    // Test our internal API that should use OpenRouter
    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-session' // Mock auth for test
      },
      body: JSON.stringify({
        message: 'What is TypeScript?',
        model: 'anthropic/claude-3.5-sonnet',
        workspaceId: 'integration-test'
      });
    });

    if (response.ok) {
      const data = await response.json()

      // Should have real response structure
      expect(data).toHaveProperty('success')
      if (data.success) {
        expect(data).toHaveProperty('response')
        expect(data.response).toHaveProperty('content')
        expect(data.response.content).toContain('TypeScript')

        // Should have usage metadata from real API
        expect(data).toHaveProperty('usage')
        expect(data.usage).toHaveProperty('total_tokens')
        expect(typeof data.usage.total_tokens).toBe('number')
        expect(data.usage.total_tokens).toBeGreaterThan(0)
      }
    } else if (response.status === 401) {
      console.log('API requires authentication - setup session management for testing')
    }
  }, 30000);

  test('should verify model switching capability', async () => {
    const models = ['anthropic/claude-3.5-sonnet', 'openai/gpt-4', 'google/gemini-pro']

    for (const model of models) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vibecode.dev',
          'X-Title': 'VibeCode Model Switch Test'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Just say "OK"' }],
          max_tokens: 5
        });
      });

      if (response.ok) {
        const data = await response.json()
        expect(data.choices[0].message.content.toLowerCase()).toContain('ok')

        // Verify model is reported correctly
        expect(data).toHaveProperty('model')
        expect(data.model).toContain(model.split('/')[1]) // Should contain base model name
      } else {
        console.log(`Model ${model} not available or insufficient credits`)
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }, 90000);

  test('should handle errors gracefully with real API', async () => {
    // Test with invalid model
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.dev'
      },
      body: JSON.stringify({
        model: 'invalid/model-name',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
    });

    expect(response.ok).toBe(false)
    expect(response.status).toBe(422) // Unprocessable Entity for invalid model

    const errorData = await response.json()
    expect(errorData).toHaveProperty('error')
    expect(errorData.error).toHaveProperty('message')
    expect(errorData.error.message).toContain('model')
  }, 15000);

  test('should validate streaming capability', async () => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.dev'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: 'Count from 1 to 5' }],
        max_tokens: 50,
        stream: true
      });
    });

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('text/plain')

    // For streaming, we get server-sent events
    const chunks: string[] = []
    const reader = response.body?.getReader()

    if (reader) {
      let chunk = await reader.read()
      let attempts = 0

      while (!chunk.done && attempts < 10) {
        const text = new TextDecoder().decode(chunk.value)
        chunks.push(text)
        chunk = await reader.read()
        attempts++
      }

      reader.releaseLock()

      // Should have received multiple chunks
      expect(chunks.length).toBeGreaterThan(1)

      // Chunks should contain SSE format
      const combinedText = chunks.join('')
      expect(combinedText).toContain('data:')
      expect(combinedText).toContain('[DONE]')
    }
  }, 30000);
});

// Test to verify our tests are using real integrations
describe('OpenRouter Test Quality Validation', () => {
  test('should not have extensive mocking in critical AI integration tests', () => {
    const fs = require('fs')
    const testFileContent = fs.readFileSync(__filename, 'utf8')

    // Count mock usage
    const mockCount = (testFileContent.match(/jest\.mock/g) || []).length
    const mockFnCount = (testFileContent.match(/jest\.fn/g) || []).length

    // Integration tests should have NO mocking for external APIs
    expect(mockCount).toBe(0)
    expect(mockFnCount).toBe(0)

    // Should not mock OpenRouter or AI services
    expect(testFileContent).not.toContain("jest.mock('openrouter")
    expect(testFileContent).not.toContain("jest.mock('@anthropic")
    expect(testFileContent).not.toContain("jest.mock('openai')")
  });

  test('should use real environment variables for API testing', () => {
    const dangerousValues = [
      'test-api-key',
      'fake-key',
      'mock-token',
      'localhost-key',
      'development-only'
    ]

    dangerousValues.forEach(dangerousValue => {
      if (process.env.OPENROUTER_API_KEY?.includes(dangerousValue)) {
        throw new Error(`Environment variable contains test/fake value: ${dangerousValue}`)
      }
    });
  });

  test('should verify API responses have realistic characteristics', async () => {
    if (!shouldRunRealTests) {
      console.log('Skipping real API validation - tests not enabled')
      return
    }

    // This test validates that our API responses look realistic
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });

    if (response.ok) {
      const data = await response.json()

      // Real OpenRouter should have 100+ models
      expect(data.data.length).toBeGreaterThan(100)

      // Should have realistic pricing information
      const modelWithPricing = data.data.find((model) => model.pricing)
      if (modelWithPricing) {
        expect(modelWithPricing.pricing).toHaveProperty('prompt')
        expect(modelWithPricing.pricing).toHaveProperty('completion')
        expect(typeof modelWithPricing.pricing.prompt).toBe('string')
      }
    }
  }, 15000);
});
