/**
 * Mock OpenAI API Server for Testing
 *
 * Provides a local test server that mimics OpenAI API behavior
 */

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type {
  AgentResponse,
  AgentStatusResponse,
  StartAgentRequest,
  AgentMessageRequest,
  AgentListResponse,
  StopAgentResponse,
  SendMessageResponse,
  HealthResponse,
  ProblemDetails,
} from '@/types/agent-api';

// Mock agent state storage
const agents = new Map<string, AgentStatusResponse>();
let agentCounter = 0;

// Generate unique agent ID
function generateAgentId(type: string): string {
  agentCounter++;
  return `${type}-${agentCounter.toString(16).padStart(8, '0')}`;
}

// Default mock responses
export const mockResponses = {
  chat: {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a mock response from the OpenAI API.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 15,
      total_tokens: 25,
    },
  },

  chatStream: [
    {
      id: 'chatcmpl-123',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'This ' },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'chatcmpl-123',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: { content: 'is ' },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'chatcmpl-123',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: { content: 'a mock stream.' },
          finish_reason: 'stop',
        },
      ],
    },
  ],

  toolCall: {
    id: 'chatcmpl-123',
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
              id: 'call_123',
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
      completion_tokens: 25,
      total_tokens: 75,
    },
  },

  error: {
    error: {
      message: 'Mock API error',
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

// MSW handlers for OpenAI API
export const openaiHandlers = [
  // Chat completions endpoint
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as any;

    // Handle streaming requests
    if (body.stream) {
      const stream = new ReadableStream({
        start(controller) {
          mockResponses.chatStream.forEach((chunk, index) => {
            setTimeout(() => {
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );
              if (index === mockResponses.chatStream.length - 1) {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
              }
            }, index * 100);
          });
        },
      });

      return new HttpResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Check for tool calls in request
    if (body.tools && body.tools.length > 0) {
      return HttpResponse.json(mockResponses.toolCall);
    }

    // Regular chat completion
    return HttpResponse.json(mockResponses.chat);
  }),

  // Models endpoint
  http.get('https://api.openai.com/v1/models', () => {
    return HttpResponse.json({
      data: [
        { id: 'gpt-4o', object: 'model', created: Date.now() },
        { id: 'gpt-4o-mini', object: 'model', created: Date.now() },
      ],
    });
  }),

  // Error simulation endpoint
  http.post('https://api.openai.com/v1/chat/completions/error', () => {
    return HttpResponse.json(mockResponses.error, { status: 400 });
  }),

  // Rate limit simulation endpoint
  http.post('https://api.openai.com/v1/chat/completions/rate-limit', () => {
    return HttpResponse.json(mockResponses.rateLimit, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + 60000),
        'Retry-After': '60',
      },
    });
  }),
];

// MSW handlers for Agent API
export const agentApiHandlers = [
  // Start agent
  http.post('/api/agents', async ({ request }) => {
    const body = await request.json() as StartAgentRequest;

    const agentId = generateAgentId(body.agent_type);
    const terminalId = `term-${agentId}`;

    const agent: AgentStatusResponse = {
      agent_id: agentId,
      agent_type: body.agent_type,
      status: 'running',
      terminal_id: terminalId,
      workspace: body.workspace,
      pid: Math.floor(Math.random() * 10000),
      command: `${body.agent_type} --model ${body.model}`,
      created_at: new Date().toISOString(),
      uptime_seconds: 0,
      exit_code: null,
      last_output_at: null,
      stream_url: `/api/agents/${agentId}/stream`,
      ws_url: `/api/agents/${agentId}/ws`,
    };

    agents.set(agentId, agent);

    return HttpResponse.json(agent, { status: 201 });
  }),

  // Get agent status
  http.get('/api/agents/:agentId', ({ params }) => {
    const { agentId } = params;
    const agent = agents.get(agentId as string);

    if (!agent) {
      const problem: ProblemDetails = {
        type: 'https://api.vibecode.com/problems/agent-not-found',
        title: 'Agent Not Found',
        status: 404,
        detail: `Agent ${agentId} not found`,
      };
      return HttpResponse.json(problem, { status: 404 });
    }

    return HttpResponse.json(agent);
  }),

  // List agents
  http.get('/api/agents', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 50);
    const status = url.searchParams.get('status');

    let filteredAgents = Array.from(agents.values());

    if (status) {
      filteredAgents = filteredAgents.filter(a => a.status === status);
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedAgents = filteredAgents.slice(start, end);

    const response: AgentListResponse = {
      agents: paginatedAgents,
      pagination: {
        page,
        limit,
        total: filteredAgents.length,
        pages: Math.ceil(filteredAgents.length / limit),
      },
      summary: {
        active: filteredAgents.filter(a => a.status === 'running').length,
        completed: filteredAgents.filter(a => a.status === 'completed').length,
        failed: filteredAgents.filter(a => a.status === 'failed').length,
        by_type: {
          aider: filteredAgents.filter(a => a.agent_type === 'aider').length,
          goose: filteredAgents.filter(a => a.agent_type === 'goose').length,
          cline: filteredAgents.filter(a => a.agent_type === 'cline').length,
        },
      },
    };

    return HttpResponse.json(response);
  }),

  // Stop agent
  http.post('/api/agents/:agentId/stop', ({ params }) => {
    const { agentId } = params;
    const agent = agents.get(agentId as string);

    if (!agent) {
      const problem: ProblemDetails = {
        type: 'https://api.vibecode.com/problems/agent-not-found',
        title: 'Agent Not Found',
        status: 404,
        detail: `Agent ${agentId} not found`,
      };
      return HttpResponse.json(problem, { status: 404 });
    }

    agent.status = 'stopped';
    agent.exit_code = 0;

    const response: StopAgentResponse = {
      agent_id: agent.agent_id,
      status: 'stopped',
      message: 'Agent stopped successfully',
      stopped_at: new Date().toISOString(),
      exit_code: 0,
      forced: false,
    };

    return HttpResponse.json(response);
  }),

  // Send message to agent
  http.post('/api/agents/:agentId/message', async ({ params, request }) => {
    const { agentId } = params;
    const body = await request.json() as AgentMessageRequest;
    const agent = agents.get(agentId as string);

    if (!agent) {
      const problem: ProblemDetails = {
        type: 'https://api.vibecode.com/problems/agent-not-found',
        title: 'Agent Not Found',
        status: 404,
        detail: `Agent ${agentId} not found`,
      };
      return HttpResponse.json(problem, { status: 404 });
    }

    if (agent.status !== 'running') {
      const problem: ProblemDetails = {
        type: 'https://api.vibecode.com/problems/agent-not-running',
        title: 'Agent Not Running',
        status: 409,
        detail: `Agent ${agentId} is not running`,
      };
      return HttpResponse.json(problem, { status: 409 });
    }

    const response: SendMessageResponse = {
      message_id: `msg-${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    return HttpResponse.json(response);
  }),

  // Health check
  http.get('/api/agents/health', () => {
    const response: HealthResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      agents: {
        active: Array.from(agents.values()).filter(a => a.status === 'running').length,
        max_concurrent: 20,
        user_limit: 5,
      },
      uptime_seconds: 3600,
    };

    return HttpResponse.json(response);
  }),
];

// Create and export mock server
export const mockServer = setupServer(...openaiHandlers, ...agentApiHandlers);

// Helper functions for test setup
export function setupMockServer() {
  beforeAll(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => {
    mockServer.resetHandlers();
    agents.clear();
    agentCounter = 0;
  });
  afterAll(() => mockServer.close());
}

export function setMockChatResponse(content: string) {
  mockResponses.chat.choices[0].message.content = content;
}

export function setMockError(message: string, status: number = 400) {
  mockResponses.error.error.message = message;
}

export function simulateRateLimit() {
  mockServer.use(
    http.post('https://api.openai.com/v1/chat/completions', () => {
      return HttpResponse.json(mockResponses.rateLimit, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + 60000),
          'Retry-After': '60',
        },
      });
    })
  );
}

export function simulateNetworkError() {
  mockServer.use(
    http.post('https://api.openai.com/v1/chat/completions', () => {
      return HttpResponse.error();
    })
  );
}

export function getMockAgent(agentId: string): AgentStatusResponse | undefined {
  return agents.get(agentId);
}

export function getAllMockAgents(): AgentStatusResponse[] {
  return Array.from(agents.values());
}

export function clearMockAgents() {
  agents.clear();
  agentCounter = 0;
}
