/**
 * Settings Type Definitions for VibeCode
 *
 * Comprehensive type definitions for application settings including:
 * - General preferences (theme, startup behavior)
 * - Service configuration (ports, timeouts, auto-start)
 * - AI settings (models, API keys, parameters)
 * - Advanced/telemetry settings
 *
 * @module types/settings
 */

// ============================================================================
// Theme Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

// ============================================================================
// General Settings
// ============================================================================

/**
 * General application settings for user preferences
 */
export interface GeneralSettings {
  /** Application theme mode */
  theme: ThemeMode;
  /** Whether to launch application at system login */
  launchAtLogin: boolean;
  /** Whether to minimize to system tray instead of closing */
  minimizeToTray: boolean;
  /** Enable desktop notifications */
  notifications: boolean;
  /** Language/locale preference */
  language: string;
  /** Auto-save interval in seconds (0 = disabled) */
  autoSaveInterval: number;
  /** Show confirmation before closing with unsaved changes */
  confirmOnClose: boolean;
}

// ============================================================================
// Service Settings
// ============================================================================

/**
 * Port configuration for various services
 */
export interface ServicePorts {
  /** Main application server port */
  app: number;
  /** AI gateway port */
  aiGateway: number;
  /** Database connection port */
  database: number;
  /** VM management service port */
  vmService: number;
  /** Collaboration server port */
  collaboration: number;
}

/**
 * Service timeout configuration in milliseconds
 */
export interface ServiceTimeouts {
  /** Connection timeout for establishing connections */
  connection: number;
  /** Request timeout for API calls */
  request: number;
  /** Idle timeout before connection is recycled */
  idle: number;
  /** Health check interval */
  healthCheck: number;
}

/**
 * Service-related settings
 */
export interface ServiceSettings {
  /** Automatically start services on app launch */
  autoStartServices: boolean;
  /** Port configuration for services */
  ports: ServicePorts;
  /** Timeout configuration */
  timeouts: ServiceTimeouts;
  /** Enable service health monitoring */
  healthMonitoring: boolean;
  /** Maximum retry attempts for failed connections */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
}

// ============================================================================
// AI Settings
// ============================================================================

/**
 * AI model configuration
 */
export interface AIModelConfig {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  id: string;
  /** Display name for the model */
  name: string;
  /** Provider name (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Whether this is a custom/local model */
  isCustom: boolean;
}

/**
 * API key configuration (stored securely)
 */
export interface APIKeyConfig {
  /** Key identifier/name */
  name: string;
  /** Provider this key is for */
  provider: string;
  /** Whether the key is configured (don't store actual key here) */
  isConfigured: boolean;
  /** Last validation timestamp */
  lastValidated?: string;
}

/**
 * Cost display mode options
 */
export type CostDisplayMode = 'per_request' | 'session' | 'daily' | 'monthly';

/**
 * Budget alert thresholds configuration
 */
export interface BudgetAlertThresholds {
  /** Warning threshold (percentage of budget) */
  warning: number;
  /** Critical threshold (percentage of budget) */
  critical: number;
  /** Daily warning threshold */
  dailyWarning: number;
  /** Session warning threshold */
  sessionWarning: number;
}

/**
 * AI cost tracking settings
 */
export interface AICostSettings {
  /** Monthly budget limit in USD (0 = unlimited) */
  monthlyBudget: number;
  /** Daily budget limit in USD (0 = unlimited) */
  dailyBudget: number;
  /** Session budget limit in USD (0 = unlimited) */
  sessionBudget: number;
  /** Preferred cost display mode */
  displayMode: CostDisplayMode;
  /** Show cost estimates before sending */
  showEstimatesBeforeSend: boolean;
  /** Show real-time cost tracking */
  showRealtimeCosts: boolean;
  /** Alert thresholds as percentage of budget */
  alertThresholds: BudgetAlertThresholds;
  /** Currency for display (default: USD) */
  displayCurrency: string;
  /** Enable cost optimization suggestions */
  enableOptimizationSuggestions: boolean;
  /** Preferred models for cost optimization */
  preferredEconomyModels: string[];
}

/**
 * AI-related settings
 */
export interface AISettings {
  /** Default AI model to use */
  defaultModel: string;
  /** Available/configured API keys metadata */
  apiKeys: APIKeyConfig[];
  /** Maximum tokens for AI responses */
  maxTokens: number;
  /** Default temperature for generation (0-2) */
  temperature: number;
  /** Top P (nucleus sampling) value */
  topP: number;
  /** Stream responses in real-time */
  streamResponses: boolean;
  /** Enable code suggestions */
  codeSuggestions: boolean;
  /** Auto-complete delay in milliseconds */
  autoCompleteDelay: number;
  /** Available AI models */
  availableModels: AIModelConfig[];
  /** Context window size limit */
  contextLimit: number;
  /** Cost tracking and management settings */
  costSettings: AICostSettings;
}

// ============================================================================
// Agent Confirmation Settings
// ============================================================================

/**
 * Agent action confirmation and preview settings
 */
export interface AgentConfirmationSettings {
  /** Show diff previews before applying changes */
  enableActionPreview: boolean;
  /** Require explicit approval for agent actions */
  requireConfirmation: boolean;
  /** Allow approving multiple changes at once */
  bulkApprovalMode: boolean;
  /** Show why each change is proposed */
  showExplanations: boolean;
  /** Skip confirmation for read-only operations */
  autoApproveReadOnly: boolean;
}

// ============================================================================
// Telemetry & Advanced Settings
// ============================================================================

/**
 * Telemetry and privacy settings
 */
export interface TelemetrySettings {
  /** Enable anonymous usage analytics */
  analyticsEnabled: boolean;
  /** Enable crash reporting */
  crashReporting: boolean;
  /** Enable performance monitoring */
  performanceMonitoring: boolean;
  /** Share usage data to improve AI suggestions */
  shareUsageData: boolean;
}

/**
 * Advanced application settings
 */
export interface AdvancedSettings {
  /** Telemetry and privacy options */
  telemetry: TelemetrySettings;
  /** Enable debug mode with extra logging */
  debugMode: boolean;
  /** Application log level */
  logLevel: LogLevel;
  /** Custom data directory path */
  dataDirectory: string;
  /** Enable experimental features */
  experimentalFeatures: boolean;
  /** Enable hardware acceleration */
  hardwareAcceleration: boolean;
  /** Proxy server URL (empty = no proxy) */
  proxyUrl: string;
  /** Bypass proxy for local addresses */
  bypassProxyForLocal: boolean;
}

// ============================================================================
// Main Settings Interface
// ============================================================================

/**
 * Complete application settings
 */
export interface AppSettings {
  /** Settings schema version for migrations */
  version: number;
  /** General application settings */
  general: GeneralSettings;
  /** Service configuration settings */
  services: ServiceSettings;
  /** AI-related settings */
  ai: AISettings;
  /** Advanced settings including telemetry */
  advanced: AdvancedSettings;
  /** Agent confirmation and preview settings */
  agentConfirmation: AgentConfirmationSettings;
  /** Last modified timestamp */
  lastModified: string;
}

// ============================================================================
// Default Settings
// ============================================================================

/**
 * Default general settings
 */
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  theme: 'system',
  launchAtLogin: false,
  minimizeToTray: true,
  notifications: true,
  language: 'en',
  autoSaveInterval: 30,
  confirmOnClose: true,
};

/**
 * Default service ports
 */
export const DEFAULT_SERVICE_PORTS: ServicePorts = {
  app: 3000,
  aiGateway: 4000,
  database: 5432,
  vmService: 8080,
  collaboration: 3001,
};

/**
 * Default service timeouts (in milliseconds)
 */
export const DEFAULT_SERVICE_TIMEOUTS: ServiceTimeouts = {
  connection: 10000,
  request: 30000,
  idle: 300000,
  healthCheck: 30000,
};

/**
 * Default service settings
 */
export const DEFAULT_SERVICE_SETTINGS: ServiceSettings = {
  autoStartServices: true,
  ports: DEFAULT_SERVICE_PORTS,
  timeouts: DEFAULT_SERVICE_TIMEOUTS,
  healthMonitoring: true,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Default available AI models
 */
export const DEFAULT_AI_MODELS: AIModelConfig[] = [
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', isCustom: false },
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', isCustom: false },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', isCustom: false },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', isCustom: false },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic', isCustom: false },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', isCustom: false },
];

/**
 * Default budget alert thresholds
 */
export const DEFAULT_BUDGET_ALERT_THRESHOLDS: BudgetAlertThresholds = {
  warning: 75,
  critical: 90,
  dailyWarning: 80,
  sessionWarning: 90,
};

/**
 * Default AI cost settings
 */
export const DEFAULT_AI_COST_SETTINGS: AICostSettings = {
  monthlyBudget: 0,
  dailyBudget: 0,
  sessionBudget: 0,
  displayMode: 'session',
  showEstimatesBeforeSend: true,
  showRealtimeCosts: true,
  alertThresholds: DEFAULT_BUDGET_ALERT_THRESHOLDS,
  displayCurrency: 'USD',
  enableOptimizationSuggestions: true,
  preferredEconomyModels: ['gpt-3.5-turbo', 'claude-3-haiku', 'gemini-pro'],
};

/**
 * Default AI settings
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  defaultModel: 'gpt-4-turbo',
  apiKeys: [],
  maxTokens: 4096,
  temperature: 0.7,
  topP: 1.0,
  streamResponses: true,
  codeSuggestions: true,
  autoCompleteDelay: 300,
  availableModels: DEFAULT_AI_MODELS,
  contextLimit: 128000,
  costSettings: DEFAULT_AI_COST_SETTINGS,
};

/**
 * Default telemetry settings
 */
export const DEFAULT_TELEMETRY_SETTINGS: TelemetrySettings = {
  analyticsEnabled: false,
  crashReporting: true,
  performanceMonitoring: false,
  shareUsageData: false,
};

/**
 * Default advanced settings
 */
export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  telemetry: DEFAULT_TELEMETRY_SETTINGS,
  debugMode: false,
  logLevel: 'info',
  dataDirectory: '',
  experimentalFeatures: false,
  hardwareAcceleration: true,
  proxyUrl: '',
  bypassProxyForLocal: true,
};

/**
 * Default agent confirmation settings
 */
export const DEFAULT_AGENT_CONFIRMATION_SETTINGS: AgentConfirmationSettings = {
  enableActionPreview: true,
  requireConfirmation: true,
  bulkApprovalMode: false,
  showExplanations: true,
  autoApproveReadOnly: false,
};

/**
 * Complete default settings
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  general: DEFAULT_GENERAL_SETTINGS,
  services: DEFAULT_SERVICE_SETTINGS,
  ai: DEFAULT_AI_SETTINGS,
  advanced: DEFAULT_ADVANCED_SETTINGS,
  agentConfirmation: DEFAULT_AGENT_CONFIRMATION_SETTINGS,
  lastModified: new Date().toISOString(),
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Settings change event
 */
export interface SettingsChangeEvent<K extends keyof AppSettings = keyof AppSettings> {
  /** Which settings category changed */
  category: K;
  /** Previous value */
  previousValue: AppSettings[K];
  /** New value */
  newValue: AppSettings[K];
  /** Timestamp of the change */
  timestamp: string;
}

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  /** Whether settings are valid */
  isValid: boolean;
  /** Validation errors by field path */
  errors: Record<string, string>;
  /** Validation warnings by field path */
  warnings: Record<string, string>;
}

/**
 * Settings migration function type
 */
export type SettingsMigration = (settings: Partial<AppSettings>) => AppSettings;

/**
 * Settings observer callback
 */
export type SettingsObserver = (event: SettingsChangeEvent) => void;
