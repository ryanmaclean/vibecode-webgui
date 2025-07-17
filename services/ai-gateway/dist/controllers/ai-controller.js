"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIController = void 0;
const openrouter_client_1 = require("../services/openrouter-client");
const model_registry_1 = require("../services/model-registry");
const redis_service_1 = require("../services/redis-service");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../middleware/error-handler");
const crypto_1 = __importDefault(require("crypto"));
class AIController {
    constructor() {
        this.openRouterClient = new openrouter_client_1.OpenRouterClient();
        this.modelRegistry = new model_registry_1.ModelRegistry();
        this.redisService = new redis_service_1.RedisService();
    }
    async chatCompletion(req, res) {
        const startTime = Date.now();
        const userId = req.user?.id || 'anonymous';
        const requestData = req.body;
        try {
            const model = this.modelRegistry.getModel(requestData.model);
            if (!model) {
                throw new error_handler_1.ValidationError(`Model '${requestData.model}' not found`);
            }
            const isHealthy = await this.modelRegistry.isModelHealthy(requestData.model);
            if (!isHealthy) {
                logger_1.logger.warn('Using unhealthy model, attempting fallback', {
                    model: requestData.model,
                    userId
                });
                const fallbackModel = this.modelRegistry.getFallbackModel(requestData.model);
                if (fallbackModel && fallbackModel !== requestData.model) {
                    requestData.model = fallbackModel;
                    logger_1.logger.info('Switched to fallback model', {
                        originalModel: req.body.model,
                        fallbackModel,
                        userId
                    });
                }
            }
            let cacheKey = '';
            if (!requestData.stream) {
                cacheKey = this.generateCacheKey(requestData, userId);
                const cachedResponse = await this.redisService.getCachedResponse(cacheKey);
                if (cachedResponse) {
                    logger_1.logger.info('Serving cached response', {
                        cacheKey: cacheKey.substring(0, 16) + '...',
                        userId,
                        model: requestData.model
                    });
                    res.json(cachedResponse);
                    return;
                }
            }
            const response = await this.openRouterClient.chatCompletion(requestData, userId);
            const cost = this.openRouterClient.calculateCost(response.model, response.usage.prompt_tokens, response.usage.completion_tokens);
            await this.redisService.trackUsage(userId, response.model, response.usage.total_tokens, cost);
            if (!requestData.stream && cacheKey) {
                await this.redisService.cacheResponse(cacheKey, response);
            }
            logger_1.performanceLogger.logRequest('chat_completion', startTime, {
                model: response.model,
                userId,
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
                cost: cost.toFixed(6)
            });
            res.json(response);
        }
        catch (error) {
            logger_1.performanceLogger.logError('chat_completion', startTime, error, {
                model: requestData.model,
                userId
            });
            throw error;
        }
    }
    async streamChatCompletion(req, res) {
        const startTime = Date.now();
        const userId = req.user?.id || 'anonymous';
        const requestData = { ...req.body, stream: true };
        try {
            const model = this.modelRegistry.getModel(requestData.model);
            if (!model) {
                throw new error_handler_1.ValidationError(`Model '${requestData.model}' not found`);
            }
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });
            let totalTokens = 0;
            let fullContent = '';
            await this.openRouterClient.streamChatCompletion(requestData, (chunk) => {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    fullContent += content;
                    totalTokens += Math.ceil(content.length / 4);
                }
            }, userId);
            res.write('data: [DONE]\n\n');
            res.end();
            const promptTokens = Math.ceil(JSON.stringify(requestData.messages).length / 4);
            const cost = this.openRouterClient.calculateCost(requestData.model, promptTokens, totalTokens);
            await this.redisService.trackUsage(userId, requestData.model, promptTokens + totalTokens, cost);
            logger_1.performanceLogger.logRequest('stream_chat_completion', startTime, {
                model: requestData.model,
                userId,
                estimatedTokens: promptTokens + totalTokens,
                estimatedCost: cost.toFixed(6)
            });
        }
        catch (error) {
            logger_1.performanceLogger.logError('stream_chat_completion', startTime, error, {
                model: requestData.model,
                userId
            });
            if (!res.headersSent) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
            else {
                res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
                res.end();
            }
        }
    }
    async getModels(req, res) {
        try {
            let models = this.modelRegistry.getModels();
            const { provider, price_min, price_max, context_min, healthy_only } = req.query;
            if (provider) {
                models = this.modelRegistry.getModelsByProvider(provider);
            }
            if (price_min || price_max) {
                const min = price_min ? parseFloat(price_min) : 0;
                const max = price_max ? parseFloat(price_max) : Infinity;
                models = this.modelRegistry.getModelsByPriceRange(min, max);
            }
            if (context_min) {
                const minContext = parseInt(context_min);
                models = models.filter(model => model.context_length >= minContext);
            }
            if (healthy_only === 'true') {
                const healthyModels = this.modelRegistry.getHealthyModels();
                const healthyIds = new Set(healthyModels.map(m => m.id));
                models = models.filter(model => healthyIds.has(model.id));
            }
            const modelsWithMetrics = models.map(model => {
                const metrics = this.openRouterClient.getPerformanceMetrics(model.id);
                return {
                    ...model,
                    performance: metrics ? {
                        averageLatency: metrics.averageLatency,
                        successRate: metrics.successRate,
                        totalRequests: metrics.totalRequests,
                        lastUpdated: metrics.lastUpdated
                    } : null
                };
            });
            res.json({
                models: modelsWithMetrics,
                count: modelsWithMetrics.length,
                filters: { provider, price_min, price_max, context_min, healthy_only }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get models', { error: error instanceof Error ? error.message : String(error) });
            throw new error_handler_1.ExternalServiceError('Failed to retrieve models');
        }
    }
    async getModel(req, res) {
        const { modelId } = req.params;
        const model = this.modelRegistry.getModel(modelId);
        if (!model) {
            throw new error_handler_1.NotFoundError(`Model '${modelId}' not found`);
        }
        const metrics = this.openRouterClient.getPerformanceMetrics(modelId);
        res.json({
            ...model,
            performance: metrics ? {
                averageLatency: metrics.averageLatency,
                successRate: metrics.successRate,
                errorRate: metrics.errorRate,
                totalRequests: metrics.totalRequests,
                lastUpdated: metrics.lastUpdated
            } : null,
            isHealthy: await this.modelRegistry.isModelHealthy(modelId)
        });
    }
    async getModelRecommendations(req, res) {
        const criteria = req.body;
        const limit = parseInt(req.body.limit) || 3;
        try {
            const recommendations = this.modelRegistry.getModelRecommendations(criteria, limit);
            res.json({
                recommendations,
                criteria,
                count: recommendations.length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get model recommendations', { error: error instanceof Error ? error.message : String(error), criteria });
            throw new error_handler_1.ValidationError('Failed to generate model recommendations');
        }
    }
    async getModelMetrics(req, res) {
        const { modelId } = req.params;
        const metrics = this.openRouterClient.getPerformanceMetrics(modelId);
        if (!metrics) {
            throw new error_handler_1.NotFoundError(`No metrics found for model '${modelId}'`);
        }
        res.json(metrics);
    }
    async getUsageStatistics(req, res) {
        const { start_date, end_date, user_id, model, groupby } = req.query;
        res.json({
            message: 'Usage statistics endpoint - implementation needed',
            query: { start_date, end_date, user_id, model, groupby }
        });
    }
    async getCostAnalysis(req, res) {
        const { start_date, end_date, user_id, breakdown } = req.query;
        res.json({
            message: 'Cost analysis endpoint - implementation needed',
            query: { start_date, end_date, user_id, breakdown }
        });
    }
    async validateCredentials(req, res) {
        res.json({
            valid: true,
            user: req.user,
            timestamp: new Date().toISOString()
        });
    }
    async getServiceStatus(_req, res) {
        const redisStatus = this.redisService.isReady();
        const modelCount = this.modelRegistry.getModels().length;
        const lastModelUpdate = this.modelRegistry.shouldRefresh() ? null : 'recent';
        res.json({
            status: 'operational',
            services: {
                redis: redisStatus ? 'connected' : 'disconnected',
                openrouter: 'connected',
                modelRegistry: modelCount > 0 ? 'loaded' : 'empty'
            },
            metrics: {
                modelCount,
                lastModelUpdate,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version
            },
            timestamp: new Date().toISOString()
        });
    }
    async refreshModels(req, res) {
        try {
            await this.modelRegistry.refreshModels();
            const modelCount = this.modelRegistry.getModels().length;
            logger_1.logger.info('Models refreshed manually', {
                userId: req.user?.id,
                modelCount
            });
            res.json({
                success: true,
                message: 'Models refreshed successfully',
                modelCount,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh models', { error, userId: req.user?.id });
            throw new error_handler_1.ExternalServiceError('Failed to refresh models');
        }
    }
    async clearCache(req, res) {
        const { pattern } = req.query;
        try {
            let clearedKeys = 0;
            if (pattern) {
                const keys = await this.redisService.keys(pattern);
                for (const key of keys) {
                    await this.redisService.del(key);
                    clearedKeys++;
                }
            }
            else {
                const keys = await this.redisService.keys('cache:*');
                for (const key of keys) {
                    await this.redisService.del(key);
                    clearedKeys++;
                }
            }
            logger_1.logger.info('Cache cleared', {
                userId: req.user?.id,
                pattern: pattern || 'all',
                clearedKeys
            });
            res.json({
                success: true,
                message: 'Cache cleared successfully',
                clearedKeys,
                pattern: pattern || 'all',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to clear cache', { error, userId: req.user?.id });
            throw new error_handler_1.ExternalServiceError('Failed to clear cache');
        }
    }
    generateCacheKey(request, userId) {
        const keyData = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            top_p: request.top_p,
            frequency_penalty: request.frequency_penalty,
            presence_penalty: request.presence_penalty,
            stop: request.stop,
            userId: userId
        };
        const hash = crypto_1.default.createHash('sha256')
            .update(JSON.stringify(keyData))
            .digest('hex');
        return `cache:completion:${hash}`;
    }
}
exports.AIController = AIController;
//# sourceMappingURL=ai-controller.js.map
