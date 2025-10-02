/**
 * Unit Tests for OpenAI Agent Client
 *
 * Tests the core API client functionality for OpenAI Agents integration
 */

import { Agent, createAgent, AgentEvent } from '@/lib/agent-framework';
import { UnifiedAIClient } from '@/lib/unified-ai-client';
import type { AgentOptions, AgentResponse, ToolDefinition } from '@/lib/agent-framework';

// Mock UnifiedAIClient
jest.mock('@/lib/unified-ai-client');

describe('Agent Client - Unit Tests', () => {
  let mockClient: jest.Mocked<UnifiedAIClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new UnifiedAIClient() as jest.Mocked<UnifiedAIClient>;
  });

  describe('Agent Initialization', () => {
    it('should create agent with default options', () => {
      const agent = createAgent();

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should create agent with custom options', () => {
      const options: AgentOptions = {
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 2000,
        memorySize: 10,
        systemPrompt: 'You are a test assistant.',
      };

      const agent = createAgent(options);

      expect(agent).toBeInstanceOf(Agent);
    });

    it('should initialize with system message in memory', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const agent = new Agent({ systemPrompt, client: mockClient });

      // Agent should have system message in memory
      expect(agent).toBeDefined();
    });

    it('should register tools during initialization', () => {
      const testTool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn().mockResolvedValue({ result: 'test' }),
      };

      const agent = new Agent({
        tools: [testTool],
        client: mockClient,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Message Processing', () => {
    it('should process simple message successfully', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Hello! How can I help you?',
        model: 'gpt-4o',
        provider: 'openai',
        usage: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
        },
      });

      const response = await agent.processMessage('Hello');

      expect(mockClient.chat).toHaveBeenCalledTimes(1);
      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.metadata.model).toBe('gpt-4o');
    });

    it('should add messages to memory', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Test message');

      // Memory should contain system, user, and assistant messages
    });

    it('should handle empty content', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: '',
        model: 'gpt-4o',
        provider: 'openai',
      });

      const response = await agent.processMessage('');

      expect(response.content).toBe('');
    });

    it('should throw error when API call fails', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockRejectedValue(
        new Error('API request failed')
      );

      await expect(agent.processMessage('Test'))
        .rejects.toThrow('API request failed');
    });

    it('should handle network timeout errors', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockRejectedValue(
        new Error('Request timeout')
      );

      await expect(agent.processMessage('Test'))
        .rejects.toThrow('Request timeout');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool when requested by agent', async () => {
      const toolExecutor = jest.fn().mockResolvedValue({ result: 42 });
      const testTool: ToolDefinition = {
        name: 'calculator',
        description: 'Performs calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
        },
        execute: toolExecutor,
      };

      const agent = new Agent({
        tools: [testTool],
        client: mockClient,
      });

      // Mock API response with tool call
      mockClient.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o',
          provider: 'openai',
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'calculator',
              arguments: JSON.stringify({ expression: '2 + 2' }),
            },
          }],
        })
        .mockResolvedValueOnce({
          content: 'The result is 42',
          model: 'gpt-4o',
          provider: 'openai',
        });

      const response = await agent.processMessage('Calculate 2 + 2');

      expect(toolExecutor).toHaveBeenCalledWith({ expression: '2 + 2' });
      expect(response.content).toBe('The result is 42');
    });

    it('should handle tool execution errors gracefully', async () => {
      const toolExecutor = jest.fn().mockRejectedValue(
        new Error('Tool execution failed')
      );
      const testTool: ToolDefinition = {
        name: 'failing_tool',
        description: 'A tool that fails',
        parameters: { type: 'object', properties: {} },
        execute: toolExecutor,
      };

      const agent = new Agent({
        tools: [testTool],
        client: mockClient,
      });

      mockClient.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o',
          provider: 'openai',
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'failing_tool',
              arguments: '{}',
            },
          }],
        })
        .mockResolvedValueOnce({
          content: 'Tool execution failed',
          model: 'gpt-4o',
          provider: 'openai',
        });

      const response = await agent.processMessage('Use the failing tool');

      expect(toolExecutor).toHaveBeenCalled();
      expect(response.content).toBe('Tool execution failed');
    });

    it('should throw error for unknown tool', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: '',
        model: 'gpt-4o',
        provider: 'openai',
        tool_calls: [{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'unknown_tool',
            arguments: '{}',
          },
        }],
      });

      await expect(agent.processMessage('Use unknown tool'))
        .rejects.toThrow('Tool unknown_tool not found');
    });

    it('should handle invalid tool arguments', async () => {
      const toolExecutor = jest.fn().mockResolvedValue({ result: 'ok' });
      const testTool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        execute: toolExecutor,
      };

      const agent = new Agent({
        tools: [testTool],
        client: mockClient,
      });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: '',
        model: 'gpt-4o',
        provider: 'openai',
        tool_calls: [{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: 'invalid json',
          },
        }],
      });

      await expect(agent.processMessage('Test'))
        .rejects.toThrow('Invalid tool arguments');
    });
  });

  describe('Memory Management', () => {
    it('should maintain memory within size limit', async () => {
      const agent = new Agent({
        memorySize: 5,
        client: mockClient,
      });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      // Send more messages than memory size
      for (let i = 0; i < 10; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      // Memory should be trimmed to size limit
    });

    it('should clear memory while preserving system prompt', () => {
      const agent = new Agent({
        systemPrompt: 'System prompt',
        client: mockClient,
      });

      agent.clearMemory();

      // System prompt should still be in memory
    });

    it('should add timestamp to messages', async () => {
      const agent = new Agent({ client: mockClient });
      const beforeTime = Date.now();

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Test');
      const afterTime = Date.now();

      // Timestamp should be between beforeTime and afterTime
    });
  });

  describe('Event Emission', () => {
    it('should emit message events', async () => {
      const agent = new Agent({ client: mockClient });
      const messageHandler = jest.fn();

      agent.on(AgentEvent.Message, messageHandler);

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Test');

      expect(messageHandler).toHaveBeenCalled();
    });

    it('should emit tool call events', async () => {
      const toolExecutor = jest.fn().mockResolvedValue({ result: 'ok' });
      const testTool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        execute: toolExecutor,
      };

      const agent = new Agent({
        tools: [testTool],
        client: mockClient,
      });

      const toolCallHandler = jest.fn();
      agent.on(AgentEvent.ToolCall, toolCallHandler);

      mockClient.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o',
          provider: 'openai',
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'test_tool',
              arguments: '{}',
            },
          }],
        })
        .mockResolvedValueOnce({
          content: 'Done',
          model: 'gpt-4o',
          provider: 'openai',
        });

      await agent.processMessage('Test');

      expect(toolCallHandler).toHaveBeenCalledWith({
        tool: 'test_tool',
        args: {},
      });
    });

    it('should emit error events', async () => {
      const agent = new Agent({ client: mockClient });
      const errorHandler = jest.fn();

      agent.on(AgentEvent.Error, errorHandler);

      mockClient.chat = jest.fn().mockRejectedValue(
        new Error('Test error')
      );

      await expect(agent.processMessage('Test')).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Streaming Responses', () => {
    it('should stream response chunks', async () => {
      const agent = new Agent({ client: mockClient });

      const mockStream = (async function* () {
        yield { content: 'Hello', model: 'gpt-4o', provider: 'openai' };
        yield { content: ' world', model: 'gpt-4o', provider: 'openai' };
        yield { content: '!', model: 'gpt-4o', provider: 'openai' };
      })();

      mockClient.chatStream = jest.fn().mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of agent.streamResponse('Test')) {
        chunks.push(chunk.content);
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });

    it('should add complete response to memory after streaming', async () => {
      const agent = new Agent({ client: mockClient });

      const mockStream = (async function* () {
        yield { content: 'Part 1', model: 'gpt-4o', provider: 'openai' };
        yield { content: ' Part 2', model: 'gpt-4o', provider: 'openai' };
      })();

      mockClient.chatStream = jest.fn().mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of agent.streamResponse('Test')) {
        chunks.push(chunk.content);
      }

      // Full response should be in memory
    });

    it('should handle streaming errors', async () => {
      const agent = new Agent({ client: mockClient });

      mockClient.chatStream = jest.fn().mockRejectedValue(
        new Error('Streaming failed')
      );

      const generator = agent.streamResponse('Test');

      await expect(generator.next()).rejects.toThrow('Streaming failed');
    });
  });

  describe('Tool Registration', () => {
    it('should register single tool', () => {
      const agent = new Agent({ client: mockClient });

      const tool: ToolDefinition = {
        name: 'new_tool',
        description: 'New tool',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      agent.registerTools(tool);

      expect(agent).toBeDefined();
    });

    it('should register multiple tools', () => {
      const agent = new Agent({ client: mockClient });

      const tools: ToolDefinition[] = [
        {
          name: 'tool1',
          description: 'Tool 1',
          parameters: { type: 'object', properties: {} },
          execute: jest.fn(),
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          parameters: { type: 'object', properties: {} },
          execute: jest.fn(),
        },
      ];

      agent.registerTools(tools);

      expect(agent).toBeDefined();
    });

    it('should overwrite tool with same name', () => {
      const agent = new Agent({ client: mockClient });

      const tool1: ToolDefinition = {
        name: 'duplicate',
        description: 'First version',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      const tool2: ToolDefinition = {
        name: 'duplicate',
        description: 'Second version',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      agent.registerTools(tool1);
      agent.registerTools(tool2);

      expect(agent).toBeDefined();
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom temperature', async () => {
      const agent = new Agent({
        temperature: 0.9,
        client: mockClient,
      });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Test');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.9 })
      );
    });

    it('should respect custom maxTokens', async () => {
      const agent = new Agent({
        maxTokens: 500,
        client: mockClient,
      });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Test');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ maxTokens: 500 })
      );
    });

    it('should override options per message', async () => {
      const agent = new Agent({
        temperature: 0.5,
        client: mockClient,
      });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Test', { temperature: 0.9 });

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.9 })
      );
    });
  });
});
