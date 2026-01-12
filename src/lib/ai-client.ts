/**
 * AI Client - Utility for making API calls to /api/ai/chat endpoint
 * Provides both streaming and non-streaming interfaces
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  processing_time_ms?: number;
  from_cache?: boolean;
  cache_hit?: boolean;
}

export interface StreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }>;
}

/**
 * Make a non-streaming chat request to the AI API
 */
export async function chatRequest(
  request: ChatRequest
): Promise<ChatResponse> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: request.messages,
      model: request.model || 'ai/smollm2:360M-Q4_K_M',
      stream: false,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Make a streaming chat request to the AI API
 * Returns an async generator that yields chunks of text
 */
export async function* chatStreamRequest(
  request: ChatRequest
): AsyncGenerator<string, void, unknown> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: request.messages,
      model: request.model || 'ai/smollm2:360M-Q4_K_M',
      stream: true,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
          continue;
        }

        const data = trimmedLine.slice(6); // Remove 'data: ' prefix

        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed: StreamChunk = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;

          if (content) {
            yield content;
          }

          if (parsed.choices?.[0]?.finish_reason) {
            return;
          }
        } catch (e) {
          console.error('Failed to parse stream chunk:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Check the health of the AI chat API
 */
export async function checkHealth(): Promise<{
  status: string;
  service: string;
  available_models: string[];
}> {
  const response = await fetch('/api/ai/chat', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}
