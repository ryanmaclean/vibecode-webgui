// LiteLLM Integration Tests for VibeCode
// ====================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { LiteLLMClient } from '@/lib/ai-clients/litellm-client';
import { getServerSession } from 'next-auth';

// Mock next-auth for testing
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock Datadog monitoring
jest.mock('@/lib/monitoring', () => ({
  trackAIRequest: jest.fn(),
  trackError: jest.fn(),
  trackMetric: jest.fn()
}));

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
  apiKey: process.env.LITELLM_MASTER_KEY || 'sk-test-key',
  timeout: 30000
};

// Mock session data
const mockSession = {
  user: {
    id: 'test-user-123',
    email: 'test@vibecode.com',
    name: 'Test User'
  }
};

describe('LiteLLM Integration Tests', () => {
  let client: LiteLLMClient;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    
    // Mock getServerSession
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    
    // Store original fetch
    originalFetch = global.fetch;
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    // Create fresh client for each test
    client = new LiteLLMClient(TEST_CONFIG);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('LiteLLM Client', () => {
    describe('Initialization', () => {
      it('should initialize with default configuration', () => {
        const defaultClient = new LiteLLMClient({
          baseUrl: 'http://localhost:4000',
          apiKey: 'test-key'
        });

        expect(defaultClient).toBeDefined();
        expect(defaultClient.getConfig().timeout).toBe(60000);
        expect(defaultClient.getConfig().maxRetries).toBe(3);
      });

      it('should initialize with custom configuration', () => {
        const customClient = new LiteLLMClient({
          baseUrl: 'http://custom:4000',
          apiKey: 'custom-key',
          timeout: 30000,
          maxRetries: 5,
          enableLogging: false
        });

        const config = customClient.getConfig();
        expect(config.timeout).toBe(30000);
        expect(config.maxRetries).toBe(5);
        expect(config.enableLogging).toBe(false);
      });
    });

    describe('Chat Completions', () => {
      it('should handle successful chat completion', async () => {
        // Mock successful response
        const mockResponse = {
          id: 'chatcmpl-test-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o-mini',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18
          },
          cost: {
            input_cost: 0.000015,
            output_cost: 0.0000048,
            total_cost: 0.0000198
          }
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

        const request = {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user' as const, content: 'Hello' }
          ],
          temperature: 0.7,
          max_tokens: 100
        };

        const response = await client.createChatCompletion(request);

        expect(response).toEqual(mockResponse);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/chat/completions'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TEST_CONFIG.apiKey}`
            })
          })
        );
      });

      it('should handle chat completion errors', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Invalid request')
        });

        const request = {
          model: 'invalid-model',
          messages: [
            { role: 'user' as const, content: 'Hello' }
          ]
        };

        await expect(client.createChatCompletion(request))
          .rejects.toThrow('HTTP 400: Invalid request');
      });

      it('should implement retry logic on failures', async () => {
        let callCount = 0;
        global.fetch = jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'test',
              choices: [{ message: { content: 'Success after retry' } }]
            })
          });
        });

        const request = {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user' as const, content: 'Test retry' }]
        };

        const response = await client.createChatCompletion(request);
        
        expect(callCount).toBe(3);
        expect(response.choices[0].message.content).toBe('Success after retry');
      });
    });

    describe('Streaming Chat Completions', () => {
      it('should handle streaming responses', async () => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" there!"}}]}\n\n',
          'data: [DONE]\n\n'
        ];

        const mockReadableStream = {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0]) })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1]) })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[2]) })
              .mockResolvedValueOnce({ done: true })
          })
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          body: mockReadableStream
        });

        const receivedChunks: any[] = [];
        const request = {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user' as const, content: 'Hello' }]
        };

        await client.createChatCompletionStream(
          request,
          (chunk) => receivedChunks.push(chunk)
        );

        expect(receivedChunks).toHaveLength(2);
        expect(receivedChunks[0].choices[0].delta.content).toBe('Hello');
        expect(receivedChunks[1].choices[0].delta.content).toBe(' there!');
      });
    });

    describe('Embeddings', () => {
      it('should create embeddings successfully', async () => {
        const mockResponse = {
          object: 'list',
          data: [{
            object: 'embedding',
            embedding: Array(1536).fill(0).map(() => Math.random()),
            index: 0
          }],
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 5,
            total_tokens: 5
          },
          cost: {
            total_cost: 0.0000001
          }
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

        const request = {
          model: 'text-embedding-3-small',
          input: 'Test text for embedding'
        };

        const response = await client.createEmbedding(request);

        expect(response).toEqual(mockResponse);
        expect(response.data[0].embedding).toHaveLength(1536);
      });
    });

    describe('Model Management', () => {
      it('should list available models', async () => {
        const mockModels = {
          data: [
            {
              id: 'gpt-4o',
              object: 'model',
              created: Date.now(),
              owned_by: 'openai',
              provider: 'openai',
              mode: 'chat',
              supports_function_calling: true,
              supports_vision: true,
              input_cost_per_token: 0.0000025,
              output_cost_per_token: 0.00001
            },
            {
              id: 'claude-3.5-sonnet',
              object: 'model',
              created: Date.now(),
              owned_by: 'anthropic',
              provider: 'anthropic',
              mode: 'chat',
              supports_function_calling: true,
              supports_vision: true,
              input_cost_per_token: 0.000003,
              output_cost_per_token: 0.000015
            }
          ]
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockModels)
        });

        const models = await client.listModels();

        expect(models.data).toHaveLength(2);
        expect(models.data[0].id).toBe('gpt-4o');
        expect(models.data[1].id).toBe('claude-3.5-sonnet');
      });

      it('should get specific model information', async () => {
        const mockModel = {
          id: 'gpt-4o-mini',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai',
          provider: 'openai',
          mode: 'chat'
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockModel)
        });

        const model = await client.getModel('gpt-4o-mini');

        expect(model.id).toBe('gpt-4o-mini');
        expect(model.provider).toBe('openai');
      });
    });

    describe('Health and Status', () => {
      it('should check health status', async () => {
        const mockHealth = {
          status: 'healthy',
          models: 10,
          uptime: 3600,
          version: '1.0.0',
          database: true,
          redis: true
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockHealth)
        });

        const health = await client.checkHealth();

        expect(health.status).toBe('healthy');
        expect(health.models).toBe(10);
        expect(health.database).toBe(true);
        expect(health.redis).toBe(true);
      });
    });

    describe('Statistics and Monitoring', () => {
      it('should track client statistics', () => {
        // Simulate some requests
        client.getClientStats();

        const stats = client.getClientStats();
        expect(stats).toHaveProperty('requests_total');
        expect(stats).toHaveProperty('errors_total');
        expect(stats).toHaveProperty('cost_total');
        expect(stats).toHaveProperty('error_rate');
        expect(stats).toHaveProperty('uptime');
      });

      it('should emit events for monitoring', (done) => {
        const mockResponse = {
          id: 'test',
          choices: [{ message: { content: 'Test' } }],
          usage: { total_tokens: 10 },
          cost: { total_cost: 0.0001 }
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

        client.on('chat_completion', (data) => {
          expect(data.request).toBeDefined();
          expect(data.response).toBeDefined();
          expect(data.duration).toBeGreaterThan(0);
          expect(data.cost).toBeDefined();
          done();
        });

        client.createChatCompletion({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }]
        });
      });
    });
  });

  describe('API Routes Integration', () => {
    const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    describe('GET endpoints', () => {
      it('should return service information', async () => {
        const response = await fetch(`${API_BASE}/api/ai/litellm`);
        const data = await response.json();

        expect(response.status).toBe(401); // Should require auth
      });

      it('should handle health check with auth', async () => {
        // This would require setting up test authentication
        // For now, test the endpoint structure
        const response = await fetch(`${API_BASE}/api/ai/litellm?action=health`);
        expect(response.status).toBe(401); // Unauthorized without session
      });
    });

    describe('POST endpoints', () => {
      it('should handle chat completion requests', async () => {
        const requestBody = {
          action: 'chat',
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: 'Hello, test message' }
          ],
          temperature: 0.7,
          max_tokens: 100
        };

        const response = await fetch(`${API_BASE}/api/ai/litellm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        expect(response.status).toBe(401); // Should require auth
      });

      it('should handle embedding requests', async () => {
        const requestBody = {
          action: 'embedding',
          model: 'text-embedding-3-small',
          input: 'Test text for embedding'
        };

        const response = await fetch(`${API_BASE}/api/ai/litellm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        expect(response.status).toBe(401); // Should require auth
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutClient = new LiteLLMClient({
        ...TEST_CONFIG,
        timeout: 1 // Very short timeout
      });

      global.fetch = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      await expect(timeoutClient.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow();
    });

    it('should handle invalid JSON responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(client.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('Invalid JSON');
    });

    it('should handle rate limiting', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      await expect(client.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('HTTP 429: Rate limit exceeded');
    });
  });

  describe('Configuration Management', () => {
    it('should update client configuration', () => {
      const updates = {
        timeout: 45000,
        maxRetries: 5,
        enableLogging: false
      };

      client.updateConfig(updates);
      const config = client.getConfig();

      expect(config.timeout).toBe(45000);
      expect(config.maxRetries).toBe(5);
      expect(config.enableLogging).toBe(false);
    });

    it('should emit config update events', (done) => {
      client.on('config_updated', (updates) => {
        expect(updates.timeout).toBe(30000);
        done();
      });

      client.updateConfig({ timeout: 30000 });
    });
  });

  describe('Utility Functions', () => {
    it('should format costs correctly', () => {
      expect(client.formatCost(0.001234)).toBe('$0.001234');
      expect(client.formatCost(1.5)).toBe('$1.500000');
    });

    it('should format token counts', () => {
      expect(client.formatTokens(500)).toBe('500');
      expect(client.formatTokens(1500)).toBe('1.5K');
      expect(client.formatTokens(1500000)).toBe('1.5M');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      const spy = jest.spyOn(client, 'removeAllListeners');
      client.destroy();
      expect(spy).toHaveBeenCalled();
    });
  });
});

// Integration test with real LiteLLM service (skipped in CI)
describe('LiteLLM Real Service Integration', () => {
  const shouldRunRealTests = process.env.RUN_REAL_LITELLM_TESTS === 'true' && 
                           process.env.LITELLM_BASE_URL && 
                           process.env.LITELLM_MASTER_KEY;

  const testCondition = shouldRunRealTests ? describe : describe.skip;

  testCondition('Real LiteLLM Service', () => {
    let realClient: LiteLLMClient;

    beforeAll(() => {
      realClient = new LiteLLMClient({
        baseUrl: process.env.LITELLM_BASE_URL!,
        apiKey: process.env.LITELLM_MASTER_KEY!,
        enableLogging: true
      });
    });

    it('should connect to real LiteLLM service', async () => {
      const health = await realClient.checkHealth();
      expect(health.status).toBe('healthy');
    }, 30000);

    it('should list real models', async () => {
      const models = await realClient.listModels();
      expect(models.data.length).toBeGreaterThan(0);
    }, 30000);

    // Only run if we have API keys
    const apiKeyTests = process.env.OPENAI_API_KEY ? it : it.skip;

    apiKeyTests('should make real chat completion', async () => {
      const response = await realClient.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "Hello from LiteLLM integration test" exactly.' }
        ],
        max_tokens: 50
      });

      expect(response.choices[0].message.content).toContain('Hello from LiteLLM integration test');
      expect(response.usage.total_tokens).toBeGreaterThan(0);
      expect(response.cost).toBeDefined();
    }, 60000);

    afterAll(() => {
      realClient.destroy();
    });
  });
}); 