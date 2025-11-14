// src/providers/googleProvider.ts
import { LLMProvider, LLMMessage, LLMResponse, LLMProviderConfig } from './llmProvider';
import { Logger } from '../logger';

export class GoogleProvider extends LLMProvider {
    private baseURL: string;

    constructor(config: LLMProviderConfig, logger: Logger) {
        super(config, logger);
        this.validateApiKey();
        this.baseURL = config.baseURL || 'https://generativelanguage.googleapis.com/v1beta';
    }

    get providerName(): string {
        return 'Google';
    }

    get defaultModel(): string {
        return 'gemini-1.5-pro-latest';
    }

    async generateCompletion(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
        return this.retry(async () => {
            try {
                const model = this.config.model || this.defaultModel;
                
                // Convert messages to Gemini format
                const contents = messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));

                const response = await fetch(
                    `${this.baseURL}/models/${model}:generateContent?key=${this.config.apiKey}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents,
                            generationConfig: {
                                temperature: options?.temperature || 0.2,
                                maxOutputTokens: options?.maxTokens || 500,
                                topK: options?.topK || 40,
                                topP: options?.topP || 0.95
                            }
                        }),
                        signal: AbortSignal.timeout(this.timeout)
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`Google API error: ${error.error?.message || response.statusText}`);
                }

                const data = await response.json();

                return {
                    content: data.candidates[0].content.parts[0].text,
                    model,
                    provider: this.providerName,
                    tokens: {
                        prompt: data.usageMetadata?.promptTokenCount || 0,
                        completion: data.usageMetadata?.candidatesTokenCount || 0,
                        total: data.usageMetadata?.totalTokenCount || 0
                    }
                };
            } catch (error: any) {
                this.logger.error(`Google API error: ${error.message}`, error);
                throw error;
            }
        });
    }
}

