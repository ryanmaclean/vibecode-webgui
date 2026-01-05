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

export default {
  mockChatCompletion,
  mockStreamChunk,
  mockOpenAI,
  mockOpenRouter,
  mockUnifiedAIClient,
};
