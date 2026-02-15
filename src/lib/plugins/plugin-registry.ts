// Plugin Registry
// Centralized registry for managing installed plugins

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  metadata: PluginMetadata
  capabilities: PluginCapabilities
  status: PluginStatus
  installedAt: Date
  updatedAt: Date
}

export interface PluginMetadata {
  homepage?: string
  repository?: string
  license: string
  keywords: string[]
  dependencies?: Record<string, string>
  minimumVersion?: string
}

export interface PluginCapabilities {
  aiModels: boolean
  integrations: boolean
  workflows: boolean
  commands: boolean
  ui: boolean
}

export type PluginStatus = 'installed' | 'active' | 'disabled' | 'error'

// Plugin registry - stores all installed plugins
const pluginRegistry: Map<string, Plugin> = new Map()

// Utility functions

/**
 * Register a new plugin in the registry
 */
export function registerPlugin(plugin: Plugin): void {
  if (pluginRegistry.has(plugin.id)) {
    throw new Error(`Plugin with id '${plugin.id}' is already registered`)
  }
  pluginRegistry.set(plugin.id, plugin)
}

/**
 * Get a plugin by id
 */
export function getPlugin(id: string): Plugin | undefined {
  return pluginRegistry.get(id)
}

/**
 * Get all plugins
 */
export function getAllPlugins(): Plugin[] {
  return Array.from(pluginRegistry.values())
}

/**
 * Get plugins filtered by status
 */
export function getPluginsByStatus(status: PluginStatus): Plugin[] {
  return getAllPlugins().filter(plugin => plugin.status === status)
}

/**
 * Get active plugins
 */
export function getActivePlugins(): Plugin[] {
  return getPluginsByStatus('active')
}

/**
 * Update plugin status
 */
export function updatePluginStatus(id: string, status: PluginStatus): void {
  const plugin = pluginRegistry.get(id)
  if (!plugin) {
    throw new Error(`Plugin with id '${id}' not found`)
  }
  plugin.status = status
  plugin.updatedAt = new Date()
}

/**
 * Remove a plugin from the registry
 */
export function unregisterPlugin(id: string): boolean {
  return pluginRegistry.delete(id)
}

/**
 * Check if a plugin is registered
 */
export function hasPlugin(id: string): boolean {
  return pluginRegistry.has(id)
}

/**
 * Get plugins by capability
 */
export function getPluginsByCapability(capability: keyof PluginCapabilities): Plugin[] {
  return getAllPlugins().filter(plugin => plugin.capabilities[capability])
}

/**
 * Clear all plugins from the registry (primarily for testing)
 */
export function clearRegistry(): void {
  pluginRegistry.clear()
}

/**
 * Get plugin count
 */
export function getPluginCount(): number {
  return pluginRegistry.size
}
