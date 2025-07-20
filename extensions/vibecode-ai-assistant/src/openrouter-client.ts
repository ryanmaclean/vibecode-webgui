import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

export interface AIModel {
    id: string;
    name: string;
    provider: string;
    pricing: {
        prompt: number;
        completion: number;
    };
    context_length: number;
    architecture: {
        modality: string;
        tokenizer: string;
        instruct_type?: string;
    };
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    model: string;
}

export interface StreamingResponse {
    choices: Array<{
        delta: {
            content?: string;
        };
        finish_reason?: string;
    }>;
}

export class OpenRouterClient {
    private client: AxiosInstance;
    private apiKey: string;
    private baseURL = 'https://openrouter.ai/api/v1';
    private models: AIModel[] = [];

    constructor() {
        this.apiKey = this.getApiKey();
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://vibecode.dev',
                'X-Title': 'VibeCode AI Assistant',
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
    }

    private getApiKey(): string {
        const config = vscode.workspace.getConfiguration('vibecode');
        return config.get<string>('openRouterApiKey') || '';
    }

    public updateConfiguration(): void {
        this.apiKey = this.getApiKey();
        this.client.defaults.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    public async validateApiKey(): Promise<boolean> {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await this.client.get('/models');
            return response.status === 200;
        } catch (error) {
            console.error('API key validation failed:', error);
            return false;
        }
    }

    public async getModels(): Promise<AIModel[]> {
        try {
            const response = await this.client.get('/models');
            this.models = response.data.data;
            return this.models;
        } catch (error) {
            console.error('Failed to fetch models:', error);
            throw new Error('Failed to fetch available models');
        }
    }

    public async chatCompletion(
        messages: ChatMessage[],
        model?: string,
        stream: boolean = false
    ): Promise<AIResponse> {
        const config = vscode.workspace.getConfiguration('vibecode');
        const selectedModel = model || config.get<string>('defaultModel') || 'anthropic/claude-3-sonnet-20240229';
        const maxTokens = config.get<number>('maxTokens') || 4000;
        const temperature = config.get<number>('temperature') || 0.7;

        const requestData = {
            model: selectedModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream
        };

        try {
            const response = await this.client.post('/chat/completions', requestData);
            return response.data;
        } catch (error: any) {
            console.error('Chat completion failed:', error);

            if (error.response?.status === 401) {
                throw new Error('Invalid API key. Please check your OpenRouter API key in settings.');
            } else if (error.response?.status === 402) {
                throw new Error('Insufficient credits. Please check your OpenRouter account balance.');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`AI request failed: ${error.response?.data?.error?.message || error.message}`);
            }
        }
    }

    public async streamChatCompletion(
        messages: ChatMessage[],
        model?: string,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
        const config = vscode.workspace.getConfiguration('vibecode');
        const selectedModel = model || config.get<string>('defaultModel') || 'anthropic/claude-3-sonnet-20240229';
        const maxTokens = config.get<number>('maxTokens') || 4000;
        const temperature = config.get<number>('temperature') || 0.7;

        const requestData = {
            model: selectedModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: true
        };

        try {
            const response = await this.client.post('/chat/completions', requestData, {
                responseType: 'stream'
            });

            let fullResponse = '';

            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    const lines = chunk.toString().split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                resolve(fullResponse);
                                return;
                            }

                            try {
                                let parsed: StreamingResponse;
                                try {
                                    parsed = JSON.parse(data);
                                } catch (e) {
                                    // Skip invalid JSON lines
                                    continue;
                                }
                                const content = parsed.choices[0]?.delta?.content;

                                if (content) {
                                    fullResponse += content;
                                    onChunk?.(content);
                                }
                            } catch (e) {
                                // Skip invalid JSON lines
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    resolve(fullResponse);
                });

                response.data.on('error', (error: any) => {
                    reject(error);
                });
            });
        } catch (error: any) {
            console.error('Streaming chat completion failed:', error);
            throw new Error(`Streaming AI request failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    public async generateCode(
        prompt: string,
        context?: string,
        language?: string
    ): Promise<string> {
        const systemPrompt = `You are a skilled software developer. Generate high-quality, clean, and well-documented code based on the user's request.
        ${language ? `The code should be in ${language}.` : ''}
        ${context ? `Context: ${context}` : ''}

        Rules:
        - Write clean, readable code
        - Include appropriate comments
        - Follow best practices and conventions
        - Handle edge cases and errors
        - Return only the code, no explanations`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }

    public async explainCode(code: string): Promise<string> {
        const systemPrompt = `You are a code expert. Explain the provided code in clear, understandable terms.
        Include:
        - What the code does
        - How it works
        - Key concepts and patterns used
        - Any potential issues or improvements`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please explain this code:\n\n${code}` }
        ];

        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }

    public async optimizeCode(code: string): Promise<string> {
        const systemPrompt = `You are a performance optimization expert. Analyze the provided code and suggest optimizations.
        Focus on:
        - Performance improvements
        - Code readability
        - Best practices
        - Security considerations
        - Memory efficiency

        Provide the optimized code with explanations of changes made.`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please optimize this code:\n\n${code}` }
        ];

        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }

    public async fixCode(code: string, error?: string): Promise<string> {
        const systemPrompt = `You are a debugging expert. Fix the issues in the provided code.
        ${error ? `Error message: ${error}` : ''}

        Provide:
        - The corrected code
        - Explanation of what was wrong
        - How the fix addresses the issue`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please fix this code:\n\n${code}` }
        ];

        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }

    public async generateTests(code: string, framework?: string): Promise<string> {
        const systemPrompt = `You are a test automation expert. Generate comprehensive tests for the provided code.
        ${framework ? `Use ${framework} testing framework.` : ''}

        Include:
        - Unit tests for all functions
        - Edge case testing
        - Error handling tests
        - Mock data where appropriate
        - Clear test descriptions`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please generate tests for this code:\n\n${code}` }
        ];

        const response = await this.chatCompletion(messages);
        return response.choices[0].message.content;
    }
}
