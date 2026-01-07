/**
 * Mock Agent Factory
 *
 * Creates realistic mock AI agent objects for testing OpenAI Agents API integration,
 * agent workflows, and multi-agent collaboration features.
 *
 * @example
 * ```typescript
 * const agent = createMockAgent();
 * const codeAgent = createMockAgent({ name: 'Code Assistant', instructions: 'Help with code' });
 * const agentWithTools = createMockAgent({ tools: [{ type: 'code_interpreter' }] });
 * ```
 */

export interface MockAgent {
  id: string;
  object: string;
  created_at: number;
  name: string;
  model: string;
  instructions: string;
  tools: MockAgentTool[];
  metadata: Record<string, any>;
  description?: string;
}

export interface MockAgentTool {
  type: 'code_interpreter' | 'retrieval' | 'function';
  function?: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface MockThread {
  id: string;
  object: string;
  created_at: number;
  metadata: Record<string, any>;
}

export interface MockMessage {
  id: string;
  object: string;
  created_at: number;
  thread_id: string;
  role: 'user' | 'assistant';
  content: Array<{
    type: string;
    text?: {
      value: string;
      annotations: any[];
    };
  }>;
  metadata: Record<string, any>;
}

export interface MockRun {
  id: string;
  object: string;
  created_at: number;
  thread_id: string;
  assistant_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  model: string;
  instructions: string;
  tools: MockAgentTool[];
  metadata: Record<string, any>;
}

/**
 * Creates a mock agent object with sensible defaults
 *
 * @param overrides - Partial agent object to override defaults
 * @returns Complete mock agent object
 */
export const createMockAgent = (overrides: Partial<MockAgent> = {}): MockAgent => {
  return {
    id: 'asst_mock_123',
    object: 'assistant',
    created_at: Math.floor(Date.now() / 1000),
    name: 'Test Agent',
    model: 'gpt-4-turbo-preview',
    instructions: 'You are a helpful assistant.',
    tools: [],
    metadata: {
      userId: 'test-user-123',
    },
    description: 'A test agent for unit tests',
    ...overrides,
  };
};

/**
 * Creates a mock agent with code interpreter tool
 *
 * @param overrides - Additional agent overrides
 * @returns Mock agent with code interpreter
 */
export const createMockCodeAgent = (overrides: Partial<MockAgent> = {}): MockAgent => {
  return createMockAgent({
    id: 'asst_code_123',
    name: 'Code Assistant',
    instructions: 'You are a code assistant that helps with programming tasks.',
    tools: [{ type: 'code_interpreter' }],
    ...overrides,
  });
};

/**
 * Creates a mock thread object
 *
 * @param overrides - Partial thread object to override defaults
 * @returns Complete mock thread object
 */
export const createMockThread = (overrides: Partial<MockThread> = {}): MockThread => {
  return {
    id: 'thread_mock_123',
    object: 'thread',
    created_at: Math.floor(Date.now() / 1000),
    metadata: {},
    ...overrides,
  };
};

/**
 * Creates a mock message object
 *
 * @param overrides - Partial message object to override defaults
 * @returns Complete mock message object
 */
export const createMockMessage = (overrides: Partial<MockMessage> = {}): MockMessage => {
  return {
    id: 'msg_mock_123',
    object: 'thread.message',
    created_at: Math.floor(Date.now() / 1000),
    thread_id: 'thread_mock_123',
    role: 'user',
    content: [
      {
        type: 'text',
        text: {
          value: 'Hello, how can you help me?',
          annotations: [],
        },
      },
    ],
    metadata: {},
    ...overrides,
  };
};

/**
 * Creates a mock assistant message
 *
 * @param content - Message content
 * @param overrides - Additional message overrides
 * @returns Mock assistant message
 */
export const createMockAssistantMessage = (
  content: string = 'I can help you with that.',
  overrides: Partial<MockMessage> = {}
): MockMessage => {
  return createMockMessage({
    id: 'msg_assistant_123',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: {
          value: content,
          annotations: [],
        },
      },
    ],
    ...overrides,
  });
};

/**
 * Creates a mock run object
 *
 * @param overrides - Partial run object to override defaults
 * @returns Complete mock run object
 */
export const createMockRun = (overrides: Partial<MockRun> = {}): MockRun => {
  return {
    id: 'run_mock_123',
    object: 'thread.run',
    created_at: Math.floor(Date.now() / 1000),
    thread_id: 'thread_mock_123',
    assistant_id: 'asst_mock_123',
    status: 'completed',
    model: 'gpt-4-turbo-preview',
    instructions: 'You are a helpful assistant.',
    tools: [],
    metadata: {},
    ...overrides,
  };
};

/**
 * Creates multiple mock agents at once
 *
 * @param count - Number of agents to create
 * @param baseOverrides - Base overrides to apply to all agents
 * @returns Array of mock agents
 */
export const createMockAgents = (
  count: number,
  baseOverrides: Partial<MockAgent> = {}
): MockAgent[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockAgent({
      id: `asst_${index + 1}`,
      name: `Agent ${index + 1}`,
      ...baseOverrides,
    })
  );
};
