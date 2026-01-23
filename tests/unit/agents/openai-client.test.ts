/**
 * Unit tests for OpenAI Agents Client
 * Tests API client operations, error handling, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  OpenAIAgentsClient,
  OpenAIAgentError,
  createOpenAIAgentsClient,
} from '@/lib/agents/openai-client'
import type { Agent, Thread, ThreadMessage, Run } from '@/types/openai-agents'

// Mock logger to prevent "createChildLogger is not a function" error
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn(),
    child: jest.fn(),
  },
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn(),
    child: jest.fn(),
  })),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn(),
    child: jest.fn(),
  })),
}))

// Mock fetch - use a variable that gets assigned in beforeEach to avoid being overwritten by jest.setup.js
let mockFetch: jest.Mock

describe('OpenAIAgentsClient', () => {
  let client: OpenAIAgentsClient

  beforeEach(() => {
    jest.clearAllMocks()
    // Set up mock fetch AFTER clearAllMocks and AFTER jest.setup.js restores its default
    mockFetch = jest.fn()
    global.fetch = mockFetch as unknown as typeof fetch

    client = new OpenAIAgentsClient({
      apiKey: 'test-api-key',
      organization: 'test-org',
      baseURL: 'https://api.test.com/v1',
      timeout: 5000,
      maxRetries: 2,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Agent Operations', () => {
    it('creates an agent successfully', async () => {
      const mockAgent: Agent = {
        id: 'asst_123',
        object: 'assistant',
        created_at: Date.now(),
        name: 'Test Agent',
        description: null,
        model: 'gpt-4',
        instructions: 'You are a helpful assistant',
        tools: [],
        tool_resources: null,
        metadata: {},
        temperature: null,
        top_p: null,
        response_format: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      })

      const result = await client.createAgent({
        model: 'gpt-4',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
      })

      expect(result).toEqual(mockAgent)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/assistants',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'OpenAI-Organization': 'test-org',
            'OpenAI-Beta': 'assistants=v2',
          }),
        })
      )
    })

    it('retrieves an agent by ID', async () => {
      const mockAgent: Agent = {
        id: 'asst_123',
        object: 'assistant',
        created_at: Date.now(),
        name: 'Test Agent',
        description: null,
        model: 'gpt-4',
        instructions: 'You are a helpful assistant',
        tools: [],
        tool_resources: null,
        metadata: {},
        temperature: null,
        top_p: null,
        response_format: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      })

      const result = await client.getAgent('asst_123')

      expect(result).toEqual(mockAgent)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/assistants/asst_123',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('updates an agent', async () => {
      const mockAgent: Agent = {
        id: 'asst_123',
        object: 'assistant',
        created_at: Date.now(),
        name: 'Updated Agent',
        description: null,
        model: 'gpt-4',
        instructions: 'Updated instructions',
        tools: [],
        tool_resources: null,
        metadata: {},
        temperature: null,
        top_p: null,
        response_format: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      })

      const result = await client.updateAgent('asst_123', {
        name: 'Updated Agent',
        instructions: 'Updated instructions',
      })

      expect(result.name).toBe('Updated Agent')
      expect(result.instructions).toBe('Updated instructions')
    })

    it('deletes an agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'asst_123',
          object: 'assistant.deleted',
          deleted: true,
        }),
      })

      const result = await client.deleteAgent('asst_123')

      expect(result.deleted).toBe(true)
      expect(result.id).toBe('asst_123')
    })

    it('lists agents with pagination', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'asst_1', name: 'Agent 1' },
          { id: 'asst_2', name: 'Agent 2' },
        ],
        first_id: 'asst_1',
        last_id: 'asst_2',
        has_more: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await client.listAgents({ limit: 20, order: 'desc' })

      expect(result.data).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/assistants?limit=20&order=desc',
        expect.anything()
      )
    })
  })

  describe('Thread Operations', () => {
    it('creates a thread', async () => {
      const mockThread: Thread = {
        id: 'thread_123',
        object: 'thread',
        created_at: Date.now(),
        metadata: {},
        tool_resources: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockThread,
      })

      const result = await client.createThread()

      expect(result).toEqual(mockThread)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/threads',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('creates a thread with initial messages', async () => {
      const mockThread: Thread = {
        id: 'thread_123',
        object: 'thread',
        created_at: Date.now(),
        metadata: {},
        tool_resources: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockThread,
      })

      const result = await client.createThread({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      })

      expect(result.id).toBe('thread_123')
    })

    it('retrieves a thread', async () => {
      const mockThread: Thread = {
        id: 'thread_123',
        object: 'thread',
        created_at: Date.now(),
        metadata: {},
        tool_resources: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockThread,
      })

      const result = await client.getThread('thread_123')

      expect(result).toEqual(mockThread)
    })

    it('deletes a thread', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'thread_123',
          object: 'thread.deleted',
          deleted: true,
        }),
      })

      const result = await client.deleteThread('thread_123')

      expect(result.deleted).toBe(true)
    })
  })

  describe('Message Operations', () => {
    it('creates a message in a thread', async () => {
      const mockMessage: ThreadMessage = {
        id: 'msg_123',
        object: 'thread.message',
        created_at: Date.now(),
        thread_id: 'thread_123',
        role: 'user',
        content: [
          {
            type: 'text',
            text: {
              value: 'Hello',
              annotations: [],
            },
          },
        ],
        assistant_id: null,
        run_id: null,
        attachments: null,
        metadata: {},
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessage,
      })

      const result = await client.createMessage('thread_123', {
        role: 'user',
        content: 'Hello',
      })

      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: { value: 'Hello' },
      })
    })

    it('lists messages in a thread', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'msg_1', content: 'Message 1' },
          { id: 'msg_2', content: 'Message 2' },
        ],
        first_id: 'msg_1',
        last_id: 'msg_2',
        has_more: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await client.listMessages('thread_123', {
        limit: 50,
        order: 'desc',
      })

      expect(result.data).toHaveLength(2)
    })
  })

  describe('Run Operations', () => {
    it('creates a run', async () => {
      const mockRun: Run = {
        id: 'run_123',
        object: 'thread.run',
        created_at: Date.now(),
        thread_id: 'thread_123',
        assistant_id: 'asst_123',
        status: 'queued',
        required_action: null,
        last_error: null,
        expires_at: Date.now() + 600000,
        started_at: null,
        cancelled_at: null,
        failed_at: null,
        completed_at: null,
        incomplete_details: null,
        model: 'gpt-4',
        instructions: null,
        tools: [],
        metadata: {},
        usage: null,
        temperature: null,
        top_p: null,
        max_prompt_tokens: null,
        max_completion_tokens: null,
        truncation_strategy: null,
        response_format: null,
        tool_choice: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRun,
      })

      const result = await client.createRun('thread_123', {
        assistant_id: 'asst_123',
      })

      expect(result.status).toBe('queued')
      expect(result.thread_id).toBe('thread_123')
    })

    it('retrieves a run status', async () => {
      const mockRun: Run = {
        id: 'run_123',
        object: 'thread.run',
        created_at: Date.now(),
        thread_id: 'thread_123',
        assistant_id: 'asst_123',
        status: 'completed',
        required_action: null,
        last_error: null,
        expires_at: Date.now() + 600000,
        started_at: Date.now(),
        cancelled_at: null,
        failed_at: null,
        completed_at: Date.now(),
        incomplete_details: null,
        model: 'gpt-4',
        instructions: null,
        tools: [],
        metadata: {},
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
        temperature: null,
        top_p: null,
        max_prompt_tokens: null,
        max_completion_tokens: null,
        truncation_strategy: null,
        response_format: null,
        tool_choice: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRun,
      })

      const result = await client.getRun('thread_123', 'run_123')

      expect(result.status).toBe('completed')
      expect(result.usage?.total_tokens).toBe(150)
    })

    it('cancels a run', async () => {
      const mockRun: Run = {
        id: 'run_123',
        object: 'thread.run',
        created_at: Date.now(),
        thread_id: 'thread_123',
        assistant_id: 'asst_123',
        status: 'cancelled',
        required_action: null,
        last_error: null,
        expires_at: Date.now() + 600000,
        started_at: Date.now(),
        cancelled_at: Date.now(),
        failed_at: null,
        completed_at: null,
        incomplete_details: null,
        model: 'gpt-4',
        instructions: null,
        tools: [],
        metadata: {},
        usage: null,
        temperature: null,
        top_p: null,
        max_prompt_tokens: null,
        max_completion_tokens: null,
        truncation_strategy: null,
        response_format: null,
        tool_choice: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRun,
      })

      const result = await client.cancelRun('thread_123', 'run_123')

      expect(result.status).toBe('cancelled')
    })
  })

  describe('Error Handling', () => {
    it('throws OpenAIAgentError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            message: 'Agent not found',
            type: 'not_found',
            param: null,
            code: 'agent_not_found',
          },
        }),
      })

      await expect(client.getAgent('invalid_id')).rejects.toThrow(
        OpenAIAgentError
      )
    })

    it('retries on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            error: { message: 'Internal error', type: 'server_error' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'asst_123' }),
        })

      const result = await client.getAgent('asst_123')

      expect(result.id).toBe('asst_123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('retries on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            error: { message: 'Rate limit exceeded', type: 'rate_limit' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'asst_123' }),
        })

      const result = await client.getAgent('asst_123')

      expect(result.id).toBe('asst_123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('respects max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: 'Internal error', type: 'server_error' },
        }),
      })

      await expect(client.getAgent('asst_123')).rejects.toThrow()

      // Initial request + 2 retries = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('Factory Function', () => {
    it('creates client from environment variables', () => {
      process.env.OPENAI_API_KEY = 'env-api-key'
      process.env.OPENAI_ORGANIZATION = 'env-org'

      const envClient = createOpenAIAgentsClient()

      expect(envClient).toBeInstanceOf(OpenAIAgentsClient)

      delete process.env.OPENAI_API_KEY
      delete process.env.OPENAI_ORGANIZATION
    })

    it('throws error if no API key provided', () => {
      delete process.env.OPENAI_API_KEY

      expect(() => createOpenAIAgentsClient()).toThrow('API key is required')
    })

    it('accepts config override', () => {
      const configClient = createOpenAIAgentsClient({
        apiKey: 'custom-key',
        organization: 'custom-org',
      })

      expect(configClient).toBeInstanceOf(OpenAIAgentsClient)
    })
  })
})
