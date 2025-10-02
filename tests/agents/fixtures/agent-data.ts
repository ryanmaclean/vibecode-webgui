/**
 * Test Fixtures for Agent Testing
 *
 * Provides reusable test data and utilities
 */

import type {
  StartAgentRequest,
  AgentStatusResponse,
  AgentType,
  ModelType,
} from '@/types/agent-api';
import type { ToolDefinition } from '@/lib/agent-framework';

// Mock Agent Requests
export const mockAgentRequests: Record<string, StartAgentRequest> = {
  basic: {
    agent_type: 'aider' as AgentType,
    workspace: '/home/coder/workspace',
    model: 'gpt-4o-mini' as ModelType,
    task: 'Create a simple login form',
  },

  withFiles: {
    agent_type: 'goose' as AgentType,
    workspace: '/home/coder/workspace/project',
    files: ['src/index.ts', 'src/App.tsx'],
    model: 'claude-3-5-sonnet-20241022' as ModelType,
    task: 'Refactor the authentication logic',
  },

  largeTask: {
    agent_type: 'cline' as AgentType,
    workspace: '/home/coder/workspace',
    model: 'gpt-4o' as ModelType,
    task: 'Build a complete e-commerce application with user authentication, product catalog, shopping cart, checkout, and admin dashboard. Include responsive design and comprehensive testing.',
  },

  minimal: {
    agent_type: 'aider' as AgentType,
    workspace: '/home/coder/workspace',
    model: 'gpt-4o-mini' as ModelType,
    task: 'Fix bug in login function',
  },
};

// Mock Agent Responses
export const mockAgentResponses: Record<string, AgentStatusResponse> = {
  running: {
    agent_id: 'aider-12345678',
    agent_type: 'aider',
    status: 'running',
    terminal_id: 'term-aider-12345678',
    workspace: '/home/coder/workspace',
    pid: 12345,
    command: 'aider --model gpt-4o-mini',
    created_at: new Date().toISOString(),
    uptime_seconds: 120,
    exit_code: null,
    last_output_at: new Date().toISOString(),
    stream_url: '/api/agents/aider-12345678/stream',
    ws_url: '/api/agents/aider-12345678/ws',
  },

  completed: {
    agent_id: 'goose-87654321',
    agent_type: 'goose',
    status: 'completed',
    terminal_id: 'term-goose-87654321',
    workspace: '/home/coder/workspace',
    pid: 54321,
    command: 'goose --model claude-3-5-sonnet-20241022',
    created_at: new Date(Date.now() - 600000).toISOString(),
    uptime_seconds: 600,
    exit_code: 0,
    last_output_at: new Date().toISOString(),
  },

  failed: {
    agent_id: 'cline-abcdef12',
    agent_type: 'cline',
    status: 'failed',
    terminal_id: 'term-cline-abcdef12',
    workspace: '/home/coder/workspace',
    pid: 99999,
    command: 'cline --model gpt-4o',
    created_at: new Date(Date.now() - 300000).toISOString(),
    uptime_seconds: 180,
    exit_code: 1,
    last_output_at: new Date().toISOString(),
  },

  stopped: {
    agent_id: 'aider-11111111',
    agent_type: 'aider',
    status: 'stopped',
    terminal_id: 'term-aider-11111111',
    workspace: '/home/coder/workspace',
    pid: 11111,
    command: 'aider --model gpt-4o-mini',
    created_at: new Date(Date.now() - 900000).toISOString(),
    uptime_seconds: 300,
    exit_code: 143,
    last_output_at: new Date().toISOString(),
  },
};

// Mock Tool Definitions
export const mockTools: Record<string, ToolDefinition> = {
  calculator: {
    name: 'calculator',
    description: 'Performs mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate',
        },
      },
      required: ['expression'],
    },
    execute: async (params) => {
      try {
        const result = eval(params.expression);
        return { result, expression: params.expression };
      } catch (error) {
        throw new Error(`Invalid expression: ${params.expression}`);
      }
    },
  },

  readFile: {
    name: 'read_file',
    description: 'Reads the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
      },
      required: ['path'],
    },
    execute: async (params) => {
      return {
        path: params.path,
        content: 'Mock file content',
        size: 1024,
      };
    },
  },

  webSearch: {
    name: 'web_search',
    description: 'Searches the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results',
          default: 5,
        },
      },
      required: ['query'],
    },
    execute: async (params) => {
      return {
        query: params.query,
        results: [
          {
            title: 'Mock Result 1',
            url: 'https://example.com/1',
            snippet: 'This is a mock search result',
          },
          {
            title: 'Mock Result 2',
            url: 'https://example.com/2',
            snippet: 'Another mock search result',
          },
        ],
      };
    },
  },

  getCurrentTime: {
    name: 'get_current_time',
    description: 'Gets the current date and time',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      return {
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    },
  },

  failingTool: {
    name: 'failing_tool',
    description: 'A tool that always fails',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      throw new Error('Tool execution failed');
    },
  },
};

// Mock Chat Messages
export const mockChatMessages = {
  simple: [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Hello!' },
  ],

  withContext: [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'My name is Alice.' },
    { role: 'assistant' as const, content: 'Nice to meet you, Alice!' },
    { role: 'user' as const, content: 'What is my name?' },
  ],

  withTools: [
    { role: 'system' as const, content: 'You are a helpful assistant with tools.' },
    { role: 'user' as const, content: 'Calculate 2 + 2' },
  ],

  longConversation: Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `Message ${i + 1}`,
  })),
};

// Mock API Responses
export const mockApiResponses = {
  chatCompletion: {
    id: 'chatcmpl-123456',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a mock response.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 15,
      completion_tokens: 10,
      total_tokens: 25,
    },
  },

  chatCompletionWithToolCall: {
    id: 'chatcmpl-789012',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_abc123',
              type: 'function',
              function: {
                name: 'calculator',
                arguments: JSON.stringify({ expression: '2+2' }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 20,
      total_tokens: 70,
    },
  },

  error: {
    error: {
      message: 'Invalid API key',
      type: 'invalid_request_error',
      code: 'invalid_api_key',
    },
  },

  rateLimit: {
    error: {
      message: 'Rate limit exceeded',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
    },
  },
};

// Test Utilities
export class AgentTestUtils {
  static generateAgentId(type: AgentType = 'aider'): string {
    return `${type}-${Math.random().toString(16).slice(2, 10)}`;
  }

  static generateTerminalId(agentId: string): string {
    return `term-${agentId}`;
  }

  static createMockAgent(
    overrides: Partial<AgentStatusResponse> = {}
  ): AgentStatusResponse {
    const agentId = this.generateAgentId();
    return {
      agent_id: agentId,
      agent_type: 'aider',
      status: 'running',
      terminal_id: this.generateTerminalId(agentId),
      workspace: '/home/coder/workspace',
      pid: Math.floor(Math.random() * 10000),
      command: 'aider --model gpt-4o-mini',
      created_at: new Date().toISOString(),
      uptime_seconds: 0,
      exit_code: null,
      last_output_at: null,
      ...overrides,
    };
  }

  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Condition not met within timeout');
  }

  static measureExecutionTime<T>(
    fn: () => T | Promise<T>
  ): Promise<{ result: T; duration: number }> {
    return new Promise(async (resolve, reject) => {
      const startTime = performance.now();

      try {
        const result = await fn();
        const endTime = performance.now();

        resolve({
          result,
          duration: endTime - startTime,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static generateRandomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }

  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

// Export all fixtures
export default {
  mockAgentRequests,
  mockAgentResponses,
  mockTools,
  mockChatMessages,
  mockApiResponses,
  AgentTestUtils,
};
