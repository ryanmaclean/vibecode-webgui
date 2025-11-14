// src/providers/openaiProvider.ts
import { OpenAI } from 'openai';
import { LLMProvider, LLMMessage, LLMResponse, LLMProviderConfig } from './llmProvider';
import { Logger } from '../logger';

export class OpenAIProvider extends LLMProvider {
    private client: OpenAI;

    constructor(config: LLMProviderConfig, logger: Logger) {
        super(config, logger);
        this.validateApiKey();
        
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            timeout: this.timeout,
            maxRetries: 0 // Handle retries ourselves
        });
    }

    get providerName(): string {
        return 'OpenAI';
    }

    get defaultModel(): string {
        return 'gpt-4-turbo-preview';
    }

    async generateCompletion(messages: LLMMessage[], options?: any): Promise<LLMResponse> {
        return this.retry(async () => {
            try {
                const model = this.config.model || this.defaultModel;
                
                const response = await this.client.chat.completions.create({
                    model,
                    messages: messages as any,
                    temperature: options?.temperature || 0.2,
                    max_tokens: options?.maxTokens || 500,
                    ...options
                });

                return {
                    content: response.choices[0].message.content || '',
                    model,
                    provider: this.providerName,
                    tokens: {
                        prompt: response.usage?.prompt_tokens || 0,
                        completion: response.usage?.completion_tokens || 0,
                        total: response.usage?.total_tokens || 0
                    }
                };
            } catch (error: any) {
                this.logger.error(`OpenAI API error: ${error.message}`, error);
                throw error;
            }
        });
    }
}

