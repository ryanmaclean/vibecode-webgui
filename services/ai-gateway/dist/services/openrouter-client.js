"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterClient = void 0;
const axios_1 = __importDefault(require("axios"));
const environment_1 = require("../config/environment");
const logger_1 = require("../utils/logger");
class OpenRouterClient {
    constructor() {
        this.models = [];
        this.performanceMetrics = new Map();
        this.client = axios_1.default.create({
            baseURL: environment_1.config.openrouter.baseUrl,
            timeout: environment_1.config.openrouter.timeout,
            headers: {
                'Authorization': `Bearer ${environment_1.config.openrouter.apiKey}`,
                'HTTP-Referer': 'https://vibecode.dev',
                'X-Title': 'VibeCode AI Gateway',
                'Content-Type': 'application/json'
            }
        });
        this.client.interceptors.request.use((config) => {
            logger_1.logger.debug('OpenRouter request', {
                url: config.url,
                method: config.method,
                headers: { ...config.headers, Authorization: '[REDACTED]' }
            });
            return config;
        }, (error) => {
            logger_1.logger.error('OpenRouter request error', { error });
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            logger_1.logger.debug('OpenRouter response', {
                status: response.status,
                url: response.config.url,
                responseTime: response.headers['x-response-time']
            });
            return response;
        }, (error) => {
            logger_1.logger.error('OpenRouter response error', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                error: error.response?.data
            });
            return Promise.reject(error);
        });
    }
    async getModels() {
        const startTime = Date.now();
        try {
            const response = await this.client.get('/models');
            this.models = response.data.data;
            logger_1.performanceLogger.logRequest('get_models', startTime, {
                modelCount: this.models.length
            });
            return this.models;
        }
        catch (error) {
            logger_1.performanceLogger.logError('get_models', startTime, error);
            throw this.handleError(error, 'Failed to fetch models');
        }
    }
    async chatCompletion(request, userId) {
        const startTime = Date.now();
        const model = request.model;
        try {
            const requestData = {
                ...request,
                user: userId || request.user
            };
            const response = await this.client.post('/chat/completions', requestData);
            const result = response.data;
            this.updatePerformanceMetrics(model, Date.now() - startTime, true);
            logger_1.performanceLogger.logRequest('chat_completion', startTime, {
                model,
                userId,
                promptTokens: result.usage.prompt_tokens,
                completionTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens
            });
            return result;
        }
        catch (error) {
            this.updatePerformanceMetrics(model, Date.now() - startTime, false);
            logger_1.performanceLogger.logError('chat_completion', startTime, error, { model, userId });
            throw this.handleError(error, 'Chat completion failed');
        }
    }
    async streamChatCompletion(request, onChunk, userId) {
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
                response.data.on('data', (chunk) => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                this.updatePerformanceMetrics(model, Date.now() - startTime, true);
                                logger_1.performanceLogger.logRequest('stream_chat_completion', startTime, {
                                    model,
                                    userId,
                                    totalTokens
                                });
                                resolve();
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                onChunk(parsed);
                                const content = parsed.choices[0]?.delta?.content;
                                if (content) {
                                    totalTokens += Math.ceil(content.length / 4);
                                }
                            }
                            catch (e) {
                            }
                        }
                    }
                });
                response.data.on('end', () => {
                    this.updatePerformanceMetrics(model, Date.now() - startTime, true);
                    logger_1.performanceLogger.logRequest('stream_chat_completion', startTime, {
                        model,
                        userId,
                        totalTokens
                    });
                    resolve();
                });
                response.data.on('error', (error) => {
                    this.updatePerformanceMetrics(model, Date.now() - startTime, false);
                    logger_1.performanceLogger.logError('stream_chat_completion', startTime, error, { model, userId });
                    reject(error);
                });
            });
        }
        catch (error) {
            this.updatePerformanceMetrics(model, Date.now() - startTime, false);
            logger_1.performanceLogger.logError('stream_chat_completion', startTime, error, { model, userId });
            throw this.handleError(error, 'Streaming chat completion failed');
        }
    }
    getModel(modelId) {
        return this.models.find(model => model.id === modelId);
    }
    getModelsByProvider(provider) {
        return this.models.filter(model => model.provider === provider);
    }
    getPerformanceMetrics(modelId) {
        return this.performanceMetrics.get(modelId);
    }
    getAllPerformanceMetrics() {
        return Array.from(this.performanceMetrics.values());
    }
    calculateCost(model, promptTokens, completionTokens) {
        const modelInfo = this.getModel(model);
        if (!modelInfo) {
            logger_1.logger.warn('Model not found for cost calculation', { model });
            return 0;
        }
        const promptCost = (promptTokens / 1000) * modelInfo.pricing.prompt;
        const completionCost = (completionTokens / 1000) * modelInfo.pricing.completion;
        return promptCost + completionCost;
    }
    updatePerformanceMetrics(model, latency, success) {
        const existing = this.performanceMetrics.get(model);
        if (existing) {
            existing.totalRequests++;
            existing.averageLatency = (existing.averageLatency * (existing.totalRequests - 1) + latency) / existing.totalRequests;
            if (success) {
                existing.successRate = ((existing.successRate * (existing.totalRequests - 1)) + 1) / existing.totalRequests;
            }
            else {
                existing.successRate = (existing.successRate * (existing.totalRequests - 1)) / existing.totalRequests;
            }
            existing.errorRate = 1 - existing.successRate;
            existing.lastUpdated = new Date();
        }
        else {
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
    handleError(error, defaultMessage) {
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
        }
        else if (error.code === 'ECONNABORTED') {
            return new Error('Request Timeout: OpenRouter request timed out');
        }
        else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return new Error('Network Error: Unable to connect to OpenRouter');
        }
        else {
            return new Error(`${defaultMessage}: ${error.message}`);
        }
    }
}
exports.OpenRouterClient = OpenRouterClient;
//# sourceMappingURL=openrouter-client.js.map
