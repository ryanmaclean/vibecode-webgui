/**
 * Settings Manager for VibeCode
 *
 * Singleton service for managing application settings with:
 * - Local storage persistence (browser)
 * - File system persistence (Tauri/desktop)
 * - Type-safe access to all settings
 * - Migration support for version changes
 * - Observer pattern for reactive updates
 * - Validation before persistence
 *
 * @module lib/settings/settings-manager
 */

import type {
  AppSettings,
  GeneralSettings,
  ServiceSettings,
  AISettings,
  AdvancedSettings,
  SettingsChangeEvent,
  SettingsObserver,
  SettingsValidationResult,
  SettingsMigration,
  ThemeMode,
  LogLevel,
} from '@/types/settings';

import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SERVICE_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_ADVANCED_SETTINGS,
} from '@/types/settings';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'vibecode-settings';
const CURRENT_VERSION = 1;

// ============================================================================
// Migration Registry
// ============================================================================

/**
 * Migration functions indexed by version
 * Each migration upgrades from version N to N+1
 */
const MIGRATIONS: Record<number, SettingsMigration> = {
  // Example: Migration from version 0 to 1
  // 0: (settings) => {
  //   return {
  //     ...DEFAULT_APP_SETTINGS,
  //     ...settings,
  //     version: 1,
  //     // Add any new fields or transform existing ones
  //   };
  // },
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate port number
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate temperature value
 */
function isValidTemperature(temp: number): boolean {
  return typeof temp === 'number' && temp >= 0 && temp <= 2;
}

/**
 * Validate timeout value
 */
function isValidTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout >= 0 && timeout <= 3600000; // Max 1 hour
}

/**
 * Validate log level
 */
function isValidLogLevel(level: string): level is LogLevel {
  return ['error', 'warn', 'info', 'debug', 'trace'].includes(level);
}

/**
 * Validate theme mode
 */
function isValidTheme(theme: string): theme is ThemeMode {
  return ['light', 'dark', 'system'].includes(theme);
}

// ============================================================================
// Settings Manager Class
// ============================================================================

/**
 * Singleton class for managing application settings
 */
export class SettingsManager {
  private static instance: SettingsManager | null = null;
  private settings: AppSettings;
  private observers: Set<SettingsObserver> = new Set();
  private isDirty: boolean = false;
  private isTauriEnvironment: boolean = false;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.settings = { ...DEFAULT_APP_SETTINGS };
    this.detectEnvironment();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void {
    SettingsManager.instance = null;
  }

  /**
   * Detect if running in Tauri environment
   */
  private detectEnvironment(): void {
    if (typeof window !== 'undefined') {
      // Check for Tauri-specific APIs
      this.isTauriEnvironment = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
    }
  }

  // ==========================================================================
  // Persistence Methods
  // ==========================================================================

  /**
   * Load settings from storage
   */
  public async load(): Promise<AppSettings> {
    try {
      let storedSettings: Partial<AppSettings> | null = null;

      if (this.isTauriEnvironment) {
        storedSettings = await this.loadFromTauri();
      } else if (typeof window !== 'undefined' && window.localStorage) {
        storedSettings = this.loadFromLocalStorage();
      }

      if (storedSettings) {
        // Run migrations if needed
        const migratedSettings = this.migrateSettings(storedSettings);
        this.settings = this.mergeWithDefaults(migratedSettings);
      } else {
        this.settings = { ...DEFAULT_APP_SETTINGS };
      }

      this.isDirty = false;
      return this.settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...DEFAULT_APP_SETTINGS };
      return this.settings;
    }
  }

  /**
   * Save settings to storage
   */
  public async save(): Promise<boolean> {
    try {
      // Update last modified timestamp
      this.settings.lastModified = new Date().toISOString();

      if (this.isTauriEnvironment) {
        await this.saveToTauri();
      } else if (typeof window !== 'undefined' && window.localStorage) {
        this.saveToLocalStorage();
      }

      this.isDirty = false;
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Load settings from localStorage
   */
  private loadFromLocalStorage(): Partial<AppSettings> | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        console.warn('Failed to parse stored settings');
        return null;
      }
    }
    return null;
  }

  /**
   * Save settings to localStorage
   */
  private saveToLocalStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }

  /**
   * Load settings from Tauri filesystem
   */
  private async loadFromTauri(): Promise<Partial<AppSettings> | null> {
    try {
      // Dynamic import to avoid SSR issues - type assertion needed since
      // @tauri-apps/api is only available at runtime in the Tauri shell
      const tauriCore: { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> } =
        await import(/* webpackIgnore: true */ '@tauri-apps/api/core' as string);
      const settingsJson = await tauriCore.invoke<string>('load_settings');
      return settingsJson ? JSON.parse(settingsJson) : null;
    } catch (error) {
      console.warn('Tauri settings load failed, falling back to localStorage:', error);
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Save settings to Tauri filesystem
   */
  private async saveToTauri(): Promise<void> {
    try {
      const tauriCore: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } =
        await import(/* webpackIgnore: true */ '@tauri-apps/api/core' as string);
      await tauriCore.invoke('save_settings', { settings: JSON.stringify(this.settings) });
    } catch (error) {
      console.warn('Tauri settings save failed, falling back to localStorage:', error);
      this.saveToLocalStorage();
    }
  }

  // ==========================================================================
  // Migration Methods
  // ==========================================================================

  /**
   * Run necessary migrations on loaded settings
   */
  private migrateSettings(settings: Partial<AppSettings>): Partial<AppSettings> {
    let currentSettings = { ...settings };
    const fromVersion = settings.version ?? 0;

    for (let version = fromVersion; version < CURRENT_VERSION; version++) {
      const migration = MIGRATIONS[version];
      if (migration) {
        currentSettings = migration(currentSettings);
        console.log(`Migrated settings from v${version} to v${version + 1}`);
      }
    }

    currentSettings.version = CURRENT_VERSION;
    return currentSettings;
  }

  /**
   * Merge partial settings with defaults
   */
  private mergeWithDefaults(partial: Partial<AppSettings>): AppSettings {
    return {
      version: partial.version ?? CURRENT_VERSION,
      general: { ...DEFAULT_GENERAL_SETTINGS, ...partial.general },
      services: {
        ...DEFAULT_SERVICE_SETTINGS,
        ...partial.services,
        ports: {
          ...DEFAULT_SERVICE_SETTINGS.ports,
          ...partial.services?.ports,
        },
        timeouts: {
          ...DEFAULT_SERVICE_SETTINGS.timeouts,
          ...partial.services?.timeouts,
        },
      },
      ai: {
        ...DEFAULT_AI_SETTINGS,
        ...partial.ai,
        availableModels: partial.ai?.availableModels ?? DEFAULT_AI_SETTINGS.availableModels,
        apiKeys: partial.ai?.apiKeys ?? [],
      },
      advanced: {
        ...DEFAULT_ADVANCED_SETTINGS,
        ...partial.advanced,
        telemetry: {
          ...DEFAULT_ADVANCED_SETTINGS.telemetry,
          ...partial.advanced?.telemetry,
        },
      },
      lastModified: partial.lastModified ?? new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Getter Methods
  // ==========================================================================

  /**
   * Get all settings
   */
  public getAll(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Get general settings
   */
  public getGeneral(): GeneralSettings {
    return { ...this.settings.general };
  }

  /**
   * Get service settings
   */
  public getServices(): ServiceSettings {
    return {
      ...this.settings.services,
      ports: { ...this.settings.services.ports },
      timeouts: { ...this.settings.services.timeouts },
    };
  }

  /**
   * Get AI settings
   */
  public getAI(): AISettings {
    return {
      ...this.settings.ai,
      apiKeys: [...this.settings.ai.apiKeys],
      availableModels: [...this.settings.ai.availableModels],
    };
  }

  /**
   * Get advanced settings
   */
  public getAdvanced(): AdvancedSettings {
    return {
      ...this.settings.advanced,
      telemetry: { ...this.settings.advanced.telemetry },
    };
  }

  /**
   * Get a specific setting by path
   */
  public get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Check if settings have unsaved changes
   */
  public hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  // ==========================================================================
  // Setter Methods
  // ==========================================================================

  /**
   * Update general settings
   */
  public setGeneral(settings: Partial<GeneralSettings>): void {
    const previous = { ...this.settings.general };
    this.settings.general = { ...this.settings.general, ...settings };
    this.isDirty = true;
    this.notifyObservers('general', previous, this.settings.general);
  }

  /**
   * Update service settings
   */
  public setServices(settings: Partial<ServiceSettings>): void {
    const previous = { ...this.settings.services };
    this.settings.services = {
      ...this.settings.services,
      ...settings,
      ports: settings.ports
        ? { ...this.settings.services.ports, ...settings.ports }
        : this.settings.services.ports,
      timeouts: settings.timeouts
        ? { ...this.settings.services.timeouts, ...settings.timeouts }
        : this.settings.services.timeouts,
    };
    this.isDirty = true;
    this.notifyObservers('services', previous, this.settings.services);
  }

  /**
   * Update AI settings
   */
  public setAI(settings: Partial<AISettings>): void {
    const previous = { ...this.settings.ai };
    this.settings.ai = { ...this.settings.ai, ...settings };
    this.isDirty = true;
    this.notifyObservers('ai', previous, this.settings.ai);
  }

  /**
   * Update advanced settings
   */
  public setAdvanced(settings: Partial<AdvancedSettings>): void {
    const previous = { ...this.settings.advanced };
    this.settings.advanced = {
      ...this.settings.advanced,
      ...settings,
      telemetry: settings.telemetry
        ? { ...this.settings.advanced.telemetry, ...settings.telemetry }
        : this.settings.advanced.telemetry,
    };
    this.isDirty = true;
    this.notifyObservers('advanced', previous, this.settings.advanced);
  }

  /**
   * Update all settings at once
   */
  public setAll(settings: { general?: Partial<GeneralSettings>; services?: Partial<ServiceSettings>; ai?: Partial<AISettings>; advanced?: Partial<AdvancedSettings> }): void {
    if (settings.general) this.setGeneral(settings.general);
    if (settings.services) this.setServices(settings.services);
    if (settings.ai) this.setAI(settings.ai);
    if (settings.advanced) this.setAdvanced(settings.advanced);
  }

  /**
   * Reset settings to defaults
   */
  public resetToDefaults(): void {
    const previous = { ...this.settings };
    this.settings = {
      ...DEFAULT_APP_SETTINGS,
      lastModified: new Date().toISOString(),
    };
    this.isDirty = true;

    // Notify for each category
    this.notifyObservers('general', previous.general, this.settings.general);
    this.notifyObservers('services', previous.services, this.settings.services);
    this.notifyObservers('ai', previous.ai, this.settings.ai);
    this.notifyObservers('advanced', previous.advanced, this.settings.advanced);
  }

  /**
   * Reset a specific category to defaults
   */
  public resetCategory<K extends 'general' | 'services' | 'ai' | 'advanced'>(
    category: K
  ): void {
    const previous = this.settings[category];
    const defaults = {
      general: DEFAULT_GENERAL_SETTINGS,
      services: DEFAULT_SERVICE_SETTINGS,
      ai: DEFAULT_AI_SETTINGS,
      advanced: DEFAULT_ADVANCED_SETTINGS,
    };

    // Type-safe assignment
    (this.settings as unknown as Record<string, unknown>)[category] = { ...defaults[category] };
    this.isDirty = true;
    this.notifyObservers(category, previous, this.settings[category]);
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate all settings
   */
  public validate(): SettingsValidationResult {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Validate general settings
    if (!isValidTheme(this.settings.general.theme)) {
      errors['general.theme'] = 'Invalid theme mode';
    }
    if (this.settings.general.autoSaveInterval < 0) {
      errors['general.autoSaveInterval'] = 'Auto-save interval cannot be negative';
    }

    // Validate service settings
    const { ports, timeouts } = this.settings.services;
    if (!isValidPort(ports.app)) {
      errors['services.ports.app'] = 'Invalid app port (must be 1-65535)';
    }
    if (!isValidPort(ports.aiGateway)) {
      errors['services.ports.aiGateway'] = 'Invalid AI gateway port (must be 1-65535)';
    }
    if (!isValidPort(ports.database)) {
      errors['services.ports.database'] = 'Invalid database port (must be 1-65535)';
    }
    if (!isValidTimeout(timeouts.connection)) {
      errors['services.timeouts.connection'] = 'Invalid connection timeout';
    }
    if (!isValidTimeout(timeouts.request)) {
      errors['services.timeouts.request'] = 'Invalid request timeout';
    }

    // Validate AI settings
    if (!isValidTemperature(this.settings.ai.temperature)) {
      errors['ai.temperature'] = 'Temperature must be between 0 and 2';
    }
    if (this.settings.ai.maxTokens < 1) {
      errors['ai.maxTokens'] = 'Max tokens must be at least 1';
    }
    if (this.settings.ai.topP < 0 || this.settings.ai.topP > 1) {
      errors['ai.topP'] = 'Top P must be between 0 and 1';
    }
    if (this.settings.ai.autoCompleteDelay < 0) {
      errors['ai.autoCompleteDelay'] = 'Auto-complete delay cannot be negative';
    }

    // Validate advanced settings
    if (!isValidLogLevel(this.settings.advanced.logLevel)) {
      errors['advanced.logLevel'] = 'Invalid log level';
    }

    // Warnings
    if (this.settings.advanced.debugMode) {
      warnings['advanced.debugMode'] = 'Debug mode is enabled - may impact performance';
    }
    if (this.settings.ai.temperature > 1.5) {
      warnings['ai.temperature'] = 'High temperature may produce unpredictable results';
    }
    if (!this.settings.advanced.telemetry.crashReporting) {
      warnings['advanced.telemetry.crashReporting'] =
        'Crash reporting is disabled - issues may not be reported';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate and save settings
   * Returns validation result, saves only if valid
   */
  public async validateAndSave(): Promise<SettingsValidationResult & { saved: boolean }> {
    const validation = this.validate();

    if (validation.isValid) {
      const saved = await this.save();
      return { ...validation, saved };
    }

    return { ...validation, saved: false };
  }

  // ==========================================================================
  // Observer Methods
  // ==========================================================================

  /**
   * Subscribe to settings changes
   */
  public subscribe(observer: SettingsObserver): () => void {
    this.observers.add(observer);

    // Return unsubscribe function
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Notify all observers of a change
   */
  private notifyObservers<K extends keyof AppSettings>(
    category: K,
    previousValue: AppSettings[K],
    newValue: AppSettings[K]
  ): void {
    const event: SettingsChangeEvent<K> = {
      category,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
    };

    this.observers.forEach((observer) => {
      try {
        observer(event as SettingsChangeEvent);
      } catch (error) {
        console.error('Settings observer error:', error);
      }
    });
  }

  // ==========================================================================
  // Import/Export Methods
  // ==========================================================================

  /**
   * Export settings as JSON string
   */
  public export(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON string
   */
  public import(json: string): SettingsValidationResult {
    try {
      const imported = JSON.parse(json) as Partial<AppSettings>;
      const migrated = this.migrateSettings(imported);
      const merged = this.mergeWithDefaults(migrated);

      // Temporarily set to validate
      const previous = this.settings;
      this.settings = merged;
      const validation = this.validate();

      if (!validation.isValid) {
        // Restore previous settings if invalid
        this.settings = previous;
      } else {
        this.isDirty = true;
        // Notify observers
        this.notifyObservers('general', previous.general, this.settings.general);
        this.notifyObservers('services', previous.services, this.settings.services);
        this.notifyObservers('ai', previous.ai, this.settings.ai);
        this.notifyObservers('advanced', previous.advanced, this.settings.advanced);
      }

      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: { import: `Failed to parse settings: ${error}` },
        warnings: {},
      };
    }
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Get the settings manager instance
 */
export function getSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}

/**
 * React hook for using settings (to be used with useEffect for subscription)
 */
export function useSettingsManager(): SettingsManager {
  return SettingsManager.getInstance();
}
