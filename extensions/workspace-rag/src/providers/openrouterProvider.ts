// src/providers/openrouterProvider.ts
import { LLMProvider, LLMMessage, LLMResponse, LLMProviderConfig } from './llmProvider';
import { Logger } from '../logger';

export class OpenRouterProvider extends LLMProvider {
    private baseURL: string;

    constructor(config: LLMProviderConfig, logger: Logger) {
        super(config, logger);
        this.validateApiKey();
        this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
    }

    get providerName(): string {
        return 'OpenRouter';
    }

    get defaultModel(): string {
        return 'anthropic/claude-3.5-sonnet';
    }

    async generateCompletion(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
        return this.retry(async () => {
            try {
                const model = this.config.model || this.defaultModel;
                
                const response = await fetch(`${this.baseURL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'HTTP-Referer': 'https://github.com/vibecode/workspace-rag',
                        'X-Title': 'Workspace RAG Extension'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: options?.temperature || 0.2,
                        max_tokens: options?.maxTokens || 500,
                        ...options
                    }),
                    signal: AbortSignal.timeout(this.timeout)
                });

                if (!response.ok) {
                    const error = await response.json() as any;
                    throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
                }

                const data = await response.json() as any;

                return {
                    content: data.choices[0].message.content,
                    model,
                    provider: this.providerName,
                    tokens: {
                        prompt: data.usage?.prompt_tokens || 0,
                        completion: data.usage?.completion_tokens || 0,
                        total: data.usage?.total_tokens || 0
                    }
                };
            } catch (error: any) {
                this.logger.error(`OpenRouter API error: ${error.message}`, error);
                throw error;
            }
        });
    }
}

