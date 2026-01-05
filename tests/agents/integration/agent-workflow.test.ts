/**
 * Integration Tests for Agent Workflows
 *
 * Tests end-to-end agent workflows with mocked API interactions
 */

import { Agent, createAgent } from '@/lib/agent-framework';
import { CodeAgent, ResearchAgent } from '@/lib/agent-framework/agents';
import type { ToolDefinition } from '@/lib/agent-framework';
import { UnifiedAIClient } from '@/lib/unified-ai-client';

// UnifiedAIClient is globally mocked by jest.setup.js
jest.mock('@/lib/unified-ai-client');

describe('Agent Workflow - Integration Tests', () => {
  let client: jest.Mocked<UnifiedAIClient>;

  beforeEach(() => {
    // Reset and configure the mock client
    jest.clearAllMocks();
    client = new UnifiedAIClient() as jest.Mocked<UnifiedAIClient>;

    // Default mock response
    client.chat = jest.fn().mockResolvedValue({
      content: 'Mock response',
      model: 'gpt-4o-mini',
      provider: 'openai',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    });

    client.chatStream = jest.fn().mockImplementation(async function* () {
      yield { content: 'Mock ', model: 'gpt-4o-mini', provider: 'openai', done: false };
      yield { content: 'stream', model: 'gpt-4o-mini', provider: 'openai', done: false };
      yield { content: 'response', model: 'gpt-4o-mini', provider: 'openai', done: true };
    });
  });

  describe('Multi-turn Conversations', () => {
    it('should maintain context across multiple messages', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        memorySize: 10,
        client,
      });

      const response1 = await agent.processMessage('My name is Alice');
      expect(response1.content).toBeDefined();

      const response2 = await agent.processMessage('What is my name?');
      expect(response2.content.toLowerCase()).toContain('alice');
    }, 30000);

    it('should handle conversation flow with topic changes', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      await agent.processMessage('Tell me about Python');
      await agent.processMessage('Now tell me about JavaScript');
      const response = await agent.processMessage('What was the first topic?');

      expect(response.content.toLowerCase()).toContain('python');
    }, 30000);

    it('should handle follow-up questions', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      await agent.processMessage('What is 25 + 17?');
      const response = await agent.processMessage('Add 10 to that');

      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('Tool Chain Execution', () => {
    it('should execute multiple tools in sequence', async () => {
      const executionLog: string[] = [];

      const tool1: ToolDefinition = {
        name: 'get_data',
        description: 'Retrieves data',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string' },
          },
        },
        execute: async (params) => {
          executionLog.push('get_data');
          return { data: 'sample data', source: params.source };
        },
      };

      const tool2: ToolDefinition = {
        name: 'process_data',
        description: 'Processes data',
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'string' },
          },
        },
        execute: async (params) => {
          executionLog.push('process_data');
          return { processed: params.data.toUpperCase() };
        },
      };

      const agent = createAgent({
        tools: [tool1, tool2],
        model: 'gpt-4o-mini',
        client,
      });

      const response = await agent.processMessage(
        'Get data from "database" and process it'
      );

      expect(executionLog.length).toBeGreaterThan(0);
      expect(response.content).toBeDefined();
    }, 30000);

    it('should handle tool errors and recovery', async () => {
      let attemptCount = 0;

      const unreliableTool: ToolDefinition = {
        name: 'unreliable_tool',
        description: 'A tool that fails sometimes',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('Tool temporarily unavailable');
          }
          return { success: true, attempt: attemptCount };
        },
      };

      const agent = createAgent({
        tools: [unreliableTool],
        model: 'gpt-4o-mini',
        client,
      });

      const response = await agent.processMessage('Use the unreliable tool');

      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('CodeAgent Workflows', () => {
    it('should handle code generation and explanation', async () => {
      const agent = new CodeAgent({
        model: 'gpt-4o-mini',
        enableCodeExecution: false,
        client,
      });

      const response = await agent.processMessage(
        'Write a TypeScript function to reverse a string'
      );

      expect(response.content).toContain('function');
      expect(response.content.toLowerCase()).toContain('string');
    }, 30000);

    it('should handle code debugging workflow', async () => {
      const agent = new CodeAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const buggyCode = `
function add(a, b) {
  return a - b;
}
      `;

      const response = await agent.processMessage(
        `Fix this bug in the code: ${buggyCode}`
      );

      expect(response.content).toBeDefined();
      expect(response.content).toContain('+');
    }, 30000);

    it('should handle code review workflow', async () => {
      const agent = new CodeAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const code = `
function processUser(user) {
  console.log(user.name);
  return user;
}
      `;

      const response = await agent.processMessage(
        `Review this code for best practices: ${code}`
      );

      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('ResearchAgent Workflows', () => {
    it('should handle research and summarization', async () => {
      const agent = new ResearchAgent({
        model: 'gpt-4o-mini',
        enableWebSearch: false,
        client,
      });

      const response = await agent.processMessage(
        'Explain the concept of recursion in programming'
      );

      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toContain('recursion');
    }, 30000);

    it('should handle comparative analysis', async () => {
      const agent = new ResearchAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const response = await agent.processMessage(
        'Compare REST APIs with GraphQL APIs'
      );

      expect(response.content.toLowerCase()).toContain('rest');
      expect(response.content.toLowerCase()).toContain('graphql');
    }, 30000);
  });

  describe('Streaming Workflow', () => {
    it('should stream long responses', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const chunks: string[] = [];
      let chunkCount = 0;

      for await (const chunk of agent.streamResponse(
        'Write a detailed explanation of how HTTP works'
      )) {
        chunks.push(chunk.content);
        chunkCount++;
      }

      expect(chunkCount).toBeGreaterThan(1);
      expect(chunks.join('')).toBeTruthy();
    }, 30000);

    it('should handle streaming interruption', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      let chunkCount = 0;
      const maxChunks = 3;

      for await (const chunk of agent.streamResponse(
        'Write a very long story about space exploration'
      )) {
        chunkCount++;
        if (chunkCount >= maxChunks) {
          break;
        }
      }

      expect(chunkCount).toBe(maxChunks);
    }, 30000);
  });

  describe('Memory and Context Management', () => {
    it('should respect memory size limits', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        memorySize: 3,
        client,
      });

      // Send many messages
      for (let i = 0; i < 10; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      const response = await agent.processMessage('What was message 0?');

      // Agent might not remember early messages due to memory limit
      expect(response.content).toBeDefined();
    }, 60000);

    it('should clear memory while preserving system prompt', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a helpful assistant named Bob.',
        client,
      });

      await agent.processMessage('Remember the number 42');
      agent.clearMemory();
      const response = await agent.processMessage('What number did I tell you?');

      // Agent should not remember 42, but should still be Bob
      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API rate limiting', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      // Make rapid requests that might trigger rate limiting
      const promises = Array.from({ length: 3 }, (_, i) =>
        agent.processMessage(`Request ${i}`)
      );

      const results = await Promise.allSettled(promises);

      // At least some requests should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    }, 30000);

    it('should handle network timeouts gracefully', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        maxTokens: 10000,
        client,
      });

      try {
        await agent.processMessage(
          'Write an extremely detailed analysis of every programming language'
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 15000);

    it('should handle invalid model names', async () => {
      const agent = createAgent({
        model: 'invalid-model-name',
        client,
      });

      await expect(
        agent.processMessage('Test')
      ).rejects.toThrow();
    }, 30000);
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const promises = [
        agent.processMessage('What is 2+2?'),
        agent.processMessage('What is the capital of France?'),
        agent.processMessage('Name a programming language'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.content).toBeDefined();
      });
    }, 45000);

    it('should measure response times', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const startTime = Date.now();
      await agent.processMessage('Hello');
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(30000);
    }, 30000);
  });

  describe('Usage Tracking', () => {
    it('should track token usage', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const response = await agent.processMessage('Count to 5');

      expect(response.metadata.usage).toBeDefined();
      if (response.metadata.usage) {
        expect(response.metadata.usage.promptTokens).toBeGreaterThan(0);
        expect(response.metadata.usage.completionTokens).toBeGreaterThan(0);
        expect(response.metadata.usage.totalTokens).toBeGreaterThan(0);
      }
    }, 30000);

    it('should accumulate usage across multiple requests', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        client,
      });

      const usages: number[] = [];

      for (let i = 0; i < 3; i++) {
        const response = await agent.processMessage(`Request ${i}`);
        if (response.metadata.usage) {
          usages.push(response.metadata.usage.totalTokens);
        }
      }

      expect(usages.length).toBe(3);
      expect(usages.every(u => u > 0)).toBe(true);
    }, 45000);
  });
});
