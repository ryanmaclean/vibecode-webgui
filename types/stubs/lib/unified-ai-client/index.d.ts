export interface UnifiedChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UnifiedProvider {
  name: string;
}

export interface ProviderHealthMap {
  [provider: string]: boolean;
}

export interface UnifiedChatChunk {
  content?: string;
  model?: string;
  provider?: string;
  usage?: { totalTokens?: number };
  done?: boolean;
}

export interface UnifiedAIClient {
  getAvailableProviders(): UnifiedProvider[];
  getProviderHealth(): Promise<ProviderHealthMap>;
  chatStream(messages: UnifiedChatMessage[], model: string, options: any): AsyncIterable<UnifiedChatChunk>;
  getProviderForModel?(model: string): string;
}

export class UnifiedAIClient {
  constructor(config: any);
}
