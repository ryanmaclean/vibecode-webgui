/**
 * AI Provider Mocks for Testing
 *
 * Mock responses and utilities for testing AI endpoints without making real API calls.
 * This prevents CI failures and reduces API costs during testing.
 */

export interface MockOpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockOpenRouterResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
  }>;
}

/**
 * Create a mock OpenAI/OpenRouter chat completion response
 */
export const mockChatCompletionResponse = (overrides: Partial<MockOpenAIResponse> = {}): MockOpenAIResponse => ({
  id: `chatcmpl-${Date.now()}`,
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a mock AI response for testing purposes.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
  ...overrides,
});

/**
 * Create a mock OpenRouter response
 */
export const mockOpenRouterResponse = (overrides: Partial<MockOpenRouterResponse> = {}): MockOpenRouterResponse => ({
  id: `chatcmpl-or-${Date.now()}`,
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'anthropic/claude-3.5-sonnet',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a mock response from OpenRouter.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 15,
    completion_tokens: 25,
    total_tokens: 40,
  },
  ...overrides,
});

/**
 * Create an async iterable for streaming responses
 */
export function createMockStreamIterable(chunks: string[]): AsyncIterable<MockStreamChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield {
          choices: [
            {
              delta: {
                content: chunk,
              },
            },
          ],
        };
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}

/**
 * Mock fetch for AI API calls
 */
export const mockAIFetch = (response: any, status = 200, ok = true) => {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
};

/**
 * Mock fetch that fails with specific error
 */
export const mockAIFetchError = (error: Error) => {
  return jest.fn().mockRejectedValue(error);
};

/**
 * Mock fetch that times out
 */
export const mockAIFetchTimeout = () => {
  return jest.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), 100);
    });
  });
};

/**
 * Mock fetch with rate limiting (429 error)
 */
export const mockAIFetchRateLimited = () => {
  return jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: async () => ({
      error: {
        message: 'Rate limit exceeded',
        type: 'rate_limit_error',
      },
    }),
  });
};

/**
 * Mock fetch with authentication error (401)
 */
export const mockAIFetchUnauthorized = () => {
  return jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({
      error: {
        message: 'Invalid API key',
        type: 'authentication_error',
      },
    }),
  });
};

/**
 * Mock fetch with server error (500)
 */
export const mockAIFetchServerError = () => {
  return jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({
      error: {
        message: 'Internal server error',
        type: 'server_error',
      },
    }),
  });
};

/**
 * Mock provider health response
 */
export const mockProviderHealthResponse = (provider: string, available = true, latency = 150) => ({
  provider,
  available,
  latency,
  error: available ? undefined : 'Provider unavailable',
  timestamp: new Date().toISOString(),
});

/**
 * Mock model selection response
 */
export const mockModelSelectionResponse = (selectedModel = 'anthropic/claude-3.5-sonnet') => ({
  success: true,
  selection: {
    selectedModel,
    confidence: 0.95,
    reasoning: 'Model selected based on task complexity and requirements',
    alternatives: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'],
    fallbackModel: 'openai/gpt-4o-mini',
  },
  analysis: {
    type: 'code',
    complexity: 'medium',
    promptLength: 150,
    detectedLanguages: ['typescript', 'javascript'],
    requiresReasoning: true,
    requiresCreativity: false,
    requiresAccuracy: true,
    hasMultimedia: false,
    keywords: ['react', 'typescript', 'component', 'testing', 'jest'],
  },
  modelDetails: {
    selected: {
      name: 'Claude 3.5 Sonnet',
      provider: 'openrouter',
      strengths: ['reasoning', 'coding', 'analysis'],
      contextLength: 200000,
      qualityTier: 'excellent',
      speedTier: 'fast',
      costTier: 'medium',
      capabilities: {
        supportsImages: true,
        supportsCode: true,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
    },
    fallback: {
      name: 'GPT-4o Mini',
      provider: 'openrouter',
      reason: 'Fast, reliable fallback option',
    },
  },
  metadata: {
    responseTime: 45,
    analysisTimestamp: new Date().toISOString(),
    apiVersion: '1.0',
    totalModelsEvaluated: 15,
  },
});

/**
 * Setup global fetch mock for AI tests
 */
export const setupAIFetchMock = (response: any = mockChatCompletionResponse()) => {
  global.fetch = mockAIFetch(response);
};

/**
 * Reset all AI mocks
 */
export const resetAIMocks = () => {
  jest.clearAllMocks();
  if (global.fetch && typeof global.fetch === 'function' && 'mockClear' in global.fetch) {
    (global.fetch as jest.Mock).mockClear();
  }
};

/**
 * Mock function call response
 */
export const mockFunctionCallResponse = (overrides: Record<string, any> = {}) => ({
  function: 'get_weather',
  arguments: { location: 'San Francisco' },
  result: { temperature: 72, conditions: 'sunny' },
  executionTime: 150,
  ...overrides,
});

/**
 * Mock file upload response
 */
export const mockFileUploadResponse = (overrides: Record<string, any> = {}) => ({
  success: true,
  filesUploaded: 1,
  workspaceId: 'test-workspace',
  files: [
    {
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
    },
  ],
  ...overrides,
});

/**
 * Mock file analysis response (for AI processing)
 */
export const mockFileAnalysisResponse = (overrides: Record<string, any> = {}) => ({
  fileId: 'file_test_123',
  fileName: 'document.txt',
  analysis: {
    text: 'Extracted text content from the file...',
    summary: 'This document discusses key concepts in software development.',
    keyPoints: [
      'Point 1: Code quality matters',
      'Point 2: Tests prevent bugs',
      'Point 3: Documentation helps teams',
    ],
    language: 'en',
    wordCount: 1500,
    sentiment: 'neutral',
  },
  ...overrides,
});

/**
 * Mock project generation response
 */
export const mockProjectGenerationResponse = (overrides: Record<string, any> = {}) => ({
  status: 'success',
  message: 'Project generation endpoint is working',
  timestamp: new Date().toISOString(),
  project: {
    name: 'generated-project',
    description: 'A test project',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {},
        }),
      },
      {
        path: 'src/index.ts',
        content: 'console.log("Hello World");',
      },
      {
        path: 'README.md',
        content: '# Test Project\n\nGenerated by AI',
      },
    ],
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      react: '^18.0.0',
      next: '^14.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/react': '^18.0.0',
    },
    envVars: [
      'DATABASE_URL',
      'API_KEY',
    ],
  },
  ...overrides,
});

/**
 * Create mock file blob for upload testing
 */
export const createMockFile = (
  content: string,
  filename: string,
  mimeType = 'text/plain'
): File => {
  const blob = new Blob([content], { type: mimeType });
  // Cast to File (in test environment)
  return Object.assign(blob, {
    name: filename,
    lastModified: Date.now(),
  }) as File;
};

/**
 * Create mock FormData for file upload tests
 */
export const createMockFormData = (
  files: Array<{ content: string; name: string; type?: string }>,
  workspaceId = 'test-workspace'
): FormData => {
  const formData = new FormData();
  formData.append('workspaceId', workspaceId);

  files.forEach((file) => {
    const blob = new Blob([file.content], { type: file.type || 'text/plain' });
    formData.append('files', blob, file.name);
  });

  return formData;
};
