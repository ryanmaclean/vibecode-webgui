// Plugin Registry
// Centralized registry for managing installed plugins

import { Plugin, PluginStatus } from '@/types/plugin';

// Plugin registry - stores all installed plugins
// Key is plugin ID (from manifest)
const pluginRegistry: Map<string, Plugin> = new Map()

// Helper to get plugin ID from manifest
function getPluginId(plugin: Plugin): string {
  return plugin.manifest.id;
}

// Utility functions

/**
 * Register a new plugin in the registry
 */
export function registerPlugin(plugin: Plugin): void {
  const pluginId = getPluginId(plugin);
  if (pluginRegistry.has(pluginId)) {
    throw new Error(`Plugin with id '${pluginId}' is already registered`)
  }
  pluginRegistry.set(pluginId, plugin)
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
export function getPluginsByCapability(capability: string): Plugin[] {
  return getAllPlugins().filter(plugin => {
    const caps = plugin.capabilities as unknown as Record<string, boolean>;
    return caps[capability] === true;
  })
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
