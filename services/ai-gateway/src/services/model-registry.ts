import { OpenRouterClient, AIModel } from './openrouter-client';
import { RedisService } from './redis-service';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface ModelRecommendation {
    model: string;
    reason: string;
    confidence: number;
    costEfficiency: number;
    performanceScore: number;
}

export interface ModelSelectionCriteria {
    task: 'chat' | 'code' | 'analysis' | 'creative' | 'general';
    maxCost?: number;
    minPerformance?: number;
    preferredProviders?: string[];
    excludeModels?: string[];
    requireFeatures?: string[];
}

export class ModelRegistry {
    private openRouterClient: OpenRouterClient;
    private redisService: RedisService;
    private models: AIModel[] = [];
    private lastUpdate: Date | null = null;
    private updateInterval: number = 60 * 60 * 1000; // 1 hour

    constructor() {
        this.openRouterClient = new OpenRouterClient();
        this.redisService = new RedisService();
    }

    public async initialize(): Promise<void> {
        try {
            await this.refreshModels();
            logger.info('Model registry initialized', { modelCount: this.models.length });
        } catch (error) {
            logger.error('Failed to initialize model registry', { error });
            throw error;
        }
    }

    public async refreshModels(): Promise<void> {
        try {
            logger.info('Refreshing model registry');
            this.models = await this.openRouterClient.getModels();
            this.lastUpdate = new Date();
            
            // Cache models in Redis
            await this.cacheModels();
            
            logger.info('Model registry refreshed', { 
                modelCount: this.models.length,
                lastUpdate: this.lastUpdate
            });
        } catch (error) {
            logger.error('Failed to refresh models', { error });
            
            // Try to load from cache if refresh fails
            await this.loadFromCache();
        }
    }

    public getModels(): AIModel[] {
        return this.models;
    }

    public getModel(modelId: string): AIModel | undefined {
        return this.models.find(model => model.id === modelId);
    }

    public getModelsByProvider(provider: string): AIModel[] {
        return this.models.filter(model => model.provider.toLowerCase() === provider.toLowerCase());
    }

    public getModelsByPriceRange(minPrice: number, maxPrice: number): AIModel[] {
        return this.models.filter(model => {
            const avgPrice = (model.pricing.prompt + model.pricing.completion) / 2;
            return avgPrice >= minPrice && avgPrice <= maxPrice;
        });
    }

    public getBestModelForTask(criteria: ModelSelectionCriteria): ModelRecommendation | null {
        const candidates = this.filterModelsByCriteria(criteria);
        
        if (candidates.length === 0) {
            logger.warn('No models found matching criteria', { criteria });
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

        // Sort by overall score (combination of performance and cost efficiency)
        scoredCandidates.sort((a, b) => {
            const scoreA = (a.performanceScore * 0.6) + (a.costEfficiency * 0.4);
            const scoreB = (b.performanceScore * 0.6) + (b.costEfficiency * 0.4);
            return scoreB - scoreA;
        });

        const best = scoredCandidates[0];
        logger.info('Model recommendation generated', { 
            recommendation: best,
            criteria,
            candidateCount: candidates.length
        });

        return best;
    }

    public getModelRecommendations(criteria: ModelSelectionCriteria, limit: number = 3): ModelRecommendation[] {
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

        // Sort by overall score
        scoredCandidates.sort((a, b) => {
            const scoreA = (a.performanceScore * 0.6) + (a.costEfficiency * 0.4);
            const scoreB = (b.performanceScore * 0.6) + (b.costEfficiency * 0.4);
            return scoreB - scoreA;
        });

        return scoredCandidates.slice(0, limit);
    }

    public getHealthyModels(): AIModel[] {
        const performanceMetrics = this.openRouterClient.getAllPerformanceMetrics();
        const healthyModelIds = performanceMetrics
            .filter(metric => metric.successRate >= 0.95 && metric.averageLatency < 30000)
            .map(metric => metric.model);

        return this.models.filter(model => healthyModelIds.includes(model.id));
    }

    public async isModelHealthy(modelId: string): Promise<boolean> {
        const metrics = this.openRouterClient.getPerformanceMetrics(modelId);
        
        if (!metrics) {
            // If no metrics, assume healthy (model hasn't been used yet)
            return true;
        }

        // Consider a model healthy if success rate > 95% and average latency < 30s
        return metrics.successRate >= 0.95 && metrics.averageLatency < 30000;
    }

    public getFallbackModel(originalModel: string): string | null {
        const model = this.getModel(originalModel);
        if (!model) {
            return config.models.defaultModel;
        }

        // Try to find a similar model from the same provider
        const sameProviderModels = this.getModelsByProvider(model.provider)
            .filter(m => m.id !== originalModel)
            .sort((a, b) => a.pricing.prompt - b.pricing.prompt); // Sort by cost

        if (sameProviderModels.length > 0) {
            return sameProviderModels[0].id;
        }

        // Fallback to configured fallback models
        for (const fallbackModel of config.models.fallbackModels) {
            if (this.getModel(fallbackModel)) {
                return fallbackModel;
            }
        }

        return config.models.defaultModel;
    }

    private filterModelsByCriteria(criteria: ModelSelectionCriteria): AIModel[] {
        return this.models.filter(model => {
            // Filter by cost
            if (criteria.maxCost) {
                const avgCost = (model.pricing.prompt + model.pricing.completion) / 2;
                if (avgCost > criteria.maxCost) return false;
            }

            // Filter by preferred providers
            if (criteria.preferredProviders && criteria.preferredProviders.length > 0) {
                if (!criteria.preferredProviders.some(provider => 
                    model.provider.toLowerCase().includes(provider.toLowerCase())
                )) {
                    return false;
                }
            }

            // Filter by excluded models
            if (criteria.excludeModels && criteria.excludeModels.includes(model.id)) {
                return false;
            }

            // Filter by minimum performance
            if (criteria.minPerformance) {
                const metrics = this.openRouterClient.getPerformanceMetrics(model.id);
                if (metrics && metrics.successRate < criteria.minPerformance) {
                    return false;
                }
            }

            return true;
        });
    }

    private calculateModelScore(model: AIModel, criteria: ModelSelectionCriteria): {
        confidence: number;
        costEfficiency: number;
        performanceScore: number;
    } {
        const metrics = this.openRouterClient.getPerformanceMetrics(model.id);
        
        // Performance score based on success rate and latency
        let performanceScore = 0.8; // Default score for models without metrics
        if (metrics) {
            const successScore = metrics.successRate;
            const latencyScore = Math.max(0, 1 - (metrics.averageLatency / 30000)); // Normalize latency (30s max)
            performanceScore = (successScore * 0.7) + (latencyScore * 0.3);
        }

        // Cost efficiency score (lower cost = higher score)
        const avgCost = (model.pricing.prompt + model.pricing.completion) / 2;
        const maxCost = Math.max(...this.models.map(m => (m.pricing.prompt + m.pricing.completion) / 2));
        const costEfficiency = 1 - (avgCost / maxCost);

        // Confidence based on context length and features
        let confidence = 0.5;
        
        // Boost confidence for larger context windows
        if (model.context_length >= 128000) confidence += 0.3;
        else if (model.context_length >= 32000) confidence += 0.2;
        else if (model.context_length >= 8000) confidence += 0.1;

        // Task-specific scoring
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

        // Ensure scores are between 0 and 1
        confidence = Math.min(1, Math.max(0, confidence));
        
        return {
            confidence,
            costEfficiency,
            performanceScore
        };
    }

    private generateRecommendationReason(model: AIModel, criteria: ModelSelectionCriteria): string {
        const reasons: string[] = [];
        
        const avgCost = (model.pricing.prompt + model.pricing.completion) / 2;
        const metrics = this.openRouterClient.getPerformanceMetrics(model.id);

        // Cost-related reasons
        if (avgCost < 0.001) {
            reasons.push('Very cost-effective');
        } else if (avgCost < 0.01) {
            reasons.push('Cost-effective');
        }

        // Performance-related reasons
        if (metrics) {
            if (metrics.successRate >= 0.99) {
                reasons.push('Excellent reliability');
            } else if (metrics.successRate >= 0.95) {
                reasons.push('High reliability');
            }

            if (metrics.averageLatency < 5000) {
                reasons.push('Fast response times');
            }
        }

        // Context length
        if (model.context_length >= 128000) {
            reasons.push('Very large context window');
        } else if (model.context_length >= 32000) {
            reasons.push('Large context window');
        }

        // Task-specific reasons
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

        // Provider-specific reasons
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

    private async cacheModels(): Promise<void> {
        try {
            const cacheKey = 'models:registry';
            const cacheData = {
                models: this.models,
                lastUpdate: this.lastUpdate,
                version: '1.0.0'
            };
            
            await this.redisService.set(
                cacheKey, 
                JSON.stringify(cacheData), 
                this.updateInterval / 1000
            );
            
            logger.debug('Models cached in Redis', { modelCount: this.models.length });
        } catch (error) {
            logger.error('Failed to cache models', { error });
        }
    }

    private async loadFromCache(): Promise<void> {
        try {
            const cacheKey = 'models:registry';
            const cached = await this.redisService.get(cacheKey);
            
            if (cached) {
                const cacheData = JSON.parse(cached);
                this.models = cacheData.models || [];
                this.lastUpdate = cacheData.lastUpdate ? new Date(cacheData.lastUpdate) : null;
                
                logger.info('Models loaded from cache', { 
                    modelCount: this.models.length,
                    lastUpdate: this.lastUpdate
                });
            }
        } catch (error) {
            logger.error('Failed to load models from cache', { error });
        }
    }

    public shouldRefresh(): boolean {
        if (!this.lastUpdate) return true;
        return Date.now() - this.lastUpdate.getTime() > this.updateInterval;
    }
}