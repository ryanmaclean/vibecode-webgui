// src/providers/anthropicProvider.ts
import { LLMProvider, LLMMessage, LLMResponse, LLMProviderConfig } from './llmProvider';
import { Logger } from '../logger';

export class AnthropicProvider extends LLMProvider {
    private baseURL: string;

    constructor(config: LLMProviderConfig, logger: Logger) {
        super(config, logger);
        this.validateApiKey();
        this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    }

    get providerName(): string {
        return 'Anthropic';
    }

    get defaultModel(): string {
        return 'claude-3-5-sonnet-20241022';
    }

    async generateCompletion(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
        return this.retry(async () => {
            try {
                const model = this.config.model || this.defaultModel;
                
                // Convert messages format for Anthropic
                const systemMessage = messages.find(m => m.role === 'system');
                const conversationMessages = messages
                    .filter(m => m.role !== 'system')
                    .map(m => ({ role: m.role, content: m.content }));

                const response = await fetch(`${this.baseURL}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.config.apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model,
                        max_tokens: options?.maxTokens || 500,
                        temperature: options?.temperature || 0.2,
                        system: systemMessage?.content,
                        messages: conversationMessages
                    }),
                    signal: AbortSignal.timeout(this.timeout)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
                }

                const data = await response.json();

                return {
                    content: data.content[0].text,
                    model,
                    provider: this.providerName,
                    tokens: {
                        prompt: data.usage.input_tokens,
                        completion: data.usage.output_tokens,
                        total: data.usage.input_tokens + data.usage.output_tokens
                    }
                };
            } catch (error: any) {
                this.logger.error(`Anthropic API error: ${error.message}`, error);
                throw error;
            }
        });
    }
}

