/**
 * Unit Tests for Agent Client (Minimal - Memory Safe Version)
 *
 * Tests core Agent functionality with aggressive memory management
 */

// Mock UnifiedAIClient
jest.mock('@/lib/unified-ai-client', () => {
  return {
    UnifiedAIClient: jest.fn().mockImplementation(() => ({
      chat: jest.fn(),
      chatStream: jest.fn(),
    })),
  };
});

import { Agent, createAgent } from '@/lib/agent-framework';
import { UnifiedAIClient } from '@/lib/unified-ai-client';
import type { AgentOptions, ToolDefinition } from '@/lib/agent-framework';

describe('Agent Client Tests', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      chat: jest.fn(),
      chatStream: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should create agent with default options', () => {
      const agent = createAgent();
      expect(agent).toBeDefined();
      agent.removeAllListeners();
    });

    it('should create agent with custom options', () => {
      const options: AgentOptions = {
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 1000,
        memorySize: 5,
      };
      const agent = createAgent(options);
      expect(agent).toBeDefined();
      agent.removeAllListeners();
    });

    it('should initialize Agent class directly', () => {
      const agent = new Agent({ client: mockClient });
      expect(agent).toBeDefined();
      agent.removeAllListeners();
    });
  });

  describe('Basic Operations', () => {
    it('should process a message', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Test response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      const response = await agent.processMessage('Hello');
      expect(response.content).toBe('Test response');

      agent.removeAllListeners();
    });

    it('should register and use tools', async () => {
      const toolFn = jest.fn().mockResolvedValue({ result: 'ok' });
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test',
        parameters: { type: 'object', properties: {} },
        execute: toolFn,
      };

      const agent = new Agent({ tools: [tool], client: mockClient });

      mockClient.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o',
          provider: 'openai',
          tool_calls: [{
            id: '1',
            type: 'function',
            function: { name: 'test_tool', arguments: '{}' },
          }],
        })
        .mockResolvedValueOnce({
          content: 'Done',
          model: 'gpt-4o',
          provider: 'openai',
        });

      const response = await agent.processMessage('Use tool');
      expect(toolFn).toHaveBeenCalled();
      expect(response.content).toBe('Done');

      agent.removeAllListeners();
    });
  });
});
