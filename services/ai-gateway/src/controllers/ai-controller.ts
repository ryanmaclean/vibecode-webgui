import { Response } from 'express';
import { OpenRouterClient, ChatCompletionRequest } from '../services/openrouter-client';
import { ModelRegistry, ModelSelectionCriteria } from '../services/model-registry';
import { RedisService } from '../services/redis-service';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger, performanceLogger } from '../utils/logger';
import { ValidationError, ExternalServiceError, NotFoundError } from '../middleware/error-handler';
// import { config } from '../config/environment';
import crypto from 'crypto';

export class AIController {
    private openRouterClient: OpenRouterClient;
    private modelRegistry: ModelRegistry;
    private redisService: RedisService;

    constructor() {
        this.openRouterClient = new OpenRouterClient();
        this.modelRegistry = new ModelRegistry();
        this.redisService = new RedisService();
    }

    public async chatCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
        const startTime = Date.now();
        const userId = req.user?.id || 'anonymous';
        const requestData: ChatCompletionRequest = req.body;

        try {
            // Validate model exists
            const model = this.modelRegistry.getModel(requestData.model);
            if (!model) {
                throw new ValidationError(`Model '${requestData.model}' not found`);
            }

            // Check if model is healthy
            const isHealthy = await this.modelRegistry.isModelHealthy(requestData.model);
            if (!isHealthy) {
                logger.warn('Using unhealthy model, attempting fallback', {
                    model: requestData.model,
                    userId
                });

                const fallbackModel = this.modelRegistry.getFallbackModel(requestData.model);
                if (fallbackModel && fallbackModel !== requestData.model) {
                    requestData.model = fallbackModel;
                    logger.info('Switched to fallback model', {
                        originalModel: req.body.model,
                        fallbackModel,
                        userId
                    });
                }
            }

            // Check cache for identical requests
            let cacheKey = '';
            if (!requestData.stream) {
                cacheKey = this.generateCacheKey(requestData, userId);
                const cachedResponse = await this.redisService.getCachedResponse(cacheKey);

                if (cachedResponse) {
                    logger.info('Serving cached response', {
                        cacheKey: cacheKey.substring(0, 16) + '...',
                        userId,
                        model: requestData.model
                    });

                    res.json(cachedResponse);
                    return;
                }
            }

            // Make API request
            const response = await this.openRouterClient.chatCompletion(requestData, userId);

            // Calculate cost
            const cost = this.openRouterClient.calculateCost(
                response.model,
                response.usage.prompt_tokens,
                response.usage.completion_tokens
            );

            // Track usage
            await this.redisService.trackUsage(
                userId,
                response.model,
                response.usage.total_tokens,
                cost
            );

            // Cache response if not streaming
            if (!requestData.stream && cacheKey) {
                await this.redisService.cacheResponse(cacheKey, response);
            }

            // Log successful request
            performanceLogger.logRequest('chat_completion', startTime, {
                model: response.model,
                userId,
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
                cost: cost.toFixed(6)
            });

            res.json(response);
        } catch (error) {
            performanceLogger.logError('chat_completion', startTime, error, {
                model: requestData.model,
                userId
            });
            throw error;
        }
    }

    public async streamChatCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
        const startTime = Date.now();
        const userId = req.user?.id || 'anonymous';
        const requestData: ChatCompletionRequest = { ...req.body, stream: true };

        try {
            // Validate model exists
            const model = this.modelRegistry.getModel(requestData.model);
            if (!model) {
                throw new ValidationError(`Model '${requestData.model}' not found`);
            }

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            let totalTokens = 0;
            let fullContent = '';

            // Stream response
            await this.openRouterClient.streamChatCompletion(
                requestData,
                (chunk) => {
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);

                    // Estimate tokens and accumulate content
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                        fullContent += content;
                        totalTokens += Math.ceil(content.length / 4);
                    }
                },
                userId
            );

            // Send final done message
            res.write('data: [DONE]\n\n');
            res.end();

            // Calculate estimated cost
            const promptTokens = Math.ceil(JSON.stringify(requestData.messages).length / 4);
            const cost = this.openRouterClient.calculateCost(
                requestData.model,
                promptTokens,
                totalTokens
            );

            // Track usage
            await this.redisService.trackUsage(
                userId,
                requestData.model,
                promptTokens + totalTokens,
                cost
            );

            performanceLogger.logRequest('stream_chat_completion', startTime, {
                model: requestData.model,
                userId,
                estimatedTokens: promptTokens + totalTokens,
                estimatedCost: cost.toFixed(6)
            });
        } catch (error) {
            performanceLogger.logError('stream_chat_completion', startTime, error, {
                model: requestData.model,
                userId
            });

            if (!res.headersSent) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            } else {
                res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
                res.end();
            }
        }
    }

    public async getModels(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            let models = this.modelRegistry.getModels();

            // Apply filters
            const { provider, price_min, price_max, context_min, healthy_only } = req.query;

            if (provider) {
                models = this.modelRegistry.getModelsByProvider(provider as string);
            }

            if (price_min || price_max) {
                const min = price_min ? parseFloat(price_min as string) : 0;
                const max = price_max ? parseFloat(price_max as string) : Infinity;
                models = this.modelRegistry.getModelsByPriceRange(min, max);
            }

            if (context_min) {
                const minContext = parseInt(context_min as string);
                models = models.filter(model => model.context_length >= minContext);
            }

            if (healthy_only === 'true') {
                const healthyModels = this.modelRegistry.getHealthyModels();
                const healthyIds = new Set(healthyModels.map(m => m.id));
                models = models.filter(model => healthyIds.has(model.id));
            }

            // Add performance metrics to response
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
        } catch (error) {
            logger.error('Failed to get models', { error: error instanceof Error ? error.message : String(error) });
            throw new ExternalServiceError('Failed to retrieve models');
        }
    }

    public async getModel(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { modelId } = req.params;

        const model = this.modelRegistry.getModel(modelId);
        if (!model) {
            throw new NotFoundError(`Model '${modelId}' not found`);
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

    public async getModelRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
        const criteria: ModelSelectionCriteria = req.body;
        const limit = parseInt(req.body.limit) || 3;

        try {
            const recommendations = this.modelRegistry.getModelRecommendations(criteria, limit);

            res.json({
                recommendations,
                criteria,
                count: recommendations.length
            });
        } catch (error) {
            logger.error('Failed to get model recommendations', { error: error instanceof Error ? error.message : String(error), criteria });
            throw new ValidationError('Failed to generate model recommendations');
        }
    }

    public async getModelMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { modelId } = req.params;

        const metrics = this.openRouterClient.getPerformanceMetrics(modelId);
        if (!metrics) {
            throw new NotFoundError(`No metrics found for model '${modelId}'`);
        }

        res.json(metrics);
    }

    public async getUsageStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { start_date, end_date, user_id, model, groupby } = req.query;

        // Implementation would depend on your specific analytics requirements
        // This is a placeholder that shows the structure

        res.json({
            message: 'Usage statistics endpoint - implementation needed',
            query: { start_date, end_date, user_id, model, groupby }
        });
    }

    public async getCostAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { start_date, end_date, user_id, breakdown } = req.query;

        // Implementation would depend on your specific analytics requirements
        // This is a placeholder that shows the structure

        res.json({
            message: 'Cost analysis endpoint - implementation needed',
            query: { start_date, end_date, user_id, breakdown }
        });
    }

    public async validateCredentials(req: AuthenticatedRequest, res: Response): Promise<void> {
        // If we reach this point, authentication middleware has already validated the credentials
        res.json({
            valid: true,
            user: req.user,
            timestamp: new Date().toISOString()
        });
    }

    public async getServiceStatus(_req: AuthenticatedRequest, res: Response): Promise<void> {
        const redisStatus = this.redisService.isReady();
        const modelCount = this.modelRegistry.getModels().length;
        const lastModelUpdate = this.modelRegistry.shouldRefresh() ? null : 'recent';

        res.json({
            status: 'operational',
            services: {
                redis: redisStatus ? 'connected' : 'disconnected',
                openrouter: 'connected', // Assume connected if we can respond
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

    public async refreshModels(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            await this.modelRegistry.refreshModels();
            const modelCount = this.modelRegistry.getModels().length;

            logger.info('Models refreshed manually', {
                userId: req.user?.id,
                modelCount
            });

            res.json({
                success: true,
                message: 'Models refreshed successfully',
                modelCount,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Failed to refresh models', { error, userId: req.user?.id });
            throw new ExternalServiceError('Failed to refresh models');
        }
    }

    public async clearCache(req: AuthenticatedRequest, res: Response): Promise<void> {
        const { pattern } = req.query;

        try {
            let clearedKeys = 0;

            if (pattern) {
                const keys = await this.redisService.keys(pattern as string);
                for (const key of keys) {
                    await this.redisService.del(key);
                    clearedKeys++;
                }
            } else {
                // Clear all cache keys (be careful with this in production)
                const keys = await this.redisService.keys('cache:*');
                for (const key of keys) {
                    await this.redisService.del(key);
                    clearedKeys++;
                }
            }

            logger.info('Cache cleared', {
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
        } catch (error) {
            logger.error('Failed to clear cache', { error, userId: req.user?.id });
            throw new ExternalServiceError('Failed to clear cache');
        }
    }

    private generateCacheKey(request: ChatCompletionRequest, userId: string): string {
        // Create a cache key based on request parameters
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

        const hash = crypto.createHash('sha256')
            .update(JSON.stringify(keyData))
            .digest('hex');

        return `cache:completion:${hash}`;
    }
}
