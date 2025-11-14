// src/providers/llmProvider.ts
import { Logger } from '../logger';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    provider: string;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

export interface LLMProviderConfig {
    apiKey: string;
    model?: string;
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
}

export abstract class LLMProvider {
    protected logger: Logger;
    protected config: LLMProviderConfig;
    protected maxRetries: number;
    protected timeout: number;

    constructor(config: LLMProviderConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.maxRetries = config.maxRetries || 3;
        this.timeout = config.timeout || 30000;
    }

    abstract generateCompletion(messages: LLMMessage[], options?: any): Promise<LLMResponse>;
    abstract get providerName(): string;
    abstract get defaultModel(): string;

    protected async retry<T>(
        operation: () => Promise<T>,
        retries: number = this.maxRetries
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                
                if (this.isRetryableError(error) && attempt < retries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    this.logger.debug(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms`);
                    await this.sleep(delay);
                } else {
                    throw error;
                }
            }
        }

        throw lastError!;
    }

    protected isRetryableError(error: any): boolean {
        if (!error.status) return true;
        return error.status === 429 || error.status >= 500;
    }

    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    protected validateApiKey(): void {
        if (!this.config.apiKey || this.config.apiKey.trim().length === 0) {
            throw new Error(`${this.providerName} API key is required`);
        }
    }
}

