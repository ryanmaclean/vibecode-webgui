/**
 * Model Sync Service for VibeCode
 *
 * Background service for periodic synchronization of model data from OpenRouter.
 * Detects model changes (new, removed, updated) and emits events for UI updates.
 */

import type { ModelProfile } from '@/types/model-comparison';

// ============================================================================
// Types
// ============================================================================

/**
 * Type of model change detected
 */
export type ModelChangeType = 'added' | 'removed' | 'updated' | 'price_changed' | 'deprecated';

/**
 * Model change event data
 */
export interface ModelChange {
  type: ModelChangeType;
  modelId: string;
  model?: ModelProfile;
  oldModel?: ModelProfile;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

/**
 * Sync event types
 */
export type SyncEventType = 'sync_started' | 'sync_completed' | 'sync_failed' | 'models_changed';

/**
 * Sync event data
 */
export interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
  changes?: ModelChange[];
  error?: Error;
}

/**
 * Event listener callback
 */
export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Sync service configuration
 */
export interface ModelSyncConfig {
  /** Sync interval in milliseconds (default: 1 hour) */
  syncIntervalMs?: number;
  /** Whether to start syncing immediately on init (default: false) */
  autoStart?: boolean;
  /** Whether to detect and report price changes (default: true) */
  detectPriceChanges?: boolean;
  /** Whether to detect and report capability changes (default: true) */
  detectCapabilityChanges?: boolean;
  /** Minimum price change percentage to report (default: 5%) */
  minPriceChangePercent?: number;
}

// ============================================================================
// Model Sync Service
// ============================================================================

/**
 * Service for syncing models from OpenRouter and detecting changes
 */
export class ModelSyncService {
  private config: Required<ModelSyncConfig>;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private isRunning: boolean = false;
  private listeners: Map<SyncEventType, Set<SyncEventListener>> = new Map();
  private currentModels: Map<string, ModelProfile> = new Map();

  constructor(config: ModelSyncConfig = {}) {
    this.config = {
      syncIntervalMs: config.syncIntervalMs ?? 60 * 60 * 1000, // 1 hour default
      autoStart: config.autoStart ?? false,
      detectPriceChanges: config.detectPriceChanges ?? true,
      detectCapabilityChanges: config.detectCapabilityChanges ?? true,
      minPriceChangePercent: config.minPriceChangePercent ?? 5,
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start the sync service
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[ModelSync] Service already running');
      return;
    }

    this.isRunning = true;
    console.log(`[ModelSync] Starting sync service (interval: ${this.config.syncIntervalMs}ms)`);

    // Run initial sync
    this.sync();

    // Set up periodic sync
    this.syncIntervalId = setInterval(() => {
      this.sync();
    }, this.config.syncIntervalMs);
  }

  /**
   * Stop the sync service
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[ModelSync] Service not running');
      return;
    }

    this.isRunning = false;
    console.log('[ModelSync] Stopping sync service');

    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Manually trigger a sync
   */
  async sync(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[ModelSync] Cannot sync: service not running');
      return;
    }

    const startTime = Date.now();
    console.log('[ModelSync] Starting sync...');

    this.emit({
      type: 'sync_started',
      timestamp: startTime,
    });

    try {
      // Fetch latest models from OpenRouter
      const freshModels = await this.fetchModelsFromOpenRouter();

      // Detect changes
      const changes = this.detectChanges(freshModels);

      // Update internal state
      this.currentModels = new Map(
        freshModels.map(model => [model.id, model])
      );
      this.lastSyncTime = startTime;

      const endTime = Date.now();
      console.log(
        `[ModelSync] Sync completed in ${endTime - startTime}ms, ` +
        `found ${changes.length} changes`
      );

      this.emit({
        type: 'sync_completed',
        timestamp: endTime,
        changes: changes.length > 0 ? changes : undefined,
      });

      if (changes.length > 0) {
        this.emit({
          type: 'models_changed',
          timestamp: endTime,
          changes,
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[ModelSync] Sync failed:', err);

      this.emit({
        type: 'sync_failed',
        timestamp: Date.now(),
        error: err,
      });
    }
  }

  /**
   * Add event listener
   */
  on(eventType: SyncEventType, listener: SyncEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(eventType: SyncEventType, listener: SyncEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): {
    isRunning: boolean;
    lastSyncTime: number;
    modelCount: number;
    syncIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      modelCount: this.currentModels.size,
      syncIntervalMs: this.config.syncIntervalMs,
    };
  }

  /**
   * Get current models
   */
  getCurrentModels(): ModelProfile[] {
    return Array.from(this.currentModels.values());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Emit event to all listeners
   */
  private emit(event: SyncEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[ModelSync] Error in event listener:`, error);
        }
      });
    }
  }

  /**
   * Fetch models from OpenRouter API
   */
  private async fetchModelsFromOpenRouter(): Promise<ModelProfile[]> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Transform OpenRouter response to ModelProfile format
      return (data.data || []).map((model: any) => this.transformOpenRouterModel(model));
    } catch (error) {
      console.error('[ModelSync] Failed to fetch models from OpenRouter:', error);
      throw error;
    }
  }

  /**
   * Transform OpenRouter model data to ModelProfile
   */
  private transformOpenRouterModel(model: any): ModelProfile {
    const modelId = model.id;
    const providerId = modelId.split('/')[0];

    return {
      id: modelId,
      name: model.name || modelId.split('/')[1] || modelId,
      description: model.description || '',
      family: this.getModelFamily(modelId),
      provider: {
        id: providerId,
        name: this.getProviderName(providerId),
        tier: this.getProviderTier(providerId),
        available: true,
      },
      capabilities: {
        coding: model.capabilities?.coding ?? 50,
        reasoning: model.capabilities?.reasoning ?? 50,
        creative: model.capabilities?.creative ?? 50,
        math: model.capabilities?.math ?? 50,
        vision: model.capabilities?.vision ?? 0,
        function_calling: model.capabilities?.function_calling ?? false,
        streaming: model.capabilities?.streaming ?? true,
        conversation: model.capabilities?.conversation ?? 50,
        instruction_following: model.capabilities?.instruction_following ?? 50,
        debugging: model.capabilities?.debugging ?? 50,
      },
      pricing: {
        inputPer1K: model.pricing?.prompt ?? 0,
        outputPer1K: model.pricing?.completion ?? 0,
        isFree: (model.pricing?.prompt ?? 0) === 0,
        billingUnit: 'token',
        currency: 'USD',
      },
      performance: {
        avgLatencyMs: 500,
        tokensPerSecond: 80,
        speedTier: 'medium',
      },
      limits: {
        contextWindow: model.context_length ?? 32000,
        maxOutputTokens: model.max_output_tokens ?? 4096,
        maxInputTokens: (model.context_length ?? 32000) - (model.max_output_tokens ?? 4096),
      },
      benchmarks: {
        overall: 50,
        byCategory: {},
        benchmarks: [],
        benchmarkCount: 0,
      },
      qualityTier: 'good',
      tags: model.tags || [],
      deprecated: model.deprecated ?? false,
      replacementModelId: model.replacement_model_id,
    };
  }

  /**
   * Get model family from model ID
   */
  private getModelFamily(modelId: string): string {
    if (modelId.includes('claude')) return 'claude';
    if (modelId.includes('gpt')) return 'gpt';
    if (modelId.includes('gemini')) return 'gemini';
    if (modelId.includes('llama')) return 'llama';
    if (modelId.includes('mistral')) return 'mistral';
    return 'other';
  }

  /**
   * Get provider name from provider ID
   */
  private getProviderName(providerId: string): string {
    const nameMap: Record<string, string> = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'google': 'Google AI',
      'meta': 'Meta',
      'mistral': 'Mistral AI',
      'cohere': 'Cohere',
      'deepseek': 'DeepSeek',
      'qwen': 'Qwen (Alibaba)',
    };
    return nameMap[providerId] || providerId.charAt(0).toUpperCase() + providerId.slice(1);
  }

  /**
   * Get provider tier from provider ID
   */
  private getProviderTier(providerId: string): 'free' | 'low' | 'medium' | 'high' | 'enterprise' {
    const tierMap: Record<string, 'free' | 'low' | 'medium' | 'high' | 'enterprise'> = {
      'anthropic': 'high',
      'openai': 'high',
      'google': 'medium',
      'mistral': 'medium',
      'meta': 'medium',
      'cohere': 'medium',
      'deepseek': 'low',
      'qwen': 'low',
    };
    return tierMap[providerId] || 'medium';
  }

  /**
   * Detect changes between current and fresh models
   */
  private detectChanges(freshModels: ModelProfile[]): ModelChange[] {
    const changes: ModelChange[] = [];
    const freshModelMap = new Map(freshModels.map(m => [m.id, m]));

    // Detect new models
    for (const [id, freshModel] of freshModelMap) {
      if (!this.currentModels.has(id)) {
        changes.push({
          type: 'added',
          modelId: id,
          model: freshModel,
        });
      }
    }

    // Detect removed models
    for (const [id, oldModel] of this.currentModels) {
      if (!freshModelMap.has(id)) {
        changes.push({
          type: 'removed',
          modelId: id,
          oldModel,
        });
      }
    }

    // Detect updates (price changes, deprecations, etc.)
    for (const [id, freshModel] of freshModelMap) {
      const oldModel = this.currentModels.get(id);
      if (!oldModel) continue;

      const modelChanges = this.detectModelChanges(oldModel, freshModel);
      if (modelChanges.length > 0) {
        // Determine change type based on what changed
        let changeType: ModelChangeType = 'updated';

        if (freshModel.deprecated && !oldModel.deprecated) {
          changeType = 'deprecated';
        } else if (this.config.detectPriceChanges && this.hasPriceChange(oldModel, freshModel)) {
          changeType = 'price_changed';
        }

        changes.push({
          type: changeType,
          modelId: id,
          model: freshModel,
          oldModel,
          changes: modelChanges,
        });
      }
    }

    return changes;
  }

  /**
   * Detect specific changes between two model versions
   */
  private detectModelChanges(
    oldModel: ModelProfile,
    newModel: ModelProfile
  ): { field: string; oldValue: unknown; newValue: unknown }[] {
    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

    // Check price changes
    if (this.config.detectPriceChanges) {
      if (this.hasSignificantPriceChange(oldModel.pricing.inputPer1K, newModel.pricing.inputPer1K)) {
        changes.push({
          field: 'pricing.inputPer1K',
          oldValue: oldModel.pricing.inputPer1K,
          newValue: newModel.pricing.inputPer1K,
        });
      }
      if (this.hasSignificantPriceChange(oldModel.pricing.outputPer1K, newModel.pricing.outputPer1K)) {
        changes.push({
          field: 'pricing.outputPer1K',
          oldValue: oldModel.pricing.outputPer1K,
          newValue: newModel.pricing.outputPer1K,
        });
      }
    }

    // Check deprecation status
    if (oldModel.deprecated !== newModel.deprecated) {
      changes.push({
        field: 'deprecated',
        oldValue: oldModel.deprecated,
        newValue: newModel.deprecated,
      });
    }

    // Check context window changes
    if (oldModel.limits.contextWindow !== newModel.limits.contextWindow) {
      changes.push({
        field: 'limits.contextWindow',
        oldValue: oldModel.limits.contextWindow,
        newValue: newModel.limits.contextWindow,
      });
    }

    // Check capability changes (if enabled)
    if (this.config.detectCapabilityChanges) {
      const capabilityKeys = Object.keys(newModel.capabilities) as (keyof typeof newModel.capabilities)[];
      for (const key of capabilityKeys) {
        if (oldModel.capabilities[key] !== newModel.capabilities[key]) {
          changes.push({
            field: `capabilities.${key}`,
            oldValue: oldModel.capabilities[key],
            newValue: newModel.capabilities[key],
          });
        }
      }
    }

    return changes;
  }

  /**
   * Check if there's a price change
   */
  private hasPriceChange(oldModel: ModelProfile, newModel: ModelProfile): boolean {
    return (
      this.hasSignificantPriceChange(oldModel.pricing.inputPer1K, newModel.pricing.inputPer1K) ||
      this.hasSignificantPriceChange(oldModel.pricing.outputPer1K, newModel.pricing.outputPer1K)
    );
  }

  /**
   * Check if price change is significant (above threshold percentage)
   */
  private hasSignificantPriceChange(oldPrice: number, newPrice: number): boolean {
    if (oldPrice === newPrice) return false;
    if (oldPrice === 0) return newPrice !== 0;

    const changePercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
    return changePercent >= this.config.minPriceChangePercent;
  }
}

// ============================================================================
// Singleton Instance (optional, for convenience)
// ============================================================================

let globalSyncService: ModelSyncService | null = null;

/**
 * Get or create the global sync service instance
 */
export function getModelSyncService(config?: ModelSyncConfig): ModelSyncService {
  if (!globalSyncService) {
    globalSyncService = new ModelSyncService(config);
  }
  return globalSyncService;
}

/**
 * Reset the global sync service (useful for testing)
 */
export function resetModelSyncService(): void {
  if (globalSyncService) {
    globalSyncService.stop();
    globalSyncService = null;
  }
}
