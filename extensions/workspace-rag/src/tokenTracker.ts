/**
 * Token Usage Tracker
 * 
 * Tracks token usage and costs across all LLM providers to prevent
 * unexpected bills and provide visibility into AI spending.
 * 
 * Addresses Nov 2025 developer complaints about:
 * - Unpredictable AI costs
 * - Token limits being exhausted
 * - No visibility into spending
 */

import * as vscode from 'vscode';
import { logger } from './logger';

export interface TokenUsage {
    provider: string;
    model: string;
    operation: 'embedding' | 'completion' | 'chat';
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    timestamp: Date;
    userId?: string;
    workspaceId?: string;
}

export interface CostEstimate {
    provider: string;
    model: string;
    promptCost: number;
    completionCost: number;
    totalCost: number;
    currency: string;
}

export interface UsageSummary {
    period: 'hour' | 'day' | 'week' | 'month';
    totalTokens: number;
    totalCost: number;
    byProvider: Map<string, ProviderUsage>;
    byModel: Map<string, ModelUsage>;
    topQueries: QueryUsage[];
}

export interface ProviderUsage {
    provider: string;
    tokens: number;
    cost: number;
    requestCount: number;
}

export interface ModelUsage {
    model: string;
    tokens: number;
    cost: number;
    requestCount: number;
    avgTokensPerRequest: number;
}

export interface QueryUsage {
    query: string;
    tokens: number;
    cost: number;
    timestamp: Date;
}

export interface Budget {
    period: 'daily' | 'weekly' | 'monthly';
    limit: number;
    current: number;
    remaining: number;
    percentUsed: number;
    alertThreshold: number; // Percentage (e.g., 80 = alert at 80%)
}

/**
 * Pricing information for different providers and models
 * Updated as of November 2025
 */
const PRICING: Record<string, ModelPricing> = {
    // OpenAI
    'gpt-4-turbo-preview': {
        provider: 'openai',
        promptCostPer1k: 0.01,
        completionCostPer1k: 0.03
    },
    'gpt-4': {
        provider: 'openai',
        promptCostPer1k: 0.03,
        completionCostPer1k: 0.06
    },
    'gpt-3.5-turbo': {
        provider: 'openai',
        promptCostPer1k: 0.0005,
        completionCostPer1k: 0.0015
    },
    'text-embedding-3-small': {
        provider: 'openai',
        promptCostPer1k: 0.00002,
        completionCostPer1k: 0
    },
    'text-embedding-3-large': {
        provider: 'openai',
        promptCostPer1k: 0.00013,
        completionCostPer1k: 0
    },

    // Anthropic
    'claude-3-5-sonnet-20241022': {
        provider: 'anthropic',
        promptCostPer1k: 0.003,
        completionCostPer1k: 0.015
    },
    'claude-3-opus': {
        provider: 'anthropic',
        promptCostPer1k: 0.015,
        completionCostPer1k: 0.075
    },
    'claude-3-sonnet': {
        provider: 'anthropic',
        promptCostPer1k: 0.003,
        completionCostPer1k: 0.015
    },
    'claude-3-haiku': {
        provider: 'anthropic',
        promptCostPer1k: 0.00025,
        completionCostPer1k: 0.00125
    },

    // Google
    'gemini-1.5-pro-latest': {
        provider: 'google',
        promptCostPer1k: 0.00125,
        completionCostPer1k: 0.005
    },
    'gemini-1.5-flash': {
        provider: 'google',
        promptCostPer1k: 0.000075,
        completionCostPer1k: 0.0003
    },

    // OpenRouter (varies by model, these are examples)
    'anthropic/claude-3.5-sonnet': {
        provider: 'openrouter',
        promptCostPer1k: 0.003,
        completionCostPer1k: 0.015
    }
};

interface ModelPricing {
    provider: string;
    promptCostPer1k: number;
    completionCostPer1k: number;
}

/**
 * Token Usage Tracker Service
 */
export class TokenTracker {
    private usageHistory: TokenUsage[] = [];
    private budgets: Map<string, Budget> = new Map();
    private storageKey = 'workspaceRag.tokenUsage';
    private budgetKey = 'workspaceRag.budgets';

    constructor(private context: vscode.ExtensionContext) {
        this.loadHistory();
        this.loadBudgets();
        this.startPeriodicCleanup();
    }

    /**
     * Track token usage for a request
     */
    async trackUsage(usage: Omit<TokenUsage, 'timestamp' | 'estimatedCost'>): Promise<TokenUsage> {
        const cost = this.calculateCost(usage.model, usage.promptTokens, usage.completionTokens);

        const fullUsage: TokenUsage = {
            ...usage,
            timestamp: new Date(),
            estimatedCost: cost.totalCost
        };

        this.usageHistory.push(fullUsage);
        await this.saveHistory();

        // Update budgets
        await this.updateBudgets(fullUsage);

        // Check for budget alerts
        await this.checkBudgetAlerts();

        // Send metrics to Datadog
        this.sendToDatadog(fullUsage, cost);

        logger.info('Token usage tracked', {
            provider: usage.provider,
            model: usage.model,
            tokens: usage.totalTokens,
            cost: cost.totalCost
        });

        return fullUsage;
    }

    /**
     * Send token usage metrics to Datadog
     */
    private sendToDatadog(usage: TokenUsage, cost: CostEstimate): void {
        try {
            // Try to use dd-trace if available
            const tracer = require('dd-trace');

            // Send custom metrics
            if (tracer.dogstatsd) {
                const tags = [
                    `provider:${usage.provider}`,
                    `model:${usage.model}`,
                    `operation:${usage.operation}`,
                    `workspace:${usage.workspaceId || 'unknown'}`
                ];

                // Token metrics
                tracer.dogstatsd.gauge('vibecode.ai.tokens.prompt', usage.promptTokens, tags);
                tracer.dogstatsd.gauge('vibecode.ai.tokens.completion', usage.completionTokens, tags);
                tracer.dogstatsd.gauge('vibecode.ai.tokens.total', usage.totalTokens, tags);

                // Cost metrics
                tracer.dogstatsd.gauge('vibecode.ai.cost.prompt_usd', cost.promptCost, tags);
                tracer.dogstatsd.gauge('vibecode.ai.cost.completion_usd', cost.completionCost, tags);
                tracer.dogstatsd.gauge('vibecode.ai.cost.total_usd', cost.totalCost, tags);

                // Increment request counter
                tracer.dogstatsd.increment('vibecode.ai.requests', 1, tags);

                logger.debug('Sent metrics to Datadog', { provider: usage.provider, model: usage.model });
            }
        } catch (error) {
            // Datadog integration is optional - don't fail if not available
            logger.debug('Datadog metrics not available (optional)', error);
        }
    }

    /**
     * Calculate cost for a request
     */
    calculateCost(model: string, promptTokens: number, completionTokens: number): CostEstimate {
        const pricing = PRICING[model];

        if (!pricing) {
            logger.warn(`No pricing information for model: ${model}`);
            return {
                provider: 'unknown',
                model,
                promptCost: 0,
                completionCost: 0,
                totalCost: 0,
                currency: 'USD'
            };
        }

        const promptCost = (promptTokens / 1000) * pricing.promptCostPer1k;
        const completionCost = (completionTokens / 1000) * pricing.completionCostPer1k;

        return {
            provider: pricing.provider,
            model,
            promptCost,
            completionCost,
            totalCost: promptCost + completionCost,
            currency: 'USD'
        };
    }

    /**
     * Estimate cost before making a request
     */
    estimateCost(model: string, estimatedPromptTokens: number, estimatedCompletionTokens: number = 0): CostEstimate {
        return this.calculateCost(model, estimatedPromptTokens, estimatedCompletionTokens);
    }

    /**
     * Get usage summary for a time period
     */
    getUsageSummary(period: UsageSummary['period']): UsageSummary {
        const now = new Date();
        const startTime = this.getStartTime(now, period);

        const relevantUsage = this.usageHistory.filter(u => u.timestamp >= startTime);

        const byProvider = new Map<string, ProviderUsage>();
        const byModel = new Map<string, ModelUsage>();
        let totalTokens = 0;
        let totalCost = 0;

        for (const usage of relevantUsage) {
            totalTokens += usage.totalTokens;
            totalCost += usage.estimatedCost;

            // By provider
            const providerUsage = byProvider.get(usage.provider) || {
                provider: usage.provider,
                tokens: 0,
                cost: 0,
                requestCount: 0
            };
            providerUsage.tokens += usage.totalTokens;
            providerUsage.cost += usage.estimatedCost;
            providerUsage.requestCount++;
            byProvider.set(usage.provider, providerUsage);

            // By model
            const modelUsage = byModel.get(usage.model) || {
                model: usage.model,
                tokens: 0,
                cost: 0,
                requestCount: 0,
                avgTokensPerRequest: 0
            };
            modelUsage.tokens += usage.totalTokens;
            modelUsage.cost += usage.estimatedCost;
            modelUsage.requestCount++;
            modelUsage.avgTokensPerRequest = modelUsage.tokens / modelUsage.requestCount;
            byModel.set(usage.model, modelUsage);
        }

        // Top 10 most expensive queries
        const topQueries = relevantUsage
            .sort((a, b) => b.estimatedCost - a.estimatedCost)
            .slice(0, 10)
            .map(u => ({
                query: `${u.operation} with ${u.model}`,
                tokens: u.totalTokens,
                cost: u.estimatedCost,
                timestamp: u.timestamp
            }));

        return {
            period,
            totalTokens,
            totalCost,
            byProvider,
            byModel,
            topQueries
        };
    }

    /**
     * Set budget for a period
     */
    async setBudget(period: Budget['period'], limit: number, alertThreshold: number = 80): Promise<void> {
        const budget: Budget = {
            period,
            limit,
            current: 0,
            remaining: limit,
            percentUsed: 0,
            alertThreshold
        };

        this.budgets.set(period, budget);
        await this.saveBudgets();
        await this.updateBudgets();
    }

    /**
     * Get current budget status
     */
    getBudget(period: Budget['period']): Budget | undefined {
        return this.budgets.get(period);
    }

    /**
     * Get all budgets
     */
    getAllBudgets(): Budget[] {
        return Array.from(this.budgets.values());
    }

    /**
     * Check if request would exceed budget
     */
    wouldExceedBudget(estimatedCost: number, period: Budget['period'] = 'daily'): boolean {
        const budget = this.budgets.get(period);
        if (!budget) return false;

        return (budget.current + estimatedCost) > budget.limit;
    }

    /**
     * Get cost comparison between providers for same task
     */
    compareProviderCosts(promptTokens: number, completionTokens: number): ProviderComparison[] {
        const comparisons: ProviderComparison[] = [];

        const models = [
            'gpt-4-turbo-preview',
            'gpt-3.5-turbo',
            'claude-3-5-sonnet-20241022',
            'claude-3-haiku',
            'gemini-1.5-pro-latest',
            'gemini-1.5-flash'
        ];

        for (const model of models) {
            const cost = this.calculateCost(model, promptTokens, completionTokens);
            comparisons.push({
                provider: cost.provider,
                model,
                cost: cost.totalCost,
                savingsVsCheapest: 0 // Will be calculated below
            });
        }

        // Sort by cost
        comparisons.sort((a, b) => a.cost - b.cost);

        // Calculate savings
        const cheapest = comparisons[0].cost;
        for (const comparison of comparisons) {
            comparison.savingsVsCheapest = comparison.cost - cheapest;
        }

        return comparisons;
    }

    /**
     * Get optimization suggestions
     */
    getOptimizationSuggestions(): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];
        const summary = this.getUsageSummary('week');

        // Check if using expensive models for simple tasks
        const expensiveModels = ['gpt-4', 'gpt-4-turbo-preview', 'claude-3-opus'];
        for (const [model, usage] of summary.byModel) {
            if (expensiveModels.includes(model) && usage.avgTokensPerRequest < 500) {
                suggestions.push({
                    type: 'model-downgrade',
                    severity: 'medium',
                    message: `Consider using a cheaper model for simple queries`,
                    details: `${model} is being used for queries averaging ${usage.avgTokensPerRequest} tokens. ` +
                        `Switching to gpt-3.5-turbo or claude-3-haiku could save ~80% on costs.`,
                    potentialSavings: usage.cost * 0.8
                });
            }
        }

        // Check for high embedding costs
        const embeddingUsage = this.usageHistory.filter(u => u.operation === 'embedding');
        if (embeddingUsage.length > 0) {
            const embeddingCost = embeddingUsage.reduce((sum, u) => sum + u.estimatedCost, 0);
            if (embeddingCost > 10) {
                suggestions.push({
                    type: 'use-local-embeddings',
                    severity: 'high',
                    message: 'Consider using local embeddings',
                    details: `Spent $${embeddingCost.toFixed(2)} on embeddings this week. ` +
                        `Using local MLX embeddings (if on Apple Silicon) could reduce this to $0.`,
                    potentialSavings: embeddingCost
                });
            }
        }

        // Check budget utilization
        for (const budget of this.budgets.values()) {
            if (budget.percentUsed > 90) {
                suggestions.push({
                    type: 'budget-alert',
                    severity: 'high',
                    message: `${budget.period} budget almost exhausted`,
                    details: `Used ${budget.percentUsed.toFixed(1)}% of ${budget.period} budget ($${budget.current.toFixed(2)} / $${budget.limit.toFixed(2)})`,
                    potentialSavings: 0
                });
            }
        }

        return suggestions;
    }

    /**
     * Export usage data for analysis
     */
    exportUsageData(format: 'json' | 'csv' = 'json'): string {
        if (format === 'json') {
            return JSON.stringify(this.usageHistory, null, 2);
        } else {
            // CSV format
            const headers = ['Timestamp', 'Provider', 'Model', 'Operation', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Cost (USD)'];
            const rows = this.usageHistory.map(u => [
                u.timestamp.toISOString(),
                u.provider,
                u.model,
                u.operation,
                u.promptTokens.toString(),
                u.completionTokens.toString(),
                u.totalTokens.toString(),
                u.estimatedCost.toFixed(6)
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }
    }

    // Private helper methods

    private getStartTime(now: Date, period: UsageSummary['period']): Date {
        const start = new Date(now);

        switch (period) {
            case 'hour':
                start.setHours(start.getHours() - 1);
                break;
            case 'day':
                start.setDate(start.getDate() - 1);
                break;
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start.setMonth(start.getMonth() - 1);
                break;
        }

        return start;
    }

    private async updateBudgets(newUsage?: TokenUsage): Promise<void> {
        const now = new Date();

        for (const [period, budget] of this.budgets) {
            const startTime = this.getStartTime(now, period as UsageSummary['period']);
            const relevantUsage = this.usageHistory.filter(u => u.timestamp >= startTime);

            budget.current = relevantUsage.reduce((sum, u) => sum + u.estimatedCost, 0);
            budget.remaining = Math.max(0, budget.limit - budget.current);
            budget.percentUsed = (budget.current / budget.limit) * 100;
        }

        await this.saveBudgets();
    }

    private async checkBudgetAlerts(): Promise<void> {
        for (const budget of this.budgets.values()) {
            if (budget.percentUsed >= budget.alertThreshold && budget.percentUsed < 100) {
                vscode.window.showWarningMessage(
                    `⚠️ Token Budget Alert: ${budget.percentUsed.toFixed(1)}% of ${budget.period} budget used ($${budget.current.toFixed(2)} / $${budget.limit.toFixed(2)})`,
                    'View Usage',
                    'Increase Budget'
                ).then(action => {
                    if (action === 'View Usage') {
                        vscode.commands.executeCommand('workspace-rag.showCostDashboard');
                    }
                });
            } else if (budget.percentUsed >= 100) {
                vscode.window.showErrorMessage(
                    `🚨 Token Budget Exceeded: ${budget.period} budget limit reached! ($${budget.current.toFixed(2)} / $${budget.limit.toFixed(2)})`,
                    'View Usage'
                );
            }
        }
    }

    private async loadHistory(): Promise<void> {
        const stored = this.context.globalState.get<TokenUsage[]>(this.storageKey, []);
        this.usageHistory = stored.map(u => ({
            ...u,
            timestamp: new Date(u.timestamp)
        }));
    }

    private async saveHistory(): Promise<void> {
        await this.context.globalState.update(this.storageKey, this.usageHistory);
    }

    private async loadBudgets(): Promise<void> {
        const stored = this.context.globalState.get<Budget[]>(this.budgetKey, []);
        this.budgets = new Map(stored.map(b => [b.period, b]));
    }

    private async saveBudgets(): Promise<void> {
        await this.context.globalState.update(this.budgetKey, Array.from(this.budgets.values()));
    }

    private startPeriodicCleanup(): void {
        // Clean up old usage data every hour
        setInterval(() => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            this.usageHistory = this.usageHistory.filter(u => u.timestamp >= thirtyDaysAgo);
            this.saveHistory();
        }, 60 * 60 * 1000); // 1 hour
    }
}

interface ProviderComparison {
    provider: string;
    model: string;
    cost: number;
    savingsVsCheapest: number;
}

interface OptimizationSuggestion {
    type: 'model-downgrade' | 'use-local-embeddings' | 'budget-alert' | 'reduce-frequency';
    severity: 'low' | 'medium' | 'high';
    message: string;
    details: string;
    potentialSavings: number;
}
