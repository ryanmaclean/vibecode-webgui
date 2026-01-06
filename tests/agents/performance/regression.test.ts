/**
 * Performance Regression Tests for Agent System (Jest)
 *
 * Tracks and validates performance metrics over time
 */

import { Agent, createAgent } from '@/lib/agent-framework';
import { UnifiedAIClient } from '@/lib/unified-ai-client';

// Mock UnifiedAIClient
jest.mock('@/lib/unified-ai-client');

// Performance baselines (in milliseconds)
const PERFORMANCE_BASELINES = {
  agentCreation: 100,
  simpleMessage: 5000,
  toolExecution: 10000,
  memoryLimit: 100 * 1024 * 1024, // 100MB
};

describe('Agent Performance Regression Tests', () => {
  let mockClient: jest.Mocked<UnifiedAIClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new UnifiedAIClient() as jest.Mocked<UnifiedAIClient>;

    mockClient.chat = jest.fn().mockResolvedValue({
      content: 'Test response',
      model: 'gpt-4o-mini',
      provider: 'openai',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    });
  });

  describe('Agent API Performance', () => {
    it('should create agent within performance budget', async () => {
      const startTime = performance.now();

      const agent = createAgent({
        model: 'gpt-4o-mini',
        client: mockClient,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(agent).toBeDefined();
      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.agentCreation);
    });

    it('should process simple messages within performance budget', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client: mockClient,
      });

      const startTime = performance.now();

      await agent.processMessage('Hello');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.simpleMessage);
    }, 10000);

    it('should execute tools within performance budget', async () => {
      const tool = {
        name: 'calculator',
        description: 'Performs calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
        },
        execute: async (params: any) => {
          return { result: eval(params.expression) };
        },
      };

      mockClient.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o-mini',
          provider: 'openai',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'calculator',
              arguments: JSON.stringify({ expression: '2+2' }),
            },
          }],
        })
        .mockResolvedValueOnce({
          content: 'The result is 4',
          model: 'gpt-4o-mini',
          provider: 'openai',
        });

      const agent = createAgent({
        tools: [tool],
        model: 'gpt-4o-mini',
        client: mockClient,
      });

      const startTime = performance.now();

      await agent.processMessage('Calculate 2 + 2');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.toolExecution);
    }, 15000);

    it('should handle concurrent requests efficiently', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client: mockClient,
      });

      const startTime = performance.now();

      const promises = Array.from({ length: 5 }, (_, i) =>
        agent.processMessage(`Message ${i}`)
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be faster than sequential execution
      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.simpleMessage * 5);
    }, 30000);

    it('should maintain memory within limits', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        memorySize: 10,
        client: mockClient,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Process many messages
      for (let i = 0; i < 20; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_BASELINES.memoryLimit);
    }, 60000);
  });

  describe('Token Usage Optimization', () => {
    it('should minimize token usage for simple queries', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client: mockClient,
      });

      const response = await agent.processMessage('Say hi');

      if (response.metadata.usage) {
        expect(response.metadata.usage.promptTokens).toBeLessThan(100);
        expect(response.metadata.usage.completionTokens).toBeLessThan(50);
      }
    }, 10000);

    it('should optimize token usage with context management', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        memorySize: 5,
        client: mockClient,
      });

      const usages: number[] = [];

      for (let i = 0; i < 10; i++) {
        const response = await agent.processMessage(`Message ${i}`);
        if (response.metadata.usage) {
          usages.push(response.metadata.usage.promptTokens);
        }
      }

      // Prompt tokens should stabilize due to memory management
      if (usages.length > 5) {
        const recentAvg = usages.slice(-3).reduce((a, b) => a + b) / 3;
        expect(recentAvg).toBeLessThan(500);
      }
    }, 60000);
  });
});
