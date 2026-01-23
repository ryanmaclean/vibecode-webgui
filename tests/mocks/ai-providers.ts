/**
 * Mock for AI providers (OpenAI, OpenRouter, etc.)
 */

export const mockChatCompletion = {
  id: 'chatcmpl-test123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a test response',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
};

export const mockStreamChunk = {
  id: 'chatcmpl-test123',
  object: 'chat.completion.chunk',
  created: Date.now(),
  model: 'gpt-4',
  choices: [
    {
      index: 0,
      delta: {
        role: 'assistant',
        content: 'test',
      },
      finish_reason: null,
    },
  ],
};

export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(() => Promise.resolve(mockChatCompletion)),
    },
  },
};

export const mockOpenRouter = {
  chat: jest.fn(() => Promise.resolve(mockChatCompletion)),
  chatStream: jest.fn(async function* () {
    yield mockStreamChunk;
  }),
};

export const mockUnifiedAIClient = {
  chat: jest.fn(() =>
    Promise.resolve({
      content: 'This is a test response',
      model: 'gpt-4',
      provider: 'openai',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    })
  ),
  chatStream: jest.fn(async function* () {
    yield {
      content: 'This ',
      model: 'gpt-4',
      provider: 'openai',
    };
    yield {
      content: 'is a test',
      model: 'gpt-4',
      provider: 'openai',
    };
  }),
};

/**
 * Creates a mock chat completion response with optional overrides
 */
export function mockChatCompletionResponse(
  overrides: Partial<typeof mockChatCompletion> = {}
): typeof mockChatCompletion {
  return {
    ...mockChatCompletion,
    ...overrides,
    choices: overrides.choices || mockChatCompletion.choices,
  };
}

/**
 * Mock fetch for successful AI API calls
 */
export const mockAIFetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockChatCompletion),
  })
);

/**
 * Mock fetch for unauthorized AI API calls (401)
 */
export const mockAIFetchUnauthorized = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'Unauthorized' }),
  })
);

/**
 * Mock fetch for rate-limited AI API calls (429)
 */
export const mockAIFetchRateLimited = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 429,
    json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
  })
);

/**
 * Mock fetch for AI server errors (500)
 */
export const mockAIFetchServerError = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'Internal server error' }),
  })
);

/**
 * Mock fetch for timeout scenarios
 */
export const mockAIFetchTimeout = jest.fn(
  () =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 100)
    )
);

/**
 * Reset all AI mocks to their default state
 */
export function resetAIMocks(): void {
  mockOpenAI.chat.completions.create.mockClear();
  mockOpenRouter.chat.mockClear();
  mockOpenRouter.chatStream.mockClear();
  mockUnifiedAIClient.chat.mockClear();
  mockUnifiedAIClient.chatStream.mockClear();
  mockAIFetch.mockClear();
  mockAIFetchUnauthorized.mockClear();
  mockAIFetchRateLimited.mockClear();
  mockAIFetchServerError.mockClear();
  mockAIFetchTimeout.mockClear();
}

export default {
  mockChatCompletion,
  mockStreamChunk,
  mockOpenAI,
  mockOpenRouter,
  mockUnifiedAIClient,
  mockChatCompletionResponse,
  mockAIFetch,
  mockAIFetchUnauthorized,
  mockAIFetchRateLimited,
  mockAIFetchServerError,
  mockAIFetchTimeout,
  resetAIMocks,
};
