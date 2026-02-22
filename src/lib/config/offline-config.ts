/**
 * Offline Mode Configuration Storage
 *
 * This module provides persistent storage and management for offline mode preferences
 * including:
 * - Auto-fallback to local models when offline
 * - Preferred local model selection
 * - Cached resource verification settings
 * - Offline mode enablement preferences
 *
 * Supports both browser (localStorage) and server-side storage with automatic
 * environment detection.
 *
 * @example
 * ```typescript
 * // Get current configuration
 * const config = await getOfflineConfig();
 * console.log(config.autoFallbackEnabled);
 *
 * // Update configuration
 * await updateOfflineConfig({
 *   autoFallbackEnabled: true,
 *   preferredLocalModel: 'qwen2.5-coder:1.5b',
 * });
 *
 * // Reset to defaults
 * await resetOfflineConfig();
 * ```
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Offline mode configuration settings
 */
export interface OfflineConfig {
  /** Enable automatic fallback to local models when offline (default: true) */
  autoFallbackEnabled: boolean;
  /** Preferred local model for code generation (default: 'qwen2.5-coder:1.5b') */
  preferredLocalModel: string;
  /** Alternative local models to try if preferred is unavailable */
  fallbackLocalModels: string[];
  /** Enable cached resource verification on startup (default: true) */
  verifyCachedResources: boolean;
  /** Interval in ms for offline status polling (default: 30000) */
  offlineCheckInterval: number;
  /** Show notifications when offline mode activates (default: true) */
  showOfflineNotifications: boolean;
  /** Automatically download recommended models on first run (default: false) */
  autoDownloadModels: boolean;
  /** Maximum cache size in MB for offline resources (default: 500) */
  maxCacheSizeMB: number;
  /** TTL in seconds for cached resources (default: 86400 = 24 hours) */
  cacheResourceTTL: number;
  /** Enable metrics tracking for offline mode usage (default: true) */
  enableMetrics: boolean;
  /** Timestamp of last configuration update */
  lastUpdated: number;
  /** Configuration version for migration support */
  version: string;
}

/**
 * Partial configuration for updates (all fields optional)
 */
export type PartialOfflineConfig = Partial<OfflineConfig>;

/**
 * Validation result for configuration
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  /** Validation errors if invalid */
  errors: string[];
  /** Warnings that don't prevent usage */
  warnings: string[];
}

/**
 * Storage backend type
 */
export enum StorageBackend {
  /** Browser localStorage */
  LOCAL_STORAGE = 'LOCAL_STORAGE',
  /** Server-side file storage */
  FILE_SYSTEM = 'FILE_SYSTEM',
  /** In-memory storage (non-persistent) */
  MEMORY = 'MEMORY',
}

// =============================================================================
// Constants and Defaults
// =============================================================================

/**
 * Current configuration version
 */
export const CONFIG_VERSION = '1.0.0';

/**
 * LocalStorage key for offline configuration
 */
export const OFFLINE_CONFIG_KEY = 'harness:offline-config';

/**
 * Default offline configuration
 */
export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  autoFallbackEnabled: true,
  preferredLocalModel: 'qwen2.5-coder:1.5b',
  fallbackLocalModels: [
    'qwen2.5-coder:7b',
    'codellama:7b',
    'deepseek-coder:6.7b',
    'starcoder2:7b',
  ],
  verifyCachedResources: true,
  offlineCheckInterval: 30000, // 30 seconds
  showOfflineNotifications: true,
  autoDownloadModels: false,
  maxCacheSizeMB: 500,
  cacheResourceTTL: 86400, // 24 hours
  enableMetrics: true,
  lastUpdated: Date.now(),
  version: CONFIG_VERSION,
};

/**
 * Recommended local models for different use cases
 */
export const RECOMMENDED_MODELS = {
  /** Fast, lightweight model for quick responses */
  fast: 'qwen2.5-coder:1.5b',
  /** Balanced model for general coding */
  balanced: 'qwen2.5-coder:7b',
  /** High-quality model for complex tasks */
  quality: 'deepseek-coder:6.7b',
} as const;

/**
 * Minimum cache size in MB
 */
export const MIN_CACHE_SIZE_MB = 100;

/**
 * Maximum cache size in MB
 */
export const MAX_CACHE_SIZE_MB = 10000;

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when configuration validation fails
 */
export class ConfigValidationError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(message);
    this.name = 'ConfigValidationError';
    this.errors = errors;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigValidationError);
    }
  }
}

/**
 * Error thrown when storage operations fail
 */
export class ConfigStorageError extends Error {
  public readonly operation: string;
  public readonly backend: StorageBackend;

  constructor(message: string, operation: string, backend: StorageBackend) {
    super(message);
    this.name = 'ConfigStorageError';
    this.operation = operation;
    this.backend = backend;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigStorageError);
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Detect appropriate storage backend
 */
function detectStorageBackend(): StorageBackend {
  if (isBrowser()) {
    return StorageBackend.LOCAL_STORAGE;
  }
  // In server environment, use memory storage by default
  // File system storage can be explicitly enabled
  return StorageBackend.MEMORY;
}

/**
 * Validate offline configuration
 */
export function validateConfig(config: Partial<OfflineConfig>): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate offlineCheckInterval
  if (config.offlineCheckInterval !== undefined) {
    if (config.offlineCheckInterval < 5000) {
      errors.push('offlineCheckInterval must be at least 5000ms (5 seconds)');
    }
    if (config.offlineCheckInterval > 300000) {
      warnings.push('offlineCheckInterval is very high (>5 minutes), may delay offline detection');
    }
  }

  // Validate maxCacheSizeMB
  if (config.maxCacheSizeMB !== undefined) {
    if (config.maxCacheSizeMB < MIN_CACHE_SIZE_MB) {
      errors.push(`maxCacheSizeMB must be at least ${MIN_CACHE_SIZE_MB}MB`);
    }
    if (config.maxCacheSizeMB > MAX_CACHE_SIZE_MB) {
      errors.push(`maxCacheSizeMB cannot exceed ${MAX_CACHE_SIZE_MB}MB`);
    }
  }

  // Validate cacheResourceTTL
  if (config.cacheResourceTTL !== undefined) {
    if (config.cacheResourceTTL < 60) {
      errors.push('cacheResourceTTL must be at least 60 seconds');
    }
  }

  // Validate preferredLocalModel
  if (config.preferredLocalModel !== undefined) {
    if (!config.preferredLocalModel || config.preferredLocalModel.trim() === '') {
      errors.push('preferredLocalModel cannot be empty');
    }
  }

  // Validate fallbackLocalModels
  if (config.fallbackLocalModels !== undefined) {
    if (!Array.isArray(config.fallbackLocalModels)) {
      errors.push('fallbackLocalModels must be an array');
    } else if (config.fallbackLocalModels.length === 0) {
      warnings.push('No fallback models configured, may fail if preferred model unavailable');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merge partial configuration with defaults
 */
function mergeWithDefaults(partial: PartialOfflineConfig): OfflineConfig {
  return {
    ...DEFAULT_OFFLINE_CONFIG,
    ...partial,
    lastUpdated: Date.now(),
    version: CONFIG_VERSION,
  };
}

// =============================================================================
// Storage Implementations
// =============================================================================

/**
 * In-memory configuration storage (non-persistent)
 */
class MemoryConfigStorage {
  private config: OfflineConfig = { ...DEFAULT_OFFLINE_CONFIG };

  async get(): Promise<OfflineConfig> {
    return { ...this.config };
  }

  async set(config: OfflineConfig): Promise<void> {
    this.config = { ...config };
  }

  async clear(): Promise<void> {
    this.config = { ...DEFAULT_OFFLINE_CONFIG };
  }
}

/**
 * Browser localStorage-based configuration storage
 */
class LocalStorageConfigStorage {
  async get(): Promise<OfflineConfig> {
    try {
      const stored = localStorage.getItem(OFFLINE_CONFIG_KEY);
      if (!stored) {
        return { ...DEFAULT_OFFLINE_CONFIG };
      }

      const parsed = JSON.parse(stored);
      return mergeWithDefaults(parsed);
    } catch (error) {
      throw new ConfigStorageError(
        `Failed to read configuration from localStorage: ${error instanceof Error ? error.message : String(error)}`,
        'get',
        StorageBackend.LOCAL_STORAGE
      );
    }
  }

  async set(config: OfflineConfig): Promise<void> {
    try {
      const serialized = JSON.stringify(config);
      localStorage.setItem(OFFLINE_CONFIG_KEY, serialized);
    } catch (error) {
      throw new ConfigStorageError(
        `Failed to write configuration to localStorage: ${error instanceof Error ? error.message : String(error)}`,
        'set',
        StorageBackend.LOCAL_STORAGE
      );
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(OFFLINE_CONFIG_KEY);
    } catch (error) {
      throw new ConfigStorageError(
        `Failed to clear configuration from localStorage: ${error instanceof Error ? error.message : String(error)}`,
        'clear',
        StorageBackend.LOCAL_STORAGE
      );
    }
  }
}

// =============================================================================
// Storage Factory
// =============================================================================

/**
 * Get appropriate storage implementation based on environment
 */
function getStorage(backend?: StorageBackend): MemoryConfigStorage | LocalStorageConfigStorage {
  const selectedBackend = backend || detectStorageBackend();

  switch (selectedBackend) {
    case StorageBackend.LOCAL_STORAGE:
      return new LocalStorageConfigStorage();
    case StorageBackend.MEMORY:
    case StorageBackend.FILE_SYSTEM: // Fall back to memory for now
      return new MemoryConfigStorage();
    default:
      return new MemoryConfigStorage();
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get current offline configuration
 *
 * @param backend - Optional storage backend override
 * @returns Current offline configuration
 * @throws {ConfigStorageError} If storage read fails
 */
export async function getOfflineConfig(backend?: StorageBackend): Promise<OfflineConfig> {
  const storage = getStorage(backend);
  return storage.get();
}

/**
 * Update offline configuration
 *
 * Validates the configuration before saving. Throws if validation fails.
 *
 * @param updates - Partial configuration to update
 * @param backend - Optional storage backend override
 * @throws {ConfigValidationError} If configuration is invalid
 * @throws {ConfigStorageError} If storage write fails
 */
export async function updateOfflineConfig(
  updates: PartialOfflineConfig,
  backend?: StorageBackend
): Promise<OfflineConfig> {
  // Validate updates
  const validation = validateConfig(updates);
  if (!validation.valid) {
    throw new ConfigValidationError(
      `Invalid offline configuration: ${validation.errors.join(', ')}`,
      validation.errors
    );
  }

  // Get current config
  const storage = getStorage(backend);
  const current = await storage.get();

  // Merge and save
  const updated = mergeWithDefaults({ ...current, ...updates });
  await storage.set(updated);

  return updated;
}

/**
 * Reset offline configuration to defaults
 *
 * @param backend - Optional storage backend override
 * @throws {ConfigStorageError} If storage write fails
 */
export async function resetOfflineConfig(backend?: StorageBackend): Promise<OfflineConfig> {
  const storage = getStorage(backend);
  const defaults = { ...DEFAULT_OFFLINE_CONFIG };
  await storage.set(defaults);
  return defaults;
}

/**
 * Clear offline configuration (remove from storage)
 *
 * @param backend - Optional storage backend override
 * @throws {ConfigStorageError} If storage clear fails
 */
export async function clearOfflineConfig(backend?: StorageBackend): Promise<void> {
  const storage = getStorage(backend);
  await storage.clear();
}

/**
 * Get recommended model for a specific use case
 *
 * @param useCase - Use case identifier ('fast', 'balanced', 'quality')
 * @returns Recommended model name
 */
export function getRecommendedModel(useCase: keyof typeof RECOMMENDED_MODELS): string {
  return RECOMMENDED_MODELS[useCase];
}

/**
 * Check if a configuration value is at default
 *
 * @param key - Configuration key to check
 * @param config - Configuration to check against
 * @returns True if the value matches the default
 */
export function isDefaultValue<K extends keyof OfflineConfig>(
  key: K,
  config: OfflineConfig
): boolean {
  return config[key] === DEFAULT_OFFLINE_CONFIG[key];
}

/**
 * Get configuration diff between current and defaults
 *
 * @param config - Configuration to compare
 * @returns Object with keys that differ from defaults
 */
export function getConfigDiff(config: OfflineConfig): PartialOfflineConfig {
  const diff: PartialOfflineConfig = {};

  for (const key in config) {
    const configKey = key as keyof OfflineConfig;
    if (config[configKey] !== DEFAULT_OFFLINE_CONFIG[configKey]) {
      diff[configKey] = config[configKey] as any;
    }
  }

  return diff;
}

/**
 * Export configuration as JSON string
 *
 * @param config - Configuration to export
 * @param pretty - Whether to format JSON with indentation
 * @returns JSON string representation
 */
export function exportConfig(config: OfflineConfig, pretty = true): string {
  return JSON.stringify(config, null, pretty ? 2 : 0);
}

/**
 * Import configuration from JSON string
 *
 * @param json - JSON string to import
 * @returns Parsed configuration
 * @throws {ConfigValidationError} If imported config is invalid
 */
export function importConfig(json: string): OfflineConfig {
  try {
    const parsed = JSON.parse(json);
    const validation = validateConfig(parsed);

    if (!validation.valid) {
      throw new ConfigValidationError(
        `Invalid imported configuration: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    return mergeWithDefaults(parsed);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }
    throw new ConfigValidationError(
      `Failed to parse configuration JSON: ${error instanceof Error ? error.message : String(error)}`,
      ['Invalid JSON format']
    );
  }
}
