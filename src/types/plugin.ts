// Plugin System Type Definitions
// Type definitions for the extensible plugin architecture

/**
 * Plugin type categories
 */
export type PluginType =
  | 'ai-model'           // Custom AI model providers
  | 'integration'        // Third-party tool integrations
  | 'workflow'           // Workflow automation plugins
  | 'ui-extension'       // UI enhancements and custom components
  | 'code-generator'     // Code generation and scaffolding
  | 'linter'            // Custom linting and code analysis
  | 'formatter'         // Code formatting plugins
  | 'other'             // General purpose plugins

/**
 * Plugin execution status
 */
export type PluginStatus =
  | 'active'            // Plugin is installed and enabled
  | 'inactive'          // Plugin is installed but disabled
  | 'error'             // Plugin encountered an error
  | 'installing'        // Plugin is being installed
  | 'uninstalling'      // Plugin is being uninstalled

/**
 * Permission types for plugin security
 */
export type PluginPermission =
  | 'filesystem:read'    // Read filesystem access
  | 'filesystem:write'   // Write filesystem access
  | 'network:outbound'   // Make outbound network requests
  | 'database:read'      // Read database access
  | 'database:write'     // Write database access
  | 'ai-models:access'   // Access to AI model APIs
  | 'ui:inject'          // Inject UI components
  | 'commands:register'  // Register custom commands
  | 'settings:read'      // Read user settings
  | 'settings:write'     // Modify user settings

/**
 * Plugin manifest - metadata and configuration
 */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: {
    name: string
    email?: string
    url?: string
  }
  type: PluginType
  main: string                    // Entry point file (e.g., "index.js")
  permissions: PluginPermission[]  // Required permissions
  dependencies?: Record<string, string>  // npm dependencies
  peerDependencies?: Record<string, string>
  engines?: {
    node?: string
    vibecode?: string             // Minimum VibeCode version
  }
  repository?: {
    type: string
    url: string
  }
  license?: string
  keywords?: string[]
  homepage?: string
  icon?: string                   // Icon URL or path
}

/**
 * Plugin capability flags
 */
export interface PluginCapabilities {
  providesAIModel: boolean        // Adds custom AI model
  providesIntegration: boolean    // Integrates with external service
  providesCommands: boolean       // Adds custom commands
  providesUIComponents: boolean   // Adds UI components
  providesCodeActions: boolean    // Adds code actions/quick fixes
  providesWorkflows: boolean      // Adds workflow automations
  providesFormatters: boolean     // Adds code formatters
  providesLinters: boolean        // Adds linters/analyzers
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  onInstall?: () => Promise<void> | void
  onUninstall?: () => Promise<void> | void
  onEnable?: () => Promise<void> | void
  onDisable?: () => Promise<void> | void
  onUpdate?: (oldVersion: string, newVersion: string) => Promise<void> | void
}

/**
 * Plugin context provided to plugins at runtime
 */
export interface PluginContext {
  pluginId: string
  pluginPath: string
  dataPath: string                // Plugin-specific data directory
  logger: PluginLogger
  permissions: PluginPermission[]
  config: Record<string, unknown> // Plugin configuration
}

/**
 * Logger interface for plugins
 */
export interface PluginLogger {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
}

/**
 * Plugin API interface - what plugins must implement
 */
export interface PluginAPI extends PluginLifecycle {
  manifest: PluginManifest
  capabilities: PluginCapabilities
  initialize: (context: PluginContext) => Promise<void> | void
  destroy: () => Promise<void> | void
}

/**
 * Complete plugin instance with runtime information
 */
export interface Plugin {
  manifest: PluginManifest
  capabilities: PluginCapabilities
  status: PluginStatus
  installedAt: Date
  updatedAt: Date
  enabledAt?: Date
  lastError?: string
  api?: PluginAPI                 // Loaded plugin API
  context?: PluginContext         // Runtime context
}

/**
 * Plugin registry entry for tracking installed plugins
 */
export interface PluginRegistryEntry {
  id: string
  plugin: Plugin
  path: string
}

/**
 * Plugin installation options
 */
export interface PluginInstallOptions {
  source: string                  // URL, file path, or npm package
  version?: string
  force?: boolean                 // Overwrite if exists
  skipValidation?: boolean        // Skip manifest validation
  autoEnable?: boolean            // Enable after installation
}

/**
 * Plugin search/filter criteria
 */
export interface PluginSearchCriteria {
  type?: PluginType
  status?: PluginStatus
  keyword?: string
  author?: string
  hasPermission?: PluginPermission
  hasCapability?: keyof PluginCapabilities
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Plugin execution sandbox configuration
 */
export interface PluginSandboxConfig {
  timeout: number                 // Execution timeout in ms
  memoryLimit: number             // Memory limit in MB
  cpuLimit?: number               // CPU time limit
  allowedPaths: string[]          // Filesystem paths plugin can access
  allowedHosts: string[]          // Network hosts plugin can access
}

// Utility type for plugin event types
export type PluginEventType =
  | 'plugin:installed'
  | 'plugin:uninstalled'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:error'
  | 'plugin:updated'

/**
 * Plugin event data
 */
export interface PluginEvent {
  type: PluginEventType
  pluginId: string
  timestamp: Date
  data?: Record<string, unknown>
  error?: Error
}

// Type guards
export function isPluginManifest(obj: unknown): obj is PluginManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'version' in obj &&
    'type' in obj &&
    'main' in obj &&
    'permissions' in obj
  )
}

export function isPluginAPI(obj: unknown): obj is PluginAPI {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'manifest' in obj &&
    'capabilities' in obj &&
    'initialize' in obj &&
    'destroy' in obj
  )
}
