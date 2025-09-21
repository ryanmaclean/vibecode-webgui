export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
  user?: string;
  // Optional explicit provider hint
  provider?: 'azure' | 'openai' | 'hf' | 'openrouter' | 'ollama';
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatChoiceDelta {
  role?: 'assistant';
  content?: string;
}

export interface ChatChoice {
  index: number;
  message?: { role: 'assistant'; content: string };
  delta?: ChatChoiceDelta; // for streaming
  finish_reason?: string | null;
}

export interface ChatResponse {
  id?: string;
  model: string;
  choices: ChatChoice[];
  usage: ChatUsage;
}

export interface Provider {
  name: string;
  chatCompletion(req: ChatRequest, userId?: string): Promise<ChatResponse>;
}
