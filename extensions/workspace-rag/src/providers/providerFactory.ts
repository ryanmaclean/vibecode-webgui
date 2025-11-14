// src/providers/providerFactory.ts
import * as vscode from 'vscode';
import { Logger } from '../logger';
import { LLMProvider, LLMProviderConfig } from './llmProvider';
import { OpenAIProvider } from './openaiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { GoogleProvider } from './googleProvider';
import { OpenRouterProvider } from './openrouterProvider';

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'openrouter';

export class ProviderFactory {
    private logger: Logger;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, logger: Logger) {
        this.context = context;
        this.logger = logger;
    }

    async createProvider(providerType?: ProviderType): Promise<LLMProvider> {
        const config = vscode.workspace.getConfiguration('workspaceRag');
        const selectedProvider = providerType || config.get<ProviderType>('llmProvider', 'openai');

        this.logger.debug(`Creating LLM provider: ${selectedProvider}`);

        const apiKey = await this.getApiKeyForProvider(selectedProvider);
        if (!apiKey) {
            throw new Error(`No API key configured for ${selectedProvider}. Please run 'RAG: Set ${this.getProviderDisplayName(selectedProvider)} API Key'`);
        }

        const providerConfig: LLMProviderConfig = {
            apiKey,
            model: config.get(`${selectedProvider}Model`),
            baseURL: config.get(`${selectedProvider}BaseURL`),
            timeout: config.get('llmTimeout', 30000),
            maxRetries: config.get('llmMaxRetries', 3)
        };

        switch (selectedProvider) {
            case 'openai':
                return new OpenAIProvider(providerConfig, this.logger);
            case 'anthropic':
                return new AnthropicProvider(providerConfig, this.logger);
            case 'google':
                return new GoogleProvider(providerConfig, this.logger);
            case 'openrouter':
                return new OpenRouterProvider(providerConfig, this.logger);
            default:
                throw new Error(`Unknown provider: ${selectedProvider}`);
        }
    }

    private async getApiKeyForProvider(provider: ProviderType): Promise<string | undefined> {
        const secretKey = `${provider}ApiKey`;
        return await this.context.secrets.get(secretKey);
    }

    private getProviderDisplayName(provider: ProviderType): string {
        const names: Record<ProviderType, string> = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google',
            'openrouter': 'OpenRouter'
        };
        return names[provider];
    }

    async setApiKey(provider: ProviderType, apiKey: string): Promise<void> {
        const secretKey = `${provider}ApiKey`;
        await this.context.secrets.store(secretKey, apiKey);
        this.logger.info(`API key set for provider: ${provider}`);
    }

    async listAvailableProviders(): Promise<Array<{ type: ProviderType; hasKey: boolean; name: string }>> {
        const providers: ProviderType[] = ['openai', 'anthropic', 'google', 'openrouter'];
        
        const results = await Promise.all(
            providers.map(async (type) => ({
                type,
                hasKey: !!(await this.getApiKeyForProvider(type)),
                name: this.getProviderDisplayName(type)
            }))
        );

        return results;
    }
}

