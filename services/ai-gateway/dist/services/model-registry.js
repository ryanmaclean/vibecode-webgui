"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRegistry = void 0;
const openrouter_client_1 = require("./openrouter-client");
const redis_service_1 = require("./redis-service");
const environment_1 = require("../config/environment");
const logger_1 = require("../utils/logger");
class ModelRegistry {
    constructor() {
        this.models = [];
        this.lastUpdate = null;
        this.updateInterval = 60 * 60 * 1000;
        this.openRouterClient = new openrouter_client_1.OpenRouterClient();
        this.redisService = new redis_service_1.RedisService();
    }
    async initialize() {
        try {
            await this.refreshModels();
            logger_1.logger.info('Model registry initialized', { modelCount: this.models.length });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize model registry', { error });
            throw error;
        }
    }
    async refreshModels() {
        try {
            logger_1.logger.info('Refreshing model registry');
            this.models = await this.openRouterClient.getModels();
            this.lastUpdate = new Date();
            await this.cacheModels();
            logger_1.logger.info('Model registry refreshed', {
                modelCount: this.models.length,
                lastUpdate: this.lastUpdate
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh models', { error });
            await this.loadFromCache();
        }
    }
    getModels() {
        return this.models;
    }
    getModel(modelId) {
        return this.models.find(model => model.id === modelId);
    }
    getModelsByProvider(provider) {
        return this.models.filter(model => model.provider.toLowerCase() === provider.toLowerCase());
    }
    getModelsByPriceRange(minPrice, maxPrice) {
        return this.models.filter(model => {
            const avgPrice = (model.pricing.prompt + model.pricing.completion) / 2;
            return avgPrice >= minPrice && avgPrice <= maxPrice;
        });
    }
    getBestModelForTask(criteria) {
        const candidates = this.filterModelsByCriteria(criteria);
        if (candidates.length === 0) {
            logger_1.logger.warn('No models found matching criteria', { criteria });
            return null;
        }
        const scoredCandidates = candidates.map(model => {
            const score = this.calculateModelScore(model, criteria);
            return {
                model: model.id,
                reason: this.generateRecommendationReason(model, criteria),
                confidence: score.confidence,
                costEfficiency: score.costEfficiency,
                performanceScore: score.performanceScore
            };
        });
        scoredCandidates.sort((a, b) => {
            const scoreA = (a.performanceScore * 0.6) + (a.costEfficiency * 0.4);
            const scoreB = (b.performanceScore * 0.6) + (b.costEfficiency * 0.4);
            return scoreB - scoreA;
        });
        const best = scoredCandidates[0];
        logger_1.logger.info('Model recommendation generated', {
            recommendation: best,
            criteria,
            candidateCount: candidates.length
        });
        return best;
    }
    getModelRecommendations(criteria, limit = 3) {
        const candidates = this.filterModelsByCriteria(criteria);
        const scoredCandidates = candidates.map(model => {
            const score = this.calculateModelScore(model, criteria);
            return {
                model: model.id,
                reason: this.generateRecommendationReason(model, criteria),
                confidence: score.confidence,
                costEfficiency: score.costEfficiency,
                performanceScore: score.performanceScore
            };
        });
        scoredCandidates.sort((a, b) => {
            const scoreA = (a.performanceScore * 0.6) + (a.costEfficiency * 0.4);
            const scoreB = (b.performanceScore * 0.6) + (b.costEfficiency * 0.4);
            return scoreB - scoreA;
        });
        return scoredCandidates.slice(0, limit);
    }
    getHealthyModels() {
        const performanceMetrics = this.openRouterClient.getAllPerformanceMetrics();
        const healthyModelIds = performanceMetrics
            .filter(metric => metric.successRate >= 0.95 && metric.averageLatency < 30000)
            .map(metric => metric.model);
        return this.models.filter(model => healthyModelIds.includes(model.id));
    }
    async isModelHealthy(modelId) {
        const metrics = this.openRouterClient.getPerformanceMetrics(modelId);
        if (!metrics) {
            return true;
        }
        return metrics.successRate >= 0.95 && metrics.averageLatency < 30000;
    }
    getFallbackModel(originalModel) {
        const model = this.getModel(originalModel);
        if (!model) {
            return environment_1.config.models.defaultModel;
        }
        const sameProviderModels = this.getModelsByProvider(model.provider)
            .filter(m => m.id !== originalModel)
            .sort((a, b) => a.pricing.prompt - b.pricing.prompt);
        if (sameProviderModels.length > 0) {
            return sameProviderModels[0].id;
        }
        for (const fallbackModel of environment_1.config.models.fallbackModels) {
            if (this.getModel(fallbackModel)) {
                return fallbackModel;
            }
        }
        return environment_1.config.models.defaultModel;
    }
    filterModelsByCriteria(criteria) {
        return this.models.filter(model => {
            if (criteria.maxCost) {
                const avgCost = (model.pricing.prompt + model.pricing.completion) / 2;
                if (avgCost > criteria.maxCost)
                    return false;
            }
            if (criteria.preferredProviders && criteria.preferredProviders.length > 0) {
                if (!criteria.preferredProviders.some(provider => model.provider.toLowerCase().includes(provider.toLowerCase()))) {
                    return false;
                }
            }
            if (criteria.excludeModels && criteria.excludeModels.includes(model.id)) {
                return false;
            }
            if (criteria.minPerformance) {
                const metrics = this.openRouterClient.getPerformanceMetrics(model.id);
                if (metrics && metrics.successRate < criteria.minPerformance) {
                    return false;
                }
            }
            return true;
        });
    }
    calculateModelScore(model, criteria) {
        const metrics = this.openRouterClient.getPerformanceMetrics(model.id);
        let performanceScore = 0.8;
        if (metrics) {
            const successScore = metrics.successRate;
            const latencyScore = Math.max(0, 1 - (metrics.averageLatency / 30000));
            performanceScore = (successScore * 0.7) + (latencyScore * 0.3);
        }
        const avgCost = (model.pricing.prompt + model.pricing.completion) / 2;
        const maxCost = Math.max(...this.models.map(m => (m.pricing.prompt + m.pricing.completion) / 2));
        const costEfficiency = 1 - (avgCost / maxCost);
        let confidence = 0.5;
        if (model.context_length >= 128000)
            confidence += 0.3;
        else if (model.context_length >= 32000)
            confidence += 0.2;
        else if (model.context_length >= 8000)
            confidence += 0.1;
        switch (criteria.task) {
            case 'code':
                if (model.name.toLowerCase().includes('code') ||
                    model.id.includes('code') ||
                    model.provider === 'anthropic') {
                    confidence += 0.2;
                }
                break;
            case 'creative':
                if (model.provider === 'openai' || model.provider === 'anthropic') {
                    confidence += 0.15;
                }
                break;
            case 'analysis':
                if (model.provider === 'anthropic' || model.context_length > 32000) {
                    confidence += 0.15;
                }
                break;
        }
        confidence = Math.min(1, Math.max(0, confidence));
        return {
            confidence,
            costEfficiency,
            performanceScore
        };
    }
    generateRecommendationReason(model, criteria) {
        const reasons = [];
        const avgCost = (model.pricing.prompt + model.pricing.completion) / 2;
        const metrics = this.openRouterClient.getPerformanceMetrics(model.id);
        if (avgCost < 0.001) {
            reasons.push('Very cost-effective');
        }
        else if (avgCost < 0.01) {
            reasons.push('Cost-effective');
        }
        if (metrics) {
            if (metrics.successRate >= 0.99) {
                reasons.push('Excellent reliability');
            }
            else if (metrics.successRate >= 0.95) {
                reasons.push('High reliability');
            }
            if (metrics.averageLatency < 5000) {
                reasons.push('Fast response times');
            }
        }
        if (model.context_length >= 128000) {
            reasons.push('Very large context window');
        }
        else if (model.context_length >= 32000) {
            reasons.push('Large context window');
        }
        switch (criteria.task) {
            case 'code':
                if (model.name.toLowerCase().includes('code') || model.id.includes('code')) {
                    reasons.push('Optimized for code generation');
                }
                break;
            case 'creative':
                if (model.provider === 'openai') {
                    reasons.push('Excellent for creative tasks');
                }
                break;
            case 'analysis':
                if (model.provider === 'anthropic') {
                    reasons.push('Strong analytical capabilities');
                }
                break;
        }
        switch (model.provider) {
            case 'anthropic':
                reasons.push('High-quality outputs');
                break;
            case 'openai':
                reasons.push('Well-tested and reliable');
                break;
            case 'google':
                reasons.push('Advanced multimodal capabilities');
                break;
        }
        return reasons.length > 0 ? reasons.join(', ') : 'Good general-purpose model';
    }
    async cacheModels() {
        try {
            const cacheKey = 'models:registry';
            const cacheData = {
                models: this.models,
                lastUpdate: this.lastUpdate,
                version: '1.0.0'
            };
            await this.redisService.set(cacheKey, JSON.stringify(cacheData), this.updateInterval / 1000);
            logger_1.logger.debug('Models cached in Redis', { modelCount: this.models.length });
        }
        catch (error) {
            logger_1.logger.error('Failed to cache models', { error });
        }
    }
    async loadFromCache() {
        try {
            const cacheKey = 'models:registry';
            const cached = await this.redisService.get(cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                this.models = cacheData.models || [];
                this.lastUpdate = cacheData.lastUpdate ? new Date(cacheData.lastUpdate) : null;
                logger_1.logger.info('Models loaded from cache', {
                    modelCount: this.models.length,
                    lastUpdate: this.lastUpdate
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load models from cache', { error });
        }
    }
    shouldRefresh() {
        if (!this.lastUpdate)
            return true;
        return Date.now() - this.lastUpdate.getTime() > this.updateInterval;
    }
}
exports.ModelRegistry = ModelRegistry;
//# sourceMappingURL=model-registry.js.map