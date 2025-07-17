import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config/environment';
import { logger, performanceLogger } from '../utils/logger';

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
    top_provider?: {
        max_completion_tokens?: number;
        is_moderated?: boolean;
    };
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stream?: boolean;
    stop?: string[];
    user?: string;
}

export interface ChatCompletionResponse {
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
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
}

export interface StreamingChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }>;
}

export interface ModelPerformanceMetrics {
    model: string;
    averageLatency: number;
    successRate: number;
    errorRate: number;
    totalRequests: number;
    lastUpdated: Date;
}

export class OpenRouterClient {
    private client: AxiosInstance;
    private models: AIModel[] = [];
    private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();

    constructor() {
        this.client = axios.create({
            baseURL: config.openrouter.baseUrl,
            timeout: config.openrouter.timeout,
            headers: {
                'Authorization': `Bearer ${config.openrouter.apiKey}`,
                'HTTP-Referer': 'https://vibecode.dev',
                'X-Title': 'VibeCode AI Gateway',
                'Content-Type': 'application/json'
            }
        });

        // Request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                logger.debug('OpenRouter request', {
                    url: config.url,
                    method: config.method,
                    headers: { ...config.headers, Authorization: '[REDACTED]' }
                });
                return config;
            },
            (error) => {
                logger.error('OpenRouter request error', { error });
                return Promise.reject(error);
            }
        );

        // Response interceptor for logging and metrics
        this.client.interceptors.response.use(
            (response) => {
                logger.debug('OpenRouter response', {
                    status: response.status,
                    url: response.config.url,
                    responseTime: response.headers['x-response-time']
                });
                return response;
            },
            (error) => {
                logger.error('OpenRouter response error', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    url: error.config?.url,
                    error: error.response?.data
                });
                return Promise.reject(error);
            }
        );
    }

    public async getModels(): Promise<AIModel[]> {
        const startTime = Date.now();

        try {
            const response: AxiosResponse<{ data: AIModel[] }> = await this.client.get('/models');
            this.models = response.data.data;

            performanceLogger.logRequest('get_models', startTime, {
                modelCount: this.models.length
            });

            return this.models;
        } catch (error) {
            performanceLogger.logError('get_models', startTime, error);
            throw this.handleError(error, 'Failed to fetch models');
        }
    }

    public async chatCompletion(
        request: ChatCompletionRequest,
        userId?: string
    ): Promise<ChatCompletionResponse> {
        const startTime = Date.now();
        const model = request.model;

        try {
            // Add user ID to request if provided
            const requestData = {
                ...request,
                user: userId || request.user
            };

            const response: AxiosResponse<ChatCompletionResponse> = await this.client.post(
                '/chat/completions',
                requestData
            );

            const result = response.data;

            // Update performance metrics
            this.updatePerformanceMetrics(model, Date.now() - startTime, true);

            performanceLogger.logRequest('chat_completion', startTime, {
                model,
                userId,
                promptTokens: result.usage.prompt_tokens,
                completionTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens
            });

            return result;
        } catch (error) {
            this.updatePerformanceMetrics(model, Date.now() - startTime, false);
            performanceLogger.logError('chat_completion', startTime, error, { model, userId });
            throw this.handleError(error, 'Chat completion failed');
        }
    }

    public async streamChatCompletion(
        request: ChatCompletionRequest,
        onChunk: (chunk: StreamingChunk) => void,
        userId?: string
    ): Promise<void> {
        const startTime = Date.now();
        const model = request.model;

        try {
            const requestData = {
                ...request,
                stream: true,
                user: userId || request.user
            };

            const response = await this.client.post('/chat/completions', requestData, {
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let totalTokens = 0;

                response.data.on('data', (chunk: Buffer) => {
                    const lines = chunk.toString().split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);

                            if (data === '[DONE]') {
                                this.updatePerformanceMetrics(model, Date.now() - startTime, true);
                                performanceLogger.logRequest('stream_chat_completion', startTime, {
                                    model,
                                    userId,
                                    totalTokens
                                });
                                resolve();
                                return;
                            }

                            try {
                                const parsed: StreamingChunk = JSON.parse(data);
                                onChunk(parsed);

                                // Estimate token count (rough approximation)
                                const content = parsed.choices[0]?.delta?.content;
                                if (content) {
                                    totalTokens += Math.ceil(content.length / 4);
                                }
                            } catch (e) {
                                // Skip invalid JSON lines
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    this.updatePerformanceMetrics(model, Date.now() - startTime, true);
                    performanceLogger.logRequest('stream_chat_completion', startTime, {
                        model,
                        userId,
                        totalTokens
                    });
                    resolve();
                });

                response.data.on('error', (error: any) => {
                    this.updatePerformanceMetrics(model, Date.now() - startTime, false);
                    performanceLogger.logError('stream_chat_completion', startTime, error, { model, userId });
                    reject(error);
                });
            });
        } catch (error) {
            this.updatePerformanceMetrics(model, Date.now() - startTime, false);
            performanceLogger.logError('stream_chat_completion', startTime, error, { model, userId });
            throw this.handleError(error, 'Streaming chat completion failed');
        }
    }

    public getModel(modelId: string): AIModel | undefined {
        return this.models.find(model => model.id === modelId);
    }

    public getModelsByProvider(provider: string): AIModel[] {
        return this.models.filter(model => model.provider === provider);
    }

    public getPerformanceMetrics(modelId: string): ModelPerformanceMetrics | undefined {
        return this.performanceMetrics.get(modelId);
    }

    public getAllPerformanceMetrics(): ModelPerformanceMetrics[] {
        return Array.from(this.performanceMetrics.values());
    }

    public calculateCost(model: string, promptTokens: number, completionTokens: number): number {
        const modelInfo = this.getModel(model);
        if (!modelInfo) {
            logger.warn('Model not found for cost calculation', { model });
            return 0;
        }

        const promptCost = (promptTokens / 1000) * modelInfo.pricing.prompt;
        const completionCost = (completionTokens / 1000) * modelInfo.pricing.completion;

        return promptCost + completionCost;
    }

    private updatePerformanceMetrics(model: string, latency: number, success: boolean): void {
        const existing = this.performanceMetrics.get(model);

        if (existing) {
            existing.totalRequests++;
            existing.averageLatency = (existing.averageLatency * (existing.totalRequests - 1) + latency) / existing.totalRequests;

            if (success) {
                existing.successRate = ((existing.successRate * (existing.totalRequests - 1)) + 1) / existing.totalRequests;
            } else {
                existing.successRate = (existing.successRate * (existing.totalRequests - 1)) / existing.totalRequests;
            }

            existing.errorRate = 1 - existing.successRate;
            existing.lastUpdated = new Date();
        } else {
            this.performanceMetrics.set(model, {
                model,
                averageLatency: latency,
                successRate: success ? 1 : 0,
                errorRate: success ? 0 : 1,
                totalRequests: 1,
                lastUpdated: new Date()
            });
        }
    }

    private handleError(error: any, defaultMessage: string): Error {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            switch (status) {
                case 400:
                    return new Error(`Bad Request: ${data?.error?.message || 'Invalid request parameters'}`);
                case 401:
                    return new Error('Unauthorized: Invalid API key');
                case 402:
                    return new Error('Payment Required: Insufficient credits');
                case 403:
                    return new Error('Forbidden: Access denied');
                case 429:
                    return new Error('Rate Limit Exceeded: Too many requests');
                case 500:
                    return new Error('Internal Server Error: OpenRouter service unavailable');
                case 502:
                case 503:
                case 504:
                    return new Error('Service Unavailable: OpenRouter service temporarily unavailable');
                default:
                    return new Error(`HTTP ${status}: ${data?.error?.message || defaultMessage}`);
            }
        } else if (error.code === 'ECONNABORTED') {
            return new Error('Request Timeout: OpenRouter request timed out');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return new Error('Network Error: Unable to connect to OpenRouter');
        } else {
            return new Error(`${defaultMessage}: ${error.message}`);
        }
    }
}
