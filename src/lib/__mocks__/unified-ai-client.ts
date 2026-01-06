// Manual mock for unified-ai-client to avoid module initialization
export class UnifiedAIClient {
  public chat = jest.fn().mockResolvedValue({
    content: 'Mock response',
    model: 'gpt-4o',
    provider: 'openai',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  });

  public chatStream = jest.fn().mockImplementation(async function* () {
    yield { content: 'Mock ', model: 'gpt-4o', provider: 'openai', done: false };
    yield { content: 'stream', model: 'gpt-4o', provider: 'openai', done: true };
  });

  public checkHealth = jest.fn().mockResolvedValue({
    openai: true,
    openrouter: true,
  });

  public getProviderForModel = jest.fn().mockReturnValue('openai');
  public getAvailableProviders = jest.fn().mockReturnValue([]);
  public getAvailableModels = jest.fn().mockReturnValue([]);
  public getProviderHealth = jest.fn().mockResolvedValue({});
  public updateApiKeys = jest.fn();

  constructor(apiKeys?: any) {
    // Mock constructor - no actual initialization
  }
}

export function getUnifiedAI() {
  return new UnifiedAIClient();
}

export const unifiedAI = new UnifiedAIClient();
export default unifiedAI;

export type UnifiedChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type UnifiedChatResponse = {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

export type UnifiedStreamChunk = {
  content: string;
  done: boolean;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export const AI_PROVIDERS = {
  openai: { id: 'openai', name: 'OpenAI Direct', baseURL: 'https://api.openai.com/v1', models: [], apiKeyRequired: true },
  openrouter: { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', models: [], apiKeyRequired: true },
  ollama: { id: 'ollama', name: 'Ollama Local', baseURL: 'http://localhost:11434/v1', models: [], apiKeyRequired: false },
};
