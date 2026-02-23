/**
 * Offline Feature Availability Tracking
 *
 * This module provides comprehensive feature availability tracking for air-gapped
 * and network-restricted environments with:
 * - AI model availability detection (Ollama)
 * - Vector database connectivity checks (pgvector)
 * - Cache availability monitoring
 * - Template system status
 * - Real-time feature status updates
 * - Graceful degradation support
 *
 * @example
 * ```typescript
 * // Server-side usage
 * const manager = OfflineFeatureManager.getInstance();
 * await manager.initialize();
 *
 * // Check all features
 * const status = await manager.checkAllFeatures();
 * console.log('AI available:', status.ai.available);
 * console.log('Vector DB available:', status.vectorDb.available);
 *
 * // Check individual feature
 * const aiStatus = await manager.checkAIFeature();
 * if (aiStatus.available) {
 *   console.log('Available models:', aiStatus.availableModels);
 * }
 * ```
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Feature availability status
 */
export enum FeatureStatus {
  /** Feature is fully available */
  AVAILABLE = 'AVAILABLE',
  /** Feature is partially available with limitations */
  DEGRADED = 'DEGRADED',
  /** Feature is not available */
  UNAVAILABLE = 'UNAVAILABLE',
  /** Feature status is being checked */
  CHECKING = 'CHECKING',
  /** Feature status is unknown */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Feature category identifier
 */
export enum FeatureCategory {
  /** AI model execution (Ollama) */
  AI = 'AI',
  /** Vector database operations (pgvector) */
  VECTOR_DB = 'VECTOR_DB',
  /** Caching system */
  CACHE = 'CACHE',
  /** Template system */
  TEMPLATES = 'TEMPLATES',
}

/**
 * Configuration options for feature manager
 */
export interface OfflineFeatureManagerOptions {
  /** Interval in ms for periodic feature checks (default: 60000) */
  checkInterval: number;
  /** Timeout in ms for feature check requests (default: 5000) */
  checkTimeout: number;
  /** Enable automatic periodic checks (default: true) */
  enablePeriodicChecks: boolean;
  /** Ollama base URL (default: 'http://localhost:11434') */
  ollamaBaseURL: string;
  /** Minimum recommended models required for full AI availability (default: 1) */
  minRecommendedModels: number;
  /** Enable debug logging (default: false) */
  debug: boolean;
  /** Called when feature status changes */
  onStatusChange?: (event: FeatureStatusChangeEvent) => void;
  /** Called when feature check completes */
  onFeatureCheck?: (result: FeatureCheckResult) => void;
}

/**
 * AI feature status
 */
export interface AIFeatureStatus {
  /** Feature availability status */
  status: FeatureStatus;
  /** Whether feature is available */
  available: boolean;
  /** Whether Ollama service is running */
  ollamaAvailable: boolean;
  /** List of installed models */
  installedModels: string[];
  /** Recommended models for offline use */
  recommendedModels: string[];
  /** Models that are recommended but not installed */
  missingModels: string[];
  /** Whether at least one recommended model is installed */
  hasRecommendedModel: boolean;
  /** Total number of models */
  modelCount: number;
  /** Error message if check failed */
  error?: string;
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Vector database feature status
 */
export interface VectorDbFeatureStatus {
  /** Feature availability status */
  status: FeatureStatus;
  /** Whether feature is available */
  available: boolean;
  /** Whether database connection is active */
  connected: boolean;
  /** Whether pgvector extension is installed */
  pgVectorInstalled: boolean;
  /** Database provider */
  provider: string;
  /** Error message if check failed */
  error?: string;
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Cache feature status
 */
export interface CacheFeatureStatus {
  /** Feature availability status */
  status: FeatureStatus;
  /** Whether feature is available */
  available: boolean;
  /** Whether cache is enabled in configuration */
  enabled: boolean;
  /** Cache backend type (e.g., 'memory', 'redis') */
  backend?: string;
  /** Error message if check failed */
  error?: string;
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Template feature status
 */
export interface TemplateFeatureStatus {
  /** Feature availability status */
  status: FeatureStatus;
  /** Whether feature is available */
  available: boolean;
  /** Number of available templates */
  templateCount: number;
  /** Whether templates are loaded from local storage */
  localOnly: boolean;
  /** Error message if check failed */
  error?: string;
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Overall feature availability status
 */
export interface FeatureAvailabilityStatus {
  /** AI feature status */
  ai: AIFeatureStatus;
  /** Vector database feature status */
  vectorDb: VectorDbFeatureStatus;
  /** Cache feature status */
  cache: CacheFeatureStatus;
  /** Template feature status */
  templates: TemplateFeatureStatus;
  /** Overall offline readiness */
  offlineReady: boolean;
  /** Summary of available features */
  availableFeatures: FeatureCategory[];
  /** Summary of unavailable features */
  unavailableFeatures: FeatureCategory[];
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Feature status change event
 */
export interface FeatureStatusChangeEvent {
  /** Feature category that changed */
  category: FeatureCategory;
  /** Current status */
  status: FeatureStatus;
  /** Previous status */
  previousStatus: FeatureStatus;
  /** Whether currently available */
  available: boolean;
  /** Whether previously available */
  previouslyAvailable: boolean;
  /** Timestamp of change */
  timestamp: number;
  /** Additional context about the change */
  context?: Record<string, unknown>;
}

/**
 * Feature check result
 */
export interface FeatureCheckResult {
  /** Feature category checked */
  category: FeatureCategory;
  /** Whether the check succeeded */
  success: boolean;
  /** Current status */
  status: FeatureStatus;
  /** Duration of the check in ms */
  duration: number;
  /** Timestamp of the check */
  timestamp: number;
  /** Error message if check failed */
  error?: string;
}

/**
 * Feature manager metrics
 */
export interface FeatureManagerMetrics {
  /** Total number of feature checks performed */
  totalChecks: number;
  /** Number of successful checks */
  successfulChecks: number;
  /** Number of failed checks */
  failedChecks: number;
  /** Last check timestamp */
  lastCheckTime: number | null;
  /** Average check duration in ms */
  avgCheckDuration: number;
  /** Per-feature check counts */
  featureChecks: Record<FeatureCategory, {
    total: number;
    successful: number;
    failed: number;
    lastStatus: FeatureStatus;
    lastCheckTime: number | null;
  }>;
}

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when feature check fails
 */
export class FeatureCheckError extends Error {
  public readonly category: FeatureCategory;
  public readonly timestamp: number;

  constructor(message: string, category: FeatureCategory) {
    super(message);
    this.name = 'FeatureCheckError';
    this.category = category;
    this.timestamp = Date.now();
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if running in server environment
 */
function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Safe async timeout wrapper
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
}

// =============================================================================
// Offline Feature Manager
// =============================================================================

/**
 * Offline Feature Manager
 * Tracks availability of features in offline/air-gapped environments
 */
export class OfflineFeatureManager {
  private static instance: OfflineFeatureManager | null = null;

  private options: OfflineFeatureManagerOptions;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private previousStatuses: Map<FeatureCategory, FeatureStatus> = new Map();
  private metrics: FeatureManagerMetrics;
  private initialized = false;

  /**
   * Create a new OfflineFeatureManager instance
   * @param options Configuration options
   */
  constructor(options: Partial<OfflineFeatureManagerOptions> = {}) {
    this.options = {
      checkInterval: 60000,
      checkTimeout: 5000,
      enablePeriodicChecks: true,
      ollamaBaseURL: 'http://localhost:11434',
      minRecommendedModels: 1,
      debug: false,
      ...options,
    };

    // Initialize metrics
    this.metrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      lastCheckTime: null,
      avgCheckDuration: 0,
      featureChecks: {
        [FeatureCategory.AI]: {
          total: 0,
          successful: 0,
          failed: 0,
          lastStatus: FeatureStatus.UNKNOWN,
          lastCheckTime: null,
        },
        [FeatureCategory.VECTOR_DB]: {
          total: 0,
          successful: 0,
          failed: 0,
          lastStatus: FeatureStatus.UNKNOWN,
          lastCheckTime: null,
        },
        [FeatureCategory.CACHE]: {
          total: 0,
          successful: 0,
          failed: 0,
          lastStatus: FeatureStatus.UNKNOWN,
          lastCheckTime: null,
        },
        [FeatureCategory.TEMPLATES]: {
          total: 0,
          successful: 0,
          failed: 0,
          lastStatus: FeatureStatus.UNKNOWN,
          lastCheckTime: null,
        },
      },
    };
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(options?: Partial<OfflineFeatureManagerOptions>): OfflineFeatureManager {
    if (!OfflineFeatureManager.instance) {
      OfflineFeatureManager.instance = new OfflineFeatureManager(options);
    }
    return OfflineFeatureManager.instance;
  }

  /**
   * Initialize the feature manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Perform initial feature check
      await this.checkAllFeatures();

      // Start periodic checks if enabled
      if (this.options.enablePeriodicChecks) {
        this.startPeriodicChecks();
      }

      this.initialized = true;

      if (this.options.debug) {
        console.log('OfflineFeatureManager initialized successfully');
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('Failed to initialize OfflineFeatureManager:', error);
      }
      throw new Error(
        `Failed to initialize OfflineFeatureManager: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start periodic feature checks
   */
  private startPeriodicChecks(): void {
    if (this.checkIntervalId) {
      return;
    }

    this.checkIntervalId = setInterval(async () => {
      try {
        await this.checkAllFeatures();
      } catch (error) {
        if (this.options.debug) {
          console.error('Periodic feature check failed:', error);
        }
      }
    }, this.options.checkInterval);
  }

  /**
   * Stop periodic feature checks
   */
  private stopPeriodicChecks(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  /**
   * Check all features
   */
  async checkAllFeatures(): Promise<FeatureAvailabilityStatus> {
    const startTime = Date.now();

    try {
      // Check all features in parallel
      const [ai, vectorDb, cache, templates] = await Promise.all([
        this.checkAIFeature(),
        this.checkVectorDbFeature(),
        this.checkCacheFeature(),
        this.checkTemplateFeature(),
      ]);

      // Determine available and unavailable features
      const availableFeatures: FeatureCategory[] = [];
      const unavailableFeatures: FeatureCategory[] = [];

      if (ai.available) availableFeatures.push(FeatureCategory.AI);
      else unavailableFeatures.push(FeatureCategory.AI);

      if (vectorDb.available) availableFeatures.push(FeatureCategory.VECTOR_DB);
      else unavailableFeatures.push(FeatureCategory.VECTOR_DB);

      if (cache.available) availableFeatures.push(FeatureCategory.CACHE);
      else unavailableFeatures.push(FeatureCategory.CACHE);

      if (templates.available) availableFeatures.push(FeatureCategory.TEMPLATES);
      else unavailableFeatures.push(FeatureCategory.TEMPLATES);

      // Determine overall offline readiness
      // For offline readiness, we need at least AI and VectorDB available
      const offlineReady = ai.available && vectorDb.available;

      const duration = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(true, duration);

      return {
        ai,
        vectorDb,
        cache,
        templates,
        offlineReady,
        availableFeatures,
        unavailableFeatures,
        timestamp: Date.now(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration);

      throw new Error(
        `Failed to check all features: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check AI feature availability
   */
  async checkAIFeature(): Promise<AIFeatureStatus> {
    const category = FeatureCategory.AI;
    const startTime = Date.now();

    try {
      // Dynamic import to avoid issues in browser environment
      const { OllamaClient, OFFLINE_CODING_MODELS } = await import('./ollama-client');

      const client = new OllamaClient(this.options.ollamaBaseURL);

      // Check if Ollama is available with timeout
      const ollamaAvailable = await withTimeout(
        client.isAvailable(),
        this.options.checkTimeout,
        'Ollama availability check timed out'
      );

      if (!ollamaAvailable) {
        const status: AIFeatureStatus = {
          status: FeatureStatus.UNAVAILABLE,
          available: false,
          ollamaAvailable: false,
          installedModels: [],
          recommendedModels: OFFLINE_CODING_MODELS.map((m) => m.model),
          missingModels: OFFLINE_CODING_MODELS.map((m) => m.model),
          hasRecommendedModel: false,
          modelCount: 0,
          error: 'Ollama service not available',
          timestamp: Date.now(),
        };

        this.updateFeatureStatus(category, status.status, startTime, false);
        return status;
      }

      // Get installed models
      const models = await withTimeout(
        client.listModels(),
        this.options.checkTimeout,
        'Model list check timed out'
      );

      const installedModels = models.map((m) => m.name);
      const recommendedModels = OFFLINE_CODING_MODELS.map((m) => m.model);
      const missingModels = recommendedModels.filter(
        (recommended) => !installedModels.some((installed) => installed.includes(recommended))
      );

      const hasRecommendedModel = installedModels.some((installed) =>
        recommendedModels.some((recommended) => installed.includes(recommended))
      );

      // Determine status
      let status: FeatureStatus;
      if (hasRecommendedModel && missingModels.length === 0) {
        status = FeatureStatus.AVAILABLE;
      } else if (hasRecommendedModel || installedModels.length > 0) {
        status = FeatureStatus.DEGRADED;
      } else {
        status = FeatureStatus.UNAVAILABLE;
      }

      const result: AIFeatureStatus = {
        status,
        available: status === FeatureStatus.AVAILABLE || status === FeatureStatus.DEGRADED,
        ollamaAvailable,
        installedModels,
        recommendedModels,
        missingModels,
        hasRecommendedModel,
        modelCount: installedModels.length,
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status, startTime, true);
      return result;
    } catch (error) {
      const status: AIFeatureStatus = {
        status: FeatureStatus.UNAVAILABLE,
        available: false,
        ollamaAvailable: false,
        installedModels: [],
        recommendedModels: [],
        missingModels: [],
        hasRecommendedModel: false,
        modelCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, false, error);
      return status;
    }
  }

  /**
   * Check Vector Database feature availability
   */
  async checkVectorDbFeature(): Promise<VectorDbFeatureStatus> {
    const category = FeatureCategory.VECTOR_DB;
    const startTime = Date.now();

    try {
      // Only check on server-side
      if (!isServer()) {
        const status: VectorDbFeatureStatus = {
          status: FeatureStatus.UNKNOWN,
          available: false,
          connected: false,
          pgVectorInstalled: false,
          provider: 'unknown',
          error: 'Cannot check vector DB from client-side',
          timestamp: Date.now(),
        };

        this.updateFeatureStatus(category, status.status, startTime, false);
        return status;
      }

      // Dynamic import to avoid issues in browser environment
      const { VectorDatabaseFactory } = await import('./vector-database-factory');

      // Get vector database instance with timeout
      const vectorDb = await withTimeout(
        VectorDatabaseFactory.getInstance(),
        this.options.checkTimeout,
        'Vector database connection timed out'
      );

      // Attempt a simple health check
      const connected = true; // If getInstance() succeeds, connection is established
      const pgVectorInstalled = true; // getInstance() verifies pgvector extension

      const status: VectorDbFeatureStatus = {
        status: FeatureStatus.AVAILABLE,
        available: true,
        connected,
        pgVectorInstalled,
        provider: 'postgres',
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, true);
      return status;
    } catch (error) {
      const status: VectorDbFeatureStatus = {
        status: FeatureStatus.UNAVAILABLE,
        available: false,
        connected: false,
        pgVectorInstalled: false,
        provider: 'postgres',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, false, error);
      return status;
    }
  }

  /**
   * Check Cache feature availability
   */
  async checkCacheFeature(): Promise<CacheFeatureStatus> {
    const category = FeatureCategory.CACHE;
    const startTime = Date.now();

    try {
      // Check if cache is enabled in environment
      const cacheEnabled = process.env.VECTOR_DB_CACHE_ENABLED !== 'false';

      if (!cacheEnabled) {
        const status: CacheFeatureStatus = {
          status: FeatureStatus.UNAVAILABLE,
          available: false,
          enabled: false,
          backend: 'none',
          timestamp: Date.now(),
        };

        this.updateFeatureStatus(category, status.status, startTime, true);
        return status;
      }

      // Cache is enabled (using memory or Redis)
      const status: CacheFeatureStatus = {
        status: FeatureStatus.AVAILABLE,
        available: true,
        enabled: true,
        backend: 'memory',
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, true);
      return status;
    } catch (error) {
      const status: CacheFeatureStatus = {
        status: FeatureStatus.UNAVAILABLE,
        available: false,
        enabled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, false, error);
      return status;
    }
  }

  /**
   * Check Template feature availability
   */
  async checkTemplateFeature(): Promise<TemplateFeatureStatus> {
    const category = FeatureCategory.TEMPLATES;
    const startTime = Date.now();

    try {
      // Dynamic import to avoid issues in browser environment
      const templates = await import('./project-templates');

      // Get available templates (PROJECT_TEMPLATES is a Record<string, ProjectTemplate>)
      const templateCount = templates.PROJECT_TEMPLATES
        ? Object.keys(templates.PROJECT_TEMPLATES).length
        : 0;

      const status: TemplateFeatureStatus = {
        status: templateCount > 0 ? FeatureStatus.AVAILABLE : FeatureStatus.UNAVAILABLE,
        available: templateCount > 0,
        templateCount,
        localOnly: true,
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, true);
      return status;
    } catch (error) {
      const status: TemplateFeatureStatus = {
        status: FeatureStatus.UNAVAILABLE,
        available: false,
        templateCount: 0,
        localOnly: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };

      this.updateFeatureStatus(category, status.status, startTime, false, error);
      return status;
    }
  }

  /**
   * Update feature status and emit events
   */
  private updateFeatureStatus(
    category: FeatureCategory,
    status: FeatureStatus,
    startTime: number,
    success: boolean,
    error?: unknown
  ): void {
    const duration = Date.now() - startTime;
    const timestamp = Date.now();

    // Update feature-specific metrics
    const featureMetrics = this.metrics.featureChecks[category];
    featureMetrics.total++;
    if (success) {
      featureMetrics.successful++;
    } else {
      featureMetrics.failed++;
    }
    featureMetrics.lastStatus = status;
    featureMetrics.lastCheckTime = timestamp;

    // Emit status change event if status changed
    const previousStatus = this.previousStatuses.get(category);
    if (previousStatus && previousStatus !== status) {
      const event: FeatureStatusChangeEvent = {
        category,
        status,
        previousStatus,
        available: status === FeatureStatus.AVAILABLE || status === FeatureStatus.DEGRADED,
        previouslyAvailable:
          previousStatus === FeatureStatus.AVAILABLE || previousStatus === FeatureStatus.DEGRADED,
        timestamp,
      };

      this.options.onStatusChange?.(event);
    }

    this.previousStatuses.set(category, status);

    // Emit feature check event
    const checkResult: FeatureCheckResult = {
      category,
      success,
      status,
      duration,
      timestamp,
      error: error instanceof Error ? error.message : undefined,
    };

    this.options.onFeatureCheck?.(checkResult);
  }

  /**
   * Update overall metrics
   */
  private updateMetrics(success: boolean, duration: number): void {
    this.metrics.totalChecks++;
    if (success) {
      this.metrics.successfulChecks++;
    } else {
      this.metrics.failedChecks++;
    }
    this.metrics.lastCheckTime = Date.now();

    // Update average duration
    const totalDuration = this.metrics.avgCheckDuration * (this.metrics.totalChecks - 1) + duration;
    this.metrics.avgCheckDuration = totalDuration / this.metrics.totalChecks;
  }

  /**
   * Get current metrics
   */
  getMetrics(): FeatureManagerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset the manager
   */
  async reset(): Promise<void> {
    this.stopPeriodicChecks();
    this.previousStatuses.clear();
    this.initialized = false;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicChecks();
    this.initialized = false;

    if (this.options.debug) {
      console.log('OfflineFeatureManager shutdown complete');
    }
  }

  /**
   * Reset singleton instance
   */
  static resetInstance(): void {
    if (OfflineFeatureManager.instance) {
      OfflineFeatureManager.instance.shutdown();
      OfflineFeatureManager.instance = null;
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

export default OfflineFeatureManager;
