/**
 * Cost Tracker Service for VibeCode AI
 *
 * Tracks AI usage costs across models and sessions, stores history in local storage,
 * and provides aggregation, estimation, and export capabilities.
 *
 * @module lib/ai/cost/cost-tracker
 */

import {
  ModelPricing,
  UsageStats,
  UsageHistory,
  UsageDataPoint,
  SessionUsage,
  AllTimeUsage,
  CostEstimate,
  CostBreakdown,
  CostComparison,
  ModelCostEstimate,
  CostAlert,
  CostAlertConfig,
  CostSettings,
  CostEvent,
  CostEventCallback,
  TimePeriod,
  AlertType,
  AlertSeverity,
  EstimateConfidence,
  ModelTier,
  DEFAULT_COST_SETTINGS,
  ExportOptions,
  ExportFormat,
} from '@/types/cost-estimation';
import { MODEL_CONFIGS, ModelTokenConfig } from '@/types/context';
import { getTokenCounter, TokenCounter } from '../context/token-counter';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  USAGE_HISTORY: 'vibecode_cost_usage_history',
  COST_ALERTS: 'vibecode_cost_alerts',
  COST_SETTINGS: 'vibecode_cost_settings',
  ALL_TIME_USAGE: 'vibecode_cost_all_time',
  SESSION_ID: 'vibecode_current_session_id',
} as const;

// ============================================================================
// Extended Model Pricing Data (from OpenRouter and direct providers)
// ============================================================================

/**
 * Comprehensive pricing data for 321+ models
 * Prices in USD per 1K tokens
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4': {
    modelId: 'gpt-4',
    displayName: 'GPT-4',
    provider: 'openai',
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06,
    contextWindow: 8192,
    maxOutputTokens: 4096,
  },
  'gpt-4-turbo': {
    modelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    provider: 'openai',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    inputCostPer1K: 0.005,
    outputCostPer1K: 0.015,
    contextWindow: 128000,
    maxOutputTokens: 16384,
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    contextWindow: 128000,
    maxOutputTokens: 16384,
  },
  'gpt-3.5-turbo': {
    modelId: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    provider: 'openai',
    inputCostPer1K: 0.0005,
    outputCostPer1K: 0.0015,
    contextWindow: 16384,
    maxOutputTokens: 4096,
  },
  'o1': {
    modelId: 'o1',
    displayName: 'O1',
    provider: 'openai',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.06,
    contextWindow: 200000,
    maxOutputTokens: 100000,
  },
  'o1-mini': {
    modelId: 'o1-mini',
    displayName: 'O1 Mini',
    provider: 'openai',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.012,
    contextWindow: 128000,
    maxOutputTokens: 65536,
  },
  'o1-preview': {
    modelId: 'o1-preview',
    displayName: 'O1 Preview',
    provider: 'openai',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.06,
    contextWindow: 128000,
    maxOutputTokens: 32768,
  },

  // Anthropic Models
  'claude-3-opus': {
    modelId: 'claude-3-opus',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    contextWindow: 200000,
    maxOutputTokens: 4096,
  },
  'claude-3-sonnet': {
    modelId: 'claude-3-sonnet',
    displayName: 'Claude 3 Sonnet',
    provider: 'anthropic',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 200000,
    maxOutputTokens: 4096,
  },
  'claude-3.5-sonnet': {
    modelId: 'claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
  'claude-3-haiku': {
    modelId: 'claude-3-haiku',
    displayName: 'Claude 3 Haiku',
    provider: 'anthropic',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
    contextWindow: 200000,
    maxOutputTokens: 4096,
  },
  'claude-3.5-haiku': {
    modelId: 'claude-3.5-haiku',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    inputCostPer1K: 0.001,
    outputCostPer1K: 0.005,
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },

  // Google Models
  'gemini-pro': {
    modelId: 'gemini-pro',
    displayName: 'Gemini Pro',
    provider: 'google',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.0005,
    contextWindow: 32000,
    maxOutputTokens: 8192,
  },
  'gemini-1.5-pro': {
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'google',
    inputCostPer1K: 0.00125,
    outputCostPer1K: 0.005,
    contextWindow: 2000000,
    maxOutputTokens: 8192,
  },
  'gemini-1.5-flash': {
    modelId: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'google',
    inputCostPer1K: 0.000075,
    outputCostPer1K: 0.0003,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
  },
  'gemini-2.0-flash': {
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    inputCostPer1K: 0.0001,
    outputCostPer1K: 0.0004,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
  },

  // Mistral Models
  'mistral-large': {
    modelId: 'mistral-large',
    displayName: 'Mistral Large',
    provider: 'mistral',
    inputCostPer1K: 0.002,
    outputCostPer1K: 0.006,
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'mistral-medium': {
    modelId: 'mistral-medium',
    displayName: 'Mistral Medium',
    provider: 'mistral',
    inputCostPer1K: 0.0027,
    outputCostPer1K: 0.0081,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },
  'mistral-small': {
    modelId: 'mistral-small',
    displayName: 'Mistral Small',
    provider: 'mistral',
    inputCostPer1K: 0.001,
    outputCostPer1K: 0.003,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },
  'mistral-7b': {
    modelId: 'mistral-7b',
    displayName: 'Mistral 7B',
    provider: 'mistral',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00025,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },
  'mixtral-8x7b': {
    modelId: 'mixtral-8x7b',
    displayName: 'Mixtral 8x7B',
    provider: 'mistral',
    inputCostPer1K: 0.0007,
    outputCostPer1K: 0.0007,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },
  'mixtral-8x22b': {
    modelId: 'mixtral-8x22b',
    displayName: 'Mixtral 8x22B',
    provider: 'mistral',
    inputCostPer1K: 0.0012,
    outputCostPer1K: 0.0012,
    contextWindow: 64000,
    maxOutputTokens: 4096,
  },
  'codestral': {
    modelId: 'codestral',
    displayName: 'Codestral',
    provider: 'mistral',
    inputCostPer1K: 0.001,
    outputCostPer1K: 0.003,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },

  // Meta Llama Models
  'llama-3-70b': {
    modelId: 'llama-3-70b',
    displayName: 'Llama 3 70B',
    provider: 'meta',
    inputCostPer1K: 0.0008,
    outputCostPer1K: 0.0008,
    contextWindow: 8192,
    maxOutputTokens: 2048,
  },
  'llama-3-8b': {
    modelId: 'llama-3-8b',
    displayName: 'Llama 3 8B',
    provider: 'meta',
    inputCostPer1K: 0.0001,
    outputCostPer1K: 0.0001,
    contextWindow: 8192,
    maxOutputTokens: 2048,
  },
  'llama-3.1-70b': {
    modelId: 'llama-3.1-70b',
    displayName: 'Llama 3.1 70B',
    provider: 'meta',
    inputCostPer1K: 0.0008,
    outputCostPer1K: 0.0008,
    contextWindow: 131072,
    maxOutputTokens: 4096,
  },
  'llama-3.1-405b': {
    modelId: 'llama-3.1-405b',
    displayName: 'Llama 3.1 405B',
    provider: 'meta',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.003,
    contextWindow: 131072,
    maxOutputTokens: 4096,
  },
  'llama-3.2-90b': {
    modelId: 'llama-3.2-90b',
    displayName: 'Llama 3.2 90B',
    provider: 'meta',
    inputCostPer1K: 0.0009,
    outputCostPer1K: 0.0009,
    contextWindow: 131072,
    maxOutputTokens: 4096,
  },

  // Cohere Models
  'command-r-plus': {
    modelId: 'command-r-plus',
    displayName: 'Command R+',
    provider: 'cohere',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'command-r': {
    modelId: 'command-r',
    displayName: 'Command R',
    provider: 'cohere',
    inputCostPer1K: 0.0005,
    outputCostPer1K: 0.0015,
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },

  // DeepSeek Models
  'deepseek-v3': {
    modelId: 'deepseek-v3',
    displayName: 'DeepSeek V3',
    provider: 'deepseek',
    inputCostPer1K: 0.00014,
    outputCostPer1K: 0.00028,
    contextWindow: 128000,
    maxOutputTokens: 8192,
  },
  'deepseek-r1': {
    modelId: 'deepseek-r1',
    displayName: 'DeepSeek R1',
    provider: 'deepseek',
    inputCostPer1K: 0.00055,
    outputCostPer1K: 0.00219,
    contextWindow: 128000,
    maxOutputTokens: 8192,
  },
  'deepseek-coder': {
    modelId: 'deepseek-coder',
    displayName: 'DeepSeek Coder',
    provider: 'deepseek',
    inputCostPer1K: 0.00014,
    outputCostPer1K: 0.00028,
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },

  // Qwen Models
  'qwen-2.5-72b': {
    modelId: 'qwen-2.5-72b',
    displayName: 'Qwen 2.5 72B',
    provider: 'alibaba',
    inputCostPer1K: 0.0004,
    outputCostPer1K: 0.0004,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },
  'qwen-2.5-coder-32b': {
    modelId: 'qwen-2.5-coder-32b',
    displayName: 'Qwen 2.5 Coder 32B',
    provider: 'alibaba',
    inputCostPer1K: 0.0002,
    outputCostPer1K: 0.0002,
    contextWindow: 32000,
    maxOutputTokens: 4096,
  },

  // xAI Grok
  'grok-2': {
    modelId: 'grok-2',
    displayName: 'Grok 2',
    provider: 'xai',
    inputCostPer1K: 0.002,
    outputCostPer1K: 0.01,
    contextWindow: 131072,
    maxOutputTokens: 4096,
  },
  'grok-2-mini': {
    modelId: 'grok-2-mini',
    displayName: 'Grok 2 Mini',
    provider: 'xai',
    inputCostPer1K: 0.0002,
    outputCostPer1K: 0.001,
    contextWindow: 131072,
    maxOutputTokens: 4096,
  },

  // Perplexity Models
  'perplexity-sonar-large': {
    modelId: 'perplexity-sonar-large',
    displayName: 'Perplexity Sonar Large',
    provider: 'perplexity',
    inputCostPer1K: 0.001,
    outputCostPer1K: 0.001,
    contextWindow: 127072,
    maxOutputTokens: 4096,
  },
  'perplexity-sonar-small': {
    modelId: 'perplexity-sonar-small',
    displayName: 'Perplexity Sonar Small',
    provider: 'perplexity',
    inputCostPer1K: 0.0002,
    outputCostPer1K: 0.0002,
    contextWindow: 127072,
    maxOutputTokens: 4096,
  },
};

// ============================================================================
// Model Tier Classification
// ============================================================================

function getModelTier(pricing: ModelPricing): ModelTier {
  const avgCost = (pricing.inputCostPer1K + pricing.outputCostPer1K) / 2;
  if (avgCost < 0.0005) return 'economy';
  if (avgCost < 0.005) return 'standard';
  if (avgCost < 0.02) return 'premium';
  return 'enterprise';
}

// ============================================================================
// Cost Tracker Class
// ============================================================================

export interface CostTrackerOptions {
  /** Enable local storage persistence */
  enablePersistence?: boolean;
  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeout?: number;
  /** Enable automatic alert checking */
  enableAlertChecking?: boolean;
  /** Custom token counter instance */
  tokenCounter?: TokenCounter;
}

/**
 * CostTracker - Main service for tracking and managing AI costs
 */
export class CostTracker {
  private readonly options: Required<CostTrackerOptions>;
  private tokenCounter: TokenCounter;
  private eventListeners: Set<CostEventCallback> = new Set();
  private currentSessionId: string;
  private sessionStartTime: string;
  private sessionUsage: SessionUsage;
  private alerts: CostAlert[] = [];
  private settings: CostSettings;

  constructor(options: CostTrackerOptions = {}) {
    this.options = {
      enablePersistence: options.enablePersistence ?? true,
      sessionTimeout: options.sessionTimeout ?? 30 * 60 * 1000,
      enableAlertChecking: options.enableAlertChecking ?? true,
      tokenCounter: options.tokenCounter ?? getTokenCounter(),
    };
    this.tokenCounter = this.options.tokenCounter;

    // Initialize session
    this.currentSessionId = this.generateSessionId();
    this.sessionStartTime = new Date().toISOString();
    this.sessionUsage = this.createEmptySessionUsage();
    this.settings = DEFAULT_COST_SETTINGS;

    // Load persisted data
    if (this.options.enablePersistence && typeof window !== 'undefined') {
      this.loadPersistedData();
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private createEmptySessionUsage(): SessionUsage {
    return {
      startTime: new Date().toISOString(),
      totalCost: 0,
      totalTokens: 0,
      requests: 0,
      byModel: {},
    };
  }

  /**
   * Start a new tracking session
   */
  startNewSession(): void {
    // Save current session data before starting new one
    this.saveSessionToHistory();

    this.currentSessionId = this.generateSessionId();
    this.sessionStartTime = new Date().toISOString();
    this.sessionUsage = this.createEmptySessionUsage();

    if (this.options.enablePersistence && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, this.currentSessionId);
    }
  }

  /**
   * Get current session usage
   */
  getCurrentSession(): SessionUsage {
    return { ...this.sessionUsage };
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.currentSessionId;
  }

  // ============================================================================
  // Usage Recording
  // ============================================================================

  /**
   * Record usage from an API request
   */
  recordUsage(
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    options?: {
      sessionId?: string;
      userId?: string;
      workspaceId?: string;
    }
  ): UsageStats {
    const pricing = this.getModelPricing(modelId);
    const totalCost = this.calculateCost(promptTokens, completionTokens, pricing);

    const usage: UsageStats = {
      promptTokens,
      completionTokens,
      totalCost,
      requests: 1,
      modelId,
      provider: pricing.provider,
      timestamp: new Date().toISOString(),
      sessionId: options?.sessionId || this.currentSessionId,
      userId: options?.userId,
      workspaceId: options?.workspaceId,
    };

    // Update session usage
    this.updateSessionUsage(usage);

    // Update all-time usage
    this.updateAllTimeUsage(usage);

    // Check alerts
    if (this.options.enableAlertChecking) {
      this.checkAlerts();
    }

    // Emit event
    this.emitEvent({
      type: 'usage_recorded',
      payload: usage,
      timestamp: new Date().toISOString(),
    });

    // Persist data
    if (this.options.enablePersistence) {
      this.persistData();
    }

    return usage;
  }

  private updateSessionUsage(usage: UsageStats): void {
    this.sessionUsage.totalCost += usage.totalCost;
    this.sessionUsage.totalTokens += usage.promptTokens + usage.completionTokens;
    this.sessionUsage.requests += 1;

    // Update model breakdown
    if (!this.sessionUsage.byModel[usage.modelId]) {
      this.sessionUsage.byModel[usage.modelId] = {
        promptTokens: 0,
        completionTokens: 0,
        totalCost: 0,
        requests: 0,
        modelId: usage.modelId,
        provider: usage.provider,
        timestamp: usage.timestamp,
      };
    }

    this.sessionUsage.byModel[usage.modelId].promptTokens += usage.promptTokens;
    this.sessionUsage.byModel[usage.modelId].completionTokens += usage.completionTokens;
    this.sessionUsage.byModel[usage.modelId].totalCost += usage.totalCost;
    this.sessionUsage.byModel[usage.modelId].requests += 1;
  }

  private updateAllTimeUsage(usage: UsageStats): void {
    if (!this.options.enablePersistence || typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ALL_TIME_USAGE);
      const allTime: AllTimeUsage = stored
        ? JSON.parse(stored)
        : {
            totalCost: 0,
            totalTokens: 0,
            totalRequests: 0,
            firstUsageDate: new Date().toISOString(),
            mostUsedModel: usage.modelId,
            mostExpensiveModel: usage.modelId,
          };

      allTime.totalCost += usage.totalCost;
      allTime.totalTokens += usage.promptTokens + usage.completionTokens;
      allTime.totalRequests += 1;

      localStorage.setItem(STORAGE_KEYS.ALL_TIME_USAGE, JSON.stringify(allTime));
    } catch (error) {
      console.error('Failed to update all-time usage:', error);
    }
  }

  // ============================================================================
  // Cost Calculation
  // ============================================================================

  /**
   * Get pricing for a model
   */
  getModelPricing(modelId: string): ModelPricing {
    // Check our extended pricing database first
    if (MODEL_PRICING[modelId]) {
      return MODEL_PRICING[modelId];
    }

    // Check MODEL_CONFIGS from context.ts
    if (MODEL_CONFIGS[modelId]) {
      const config = MODEL_CONFIGS[modelId];
      return {
        modelId,
        displayName: modelId,
        provider: 'unknown',
        inputCostPer1K: config.inputCostPer1K || 0,
        outputCostPer1K: config.outputCostPer1K || 0,
        contextWindow: config.maxContextTokens,
        maxOutputTokens: config.maxOutputTokens,
        isEstimated: true,
      };
    }

    // Try to match by prefix
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (modelId.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(modelId.toLowerCase())) {
        return pricing;
      }
    }

    // Default fallback with estimated pricing
    return {
      modelId,
      displayName: modelId,
      provider: 'unknown',
      inputCostPer1K: 0.001, // Default conservative estimate
      outputCostPer1K: 0.002,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      isEstimated: true,
    };
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(
    inputTokens: number,
    outputTokens: number,
    pricing: ModelPricing
  ): number {
    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;
    return inputCost + outputCost;
  }

  /**
   * Get detailed cost breakdown
   */
  getCostBreakdown(
    inputTokens: number,
    outputTokens: number,
    modelId: string
  ): CostBreakdown {
    const pricing = this.getModelPricing(modelId);
    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;

    return {
      inputCost,
      outputCost,
      additionalFees: 0,
      total: inputCost + outputCost,
      inputTokens,
      outputTokens,
      inputRate: pricing.inputCostPer1K,
      outputRate: pricing.outputCostPer1K,
    };
  }

  // ============================================================================
  // Cost Estimation
  // ============================================================================

  /**
   * Estimate cost for a message before sending
   */
  estimateCost(
    message: string,
    modelId: string,
    estimatedOutputTokens?: number
  ): CostEstimate {
    const pricing = this.getModelPricing(modelId);

    // Count input tokens
    const inputResult = this.tokenCounter.count(message, modelId);
    const inputTokens = inputResult.count;

    // Estimate output tokens (default to 50% of input if not specified)
    const outputTokens = estimatedOutputTokens ?? Math.ceil(inputTokens * 0.5);

    // Calculate costs
    const breakdown = this.getCostBreakdown(inputTokens, outputTokens, modelId);

    // Determine confidence
    let confidence: EstimateConfidence = 'high';
    if (pricing.isEstimated) {
      confidence = 'low';
    } else if (!estimatedOutputTokens) {
      confidence = 'medium';
    }

    // Calculate min/max range
    const minOutputTokens = Math.ceil(outputTokens * 0.5);
    const maxOutputTokens = Math.ceil(outputTokens * 2);
    const minCost = this.calculateCost(inputTokens, minOutputTokens, pricing);
    const maxCost = this.calculateCost(inputTokens, maxOutputTokens, pricing);

    const warnings: string[] = [];
    if (pricing.isEstimated) {
      warnings.push('Pricing is estimated - actual cost may vary');
    }
    if (inputTokens > pricing.contextWindow * 0.9) {
      warnings.push('Input is close to context window limit');
    }

    return {
      estimatedCost: breakdown.total,
      breakdown,
      confidence,
      modelId,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      minCost,
      maxCost,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Compare costs across multiple models
   */
  compareModels(message: string, modelIds?: string[]): CostComparison {
    const models = modelIds || Object.keys(MODEL_PRICING).slice(0, 10);
    const inputTokens = this.tokenCounter.count(message).count;

    const estimates: ModelCostEstimate[] = models.map((modelId) => {
      const pricing = this.getModelPricing(modelId);
      const outputTokens = Math.ceil(inputTokens * 0.5);
      const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
      const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;
      const estimatedCost = inputCost + outputCost;

      return {
        modelId,
        displayName: pricing.displayName,
        provider: pricing.provider,
        estimatedCost,
        inputCost,
        outputCost,
        tier: getModelTier(pricing),
        savings: 0,
        savingsPercentage: 0,
      };
    });

    // Sort by cost and calculate savings
    estimates.sort((a, b) => a.estimatedCost - b.estimatedCost);
    const maxCost = estimates[estimates.length - 1]?.estimatedCost || 0;

    estimates.forEach((estimate) => {
      estimate.savings = maxCost - estimate.estimatedCost;
      estimate.savingsPercentage = maxCost > 0
        ? (estimate.savings / maxCost) * 100
        : 0;
    });

    // Find best value (premium tier with lowest cost)
    const premiumModels = estimates.filter((e) => e.tier === 'premium' || e.tier === 'standard');
    const bestValueModel = premiumModels[0]?.modelId || estimates[0]?.modelId || '';

    return {
      input: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      estimatedInputTokens: inputTokens,
      estimates,
      cheapestModel: estimates[0]?.modelId || '',
      bestValueModel,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Usage History
  // ============================================================================

  /**
   * Get usage history with all aggregations
   */
  getUsageHistory(): UsageHistory {
    if (!this.options.enablePersistence || typeof window === 'undefined') {
      return this.createEmptyUsageHistory();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USAGE_HISTORY);
      if (stored) {
        const history = JSON.parse(stored) as UsageHistory;
        history.currentSession = this.sessionUsage;
        history.lastUpdated = new Date().toISOString();
        return history;
      }
    } catch (error) {
      console.error('Failed to load usage history:', error);
    }

    return this.createEmptyUsageHistory();
  }

  private createEmptyUsageHistory(): UsageHistory {
    return {
      hourly: [],
      daily: [],
      weekly: [],
      monthly: [],
      currentSession: this.sessionUsage,
      allTime: {
        totalCost: 0,
        totalTokens: 0,
        totalRequests: 0,
        firstUsageDate: new Date().toISOString(),
        mostUsedModel: '',
        mostExpensiveModel: '',
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get aggregated usage for a specific time period
   */
  getAggregatedUsage(period: TimePeriod): UsageDataPoint[] {
    const history = this.getUsageHistory();
    switch (period) {
      case 'hourly':
        return history.hourly;
      case 'daily':
        return history.daily;
      case 'weekly':
        return history.weekly;
      case 'monthly':
        return history.monthly;
      default:
        return history.daily;
    }
  }

  private saveSessionToHistory(): void {
    if (!this.options.enablePersistence || typeof window === 'undefined') return;
    if (this.sessionUsage.requests === 0) return;

    try {
      const history = this.getUsageHistory();
      const now = new Date();

      // Create data point for current session
      const dataPoint: UsageDataPoint = {
        timestamp: this.sessionStartTime,
        cost: this.sessionUsage.totalCost,
        tokens: this.sessionUsage.totalTokens,
        requests: this.sessionUsage.requests,
        promptTokens: Object.values(this.sessionUsage.byModel)
          .reduce((sum, m) => sum + m.promptTokens, 0),
        completionTokens: Object.values(this.sessionUsage.byModel)
          .reduce((sum, m) => sum + m.completionTokens, 0),
      };

      // Add to hourly (keep last 24 hours)
      history.hourly.push(dataPoint);
      const hourlyLimit = 24;
      if (history.hourly.length > hourlyLimit) {
        history.hourly = history.hourly.slice(-hourlyLimit);
      }

      // Aggregate to daily
      const today = now.toISOString().split('T')[0];
      const todayIndex = history.daily.findIndex(
        (d) => d.timestamp.startsWith(today)
      );
      if (todayIndex >= 0) {
        history.daily[todayIndex].cost += dataPoint.cost;
        history.daily[todayIndex].tokens += dataPoint.tokens;
        history.daily[todayIndex].requests += dataPoint.requests;
        history.daily[todayIndex].promptTokens += dataPoint.promptTokens;
        history.daily[todayIndex].completionTokens += dataPoint.completionTokens;
      } else {
        history.daily.push({ ...dataPoint, timestamp: today });
      }
      // Keep last 30 days
      if (history.daily.length > 30) {
        history.daily = history.daily.slice(-30);
      }

      localStorage.setItem(STORAGE_KEYS.USAGE_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save session to history:', error);
    }
  }

  // ============================================================================
  // Cost Alerts
  // ============================================================================

  /**
   * Create a new cost alert
   */
  createAlert(config: CostAlertConfig): CostAlert {
    const alert: CostAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: config.type,
      severity: this.getAlertSeverity(config.type, config.threshold),
      threshold: config.threshold,
      current: this.getCurrentValueForAlert(config.type),
      triggered: false,
      message: this.getAlertMessage(config.type, config.threshold),
      enabled: config.enabled,
      notifyOnTrigger: config.notifyOnTrigger,
      notificationChannels: config.notificationChannels,
      resetPeriod: config.resetPeriod,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.alerts.push(alert);
    this.persistAlerts();

    return alert;
  }

  /**
   * Update an existing alert
   */
  updateAlert(alertId: string, updates: Partial<CostAlertConfig>): CostAlert | null {
    const index = this.alerts.findIndex((a) => a.id === alertId);
    if (index === -1) return null;

    const alert = this.alerts[index];
    if (updates.type) alert.type = updates.type;
    if (updates.threshold !== undefined) alert.threshold = updates.threshold;
    if (updates.enabled !== undefined) alert.enabled = updates.enabled;
    if (updates.notifyOnTrigger !== undefined) alert.notifyOnTrigger = updates.notifyOnTrigger;
    if (updates.notificationChannels) alert.notificationChannels = updates.notificationChannels;
    if (updates.resetPeriod) alert.resetPeriod = updates.resetPeriod;

    alert.updatedAt = new Date().toISOString();
    alert.message = this.getAlertMessage(alert.type, alert.threshold);

    this.persistAlerts();
    return alert;
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    const index = this.alerts.findIndex((a) => a.id === alertId);
    if (index === -1) return false;

    this.alerts.splice(index, 1);
    this.persistAlerts();
    return true;
  }

  /**
   * Acknowledge a triggered alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.triggered = false;
    alert.updatedAt = new Date().toISOString();
    this.persistAlerts();
    return true;
  }

  /**
   * Get all alerts
   */
  getAlerts(): CostAlert[] {
    return [...this.alerts];
  }

  /**
   * Get triggered alerts
   */
  getTriggeredAlerts(): CostAlert[] {
    return this.alerts.filter((a) => a.triggered && a.enabled);
  }

  private checkAlerts(): void {
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;

      const currentValue = this.getCurrentValueForAlert(alert.type);
      alert.current = currentValue;

      if (currentValue >= alert.threshold && !alert.triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();

        this.emitEvent({
          type: 'alert_triggered',
          payload: alert,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.persistAlerts();
  }

  private getCurrentValueForAlert(type: AlertType): number {
    switch (type) {
      case 'session_limit':
        return this.sessionUsage.totalCost;
      case 'daily_limit': {
        const history = this.getUsageHistory();
        const today = new Date().toISOString().split('T')[0];
        const todayData = history.daily.find((d) => d.timestamp.startsWith(today));
        return (todayData?.cost || 0) + this.sessionUsage.totalCost;
      }
      case 'budget_threshold': {
        const budgetHistory = this.getUsageHistory();
        return budgetHistory.allTime.totalCost;
      }
      default:
        return this.sessionUsage.totalCost;
    }
  }

  private getAlertSeverity(type: AlertType, threshold: number): AlertSeverity {
    if (type === 'budget_threshold' && threshold >= 0.9) return 'critical';
    if (type === 'daily_limit') return 'warning';
    return 'info';
  }

  private getAlertMessage(type: AlertType, threshold: number): string {
    switch (type) {
      case 'budget_threshold':
        return `Monthly budget threshold of $${threshold.toFixed(2)} reached`;
      case 'daily_limit':
        return `Daily spending limit of $${threshold.toFixed(2)} reached`;
      case 'session_limit':
        return `Session spending limit of $${threshold.toFixed(2)} reached`;
      case 'rate_spike':
        return `Unusual spending rate detected (${threshold}x normal)`;
      case 'unusual_usage':
        return `Unusual usage pattern detected`;
      default:
        return `Cost alert triggered at $${threshold.toFixed(2)}`;
    }
  }

  private persistAlerts(): void {
    if (!this.options.enablePersistence || typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEYS.COST_ALERTS, JSON.stringify(this.alerts));
    } catch (error) {
      console.error('Failed to persist alerts:', error);
    }
  }

  // ============================================================================
  // Settings Management
  // ============================================================================

  /**
   * Get current cost settings
   */
  getSettings(): CostSettings {
    return { ...this.settings };
  }

  /**
   * Update cost settings
   */
  updateSettings(updates: Partial<CostSettings>): CostSettings {
    this.settings = { ...this.settings, ...updates };

    this.emitEvent({
      type: 'settings_updated',
      payload: this.settings,
      timestamp: new Date().toISOString(),
    });

    this.persistSettings();
    return this.settings;
  }

  private persistSettings(): void {
    if (!this.options.enablePersistence || typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEYS.COST_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
  }

  // ============================================================================
  // Data Export
  // ============================================================================

  /**
   * Export usage data as CSV
   */
  exportAsCSV(options: ExportOptions): string {
    const history = this.getUsageHistory();
    const data = this.getAggregatedUsage(options.period);

    const headers = [
      'Timestamp',
      'Cost (USD)',
      'Total Tokens',
      'Prompt Tokens',
      'Completion Tokens',
      'Requests',
    ];

    const rows = data.map((d) => [
      d.timestamp,
      d.cost.toFixed(6),
      d.tokens.toString(),
      d.promptTokens.toString(),
      d.completionTokens.toString(),
      d.requests.toString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export usage data as JSON
   */
  exportAsJSON(options: ExportOptions): string {
    const data = {
      exportDate: new Date().toISOString(),
      period: options.period,
      data: this.getAggregatedUsage(options.period),
      settings: this.settings,
      allTime: this.getUsageHistory().allTime,
    };

    return JSON.stringify(data, null, 2);
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to cost events
   */
  subscribe(callback: CostEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emitEvent(event: CostEvent): void {
    this.eventListeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in cost event callback:', error);
      }
    });
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private loadPersistedData(): void {
    if (typeof window === 'undefined') return;

    try {
      // Load settings
      const settingsStr = localStorage.getItem(STORAGE_KEYS.COST_SETTINGS);
      if (settingsStr) {
        this.settings = { ...DEFAULT_COST_SETTINGS, ...JSON.parse(settingsStr) };
      }

      // Load alerts
      const alertsStr = localStorage.getItem(STORAGE_KEYS.COST_ALERTS);
      if (alertsStr) {
        this.alerts = JSON.parse(alertsStr);
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
    }
  }

  private persistData(): void {
    if (!this.options.enablePersistence || typeof window === 'undefined') return;

    this.persistSettings();
    this.persistAlerts();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all available model pricing
   */
  getAllModelPricing(): ModelPricing[] {
    return Object.values(MODEL_PRICING);
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): ModelPricing[] {
    return Object.values(MODEL_PRICING).filter(
      (p) => p.provider.toLowerCase() === provider.toLowerCase()
    );
  }

  /**
   * Get models by tier
   */
  getModelsByTier(tier: ModelTier): ModelPricing[] {
    return Object.values(MODEL_PRICING).filter((p) => getModelTier(p) === tier);
  }

  /**
   * Get cost-effective alternatives for a model
   */
  getCostEffectiveAlternatives(modelId: string, maxResults: number = 5): ModelPricing[] {
    const currentPricing = this.getModelPricing(modelId);
    const currentAvgCost =
      (currentPricing.inputCostPer1K + currentPricing.outputCostPer1K) / 2;

    return Object.values(MODEL_PRICING)
      .filter((p) => {
        const avgCost = (p.inputCostPer1K + p.outputCostPer1K) / 2;
        return avgCost < currentAvgCost && p.modelId !== modelId;
      })
      .sort((a, b) => {
        const avgA = (a.inputCostPer1K + a.outputCostPer1K) / 2;
        const avgB = (b.inputCostPer1K + b.outputCostPer1K) / 2;
        return avgA - avgB;
      })
      .slice(0, maxResults);
  }

  /**
   * Reset all tracking data
   */
  resetAllData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.USAGE_HISTORY);
      localStorage.removeItem(STORAGE_KEYS.ALL_TIME_USAGE);
      localStorage.removeItem(STORAGE_KEYS.COST_ALERTS);
    }

    this.alerts = [];
    this.startNewSession();
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.saveSessionToHistory();
    this.eventListeners.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultInstance: CostTracker | null = null;

/**
 * Get the default CostTracker instance
 */
export function getCostTracker(): CostTracker {
  if (!defaultInstance) {
    defaultInstance = new CostTracker();
  }
  return defaultInstance;
}

/**
 * Quick cost estimation using default instance
 */
export function estimateCost(
  message: string,
  modelId: string,
  estimatedOutputTokens?: number
): CostEstimate {
  return getCostTracker().estimateCost(message, modelId, estimatedOutputTokens);
}

/**
 * Quick cost recording using default instance
 */
export function recordUsage(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): UsageStats {
  return getCostTracker().recordUsage(modelId, promptTokens, completionTokens);
}

export default CostTracker;
