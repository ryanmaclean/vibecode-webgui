/**
 * Plugin Loader
 * Loads and initializes plugins from the filesystem
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  Plugin,
  PluginManifest,
  PluginAPI,
  PluginContext,
  PluginLogger,
  PluginCapabilities,
  isPluginManifest,
  isPluginAPI
} from '@/types/plugin';
import { registerPlugin } from './plugin-registry';

export interface PluginLoadOptions {
  autoRegister?: boolean;
  enableAfterLoad?: boolean;
  validateManifest?: boolean;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}

const defaultLoadOptions: PluginLoadOptions = {
  autoRegister: true,
  enableAfterLoad: false,
  validateManifest: true
};

// Cache loaded plugin APIs to avoid reloading
const pluginCache: Map<string, PluginAPI> = new Map();

/**
 * Create a logger instance for a plugin
 */
function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[Plugin:${pluginId}]`;

  return {
    debug: (message: string, ...args: unknown[]) => {
      console.debug(`${prefix} ${message}`, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      console.info(`${prefix} ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`${prefix} ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`${prefix} ${message}`, ...args);
    }
  };
}

/**
 * Create plugin context for runtime
 */
function createPluginContext(
  manifest: PluginManifest,
  pluginPath: string
): PluginContext {
  return {
    pluginId: manifest.id,
    pluginPath,
    dataPath: path.join(pluginPath, 'data'),
    logger: createPluginLogger(manifest.id),
    permissions: manifest.permissions,
    config: {}
  };
}

/**
 * Load and parse plugin manifest from plugin.json
 */
async function loadPluginManifest(
  pluginPath: string
): Promise<PluginManifest> {
  const manifestPath = path.join(pluginPath, 'plugin.json');

  try {
    const manifestData = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestData);

    if (!isPluginManifest(manifest)) {
      throw new Error('Invalid plugin manifest structure');
    }

    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Plugin manifest not found at ${manifestPath}`);
    }
    throw new Error(
      `Failed to load plugin manifest: ${(error as Error).message}`
    );
  }
}

/**
 * Load plugin code from main entry point
 */
async function loadPluginCode(
  pluginPath: string,
  manifest: PluginManifest
): Promise<PluginAPI> {
  const mainPath = path.join(pluginPath, manifest.main);

  try {
    // Check if file exists
    await fs.access(mainPath);

    // Dynamic import of plugin code
    const pluginModule = await import(mainPath);

    // Plugin can export as default or named export
    const pluginAPI = pluginModule.default || pluginModule;

    if (!isPluginAPI(pluginAPI)) {
      throw new Error(
        'Plugin does not implement required PluginAPI interface'
      );
    }

    return pluginAPI;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Plugin entry point not found: ${mainPath}`);
    }
    throw new Error(`Failed to load plugin code: ${(error as Error).message}`);
  }
}

/**
 * Validate plugin manifest structure and required fields
 */
function validateManifest(manifest: PluginManifest): void {
  const errors: string[] = [];

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Plugin id is required and must be a string');
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Plugin name is required and must be a string');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Plugin version is required and must be a string');
  }

  if (!manifest.main || typeof manifest.main !== 'string') {
    errors.push('Plugin main entry point is required and must be a string');
  }

  if (!Array.isArray(manifest.permissions)) {
    errors.push('Plugin permissions must be an array');
  }

  if (errors.length > 0) {
    throw new Error(`Plugin manifest validation failed: ${errors.join(', ')}`);
  }
}

/**
 * Create default plugin capabilities from manifest
 */
function createPluginCapabilities(manifest: PluginManifest): PluginCapabilities {
  return {
    providesAIModel: manifest.type === 'ai-model',
    providesIntegration: manifest.type === 'integration',
    providesCommands: manifest.permissions.includes('commands:register'),
    providesUIComponents: manifest.permissions.includes('ui:inject'),
    providesCodeActions: manifest.type === 'code-generator',
    providesWorkflows: manifest.type === 'workflow',
    providesFormatters: manifest.type === 'formatter',
    providesLinters: manifest.type === 'linter'
  };
}

/**
 * Load a plugin from the specified path
 */
export async function loadPlugin(
  pluginPath: string,
  options: PluginLoadOptions = {}
): Promise<PluginLoadResult> {
  const opts = { ...defaultLoadOptions, ...options };

  try {
    // Load and parse manifest
    const manifest = await loadPluginManifest(pluginPath);

    // Validate manifest if requested
    if (opts.validateManifest) {
      validateManifest(manifest);
    }

    // Check cache first
    let pluginAPI: PluginAPI;
    if (pluginCache.has(manifest.id)) {
      pluginAPI = pluginCache.get(manifest.id)!;
    } else {
      // Load plugin code
      pluginAPI = await loadPluginCode(pluginPath, manifest);
      pluginCache.set(manifest.id, pluginAPI);
    }

    // Create plugin context
    const context = createPluginContext(manifest, pluginPath);

    // Initialize plugin
    await pluginAPI.initialize(context);

    // Create plugin instance
    const plugin: Plugin = {
      manifest,
      capabilities: pluginAPI.capabilities || createPluginCapabilities(manifest),
      status: opts.enableAfterLoad ? 'active' : 'inactive',
      installedAt: new Date(),
      updatedAt: new Date(),
      enabledAt: opts.enableAfterLoad ? new Date() : undefined,
      api: pluginAPI,
      context
    };

    // Register plugin if requested
    if (opts.autoRegister) {
      registerPlugin({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author.name,
        metadata: {
          homepage: manifest.homepage,
          repository: manifest.repository?.url,
          license: manifest.license || 'UNLICENSED',
          keywords: manifest.keywords || [],
          dependencies: manifest.dependencies,
          minimumVersion: manifest.engines?.vibecode
        },
        capabilities: {
          aiModels: plugin.capabilities.providesAIModel,
          integrations: plugin.capabilities.providesIntegration,
          workflows: plugin.capabilities.providesWorkflows,
          commands: plugin.capabilities.providesCommands,
          ui: plugin.capabilities.providesUIComponents
        },
        status: plugin.status === 'active' ? 'active' : 'installed',
        installedAt: plugin.installedAt,
        updatedAt: plugin.updatedAt
      });
    }

    return {
      success: true,
      plugin
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Load multiple plugins from a directory
 */
export async function loadPluginsFromDirectory(
  directory: string,
  options: PluginLoadOptions = {}
): Promise<PluginLoadResult[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const pluginDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(directory, entry.name));

    const results = await Promise.allSettled(
      pluginDirs.map(pluginPath => loadPlugin(pluginPath, options))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        error: result.reason.message
      };
    });
  } catch (error) {
    return [
      {
        success: false,
        error: `Failed to read plugin directory: ${(error as Error).message}`
      }
    ];
  }
}

/**
 * Unload a plugin and cleanup resources
 */
export async function unloadPlugin(pluginId: string): Promise<boolean> {
  const cachedPlugin = pluginCache.get(pluginId);

  if (!cachedPlugin) {
    return false;
  }

  try {
    // Call destroy lifecycle hook
    await cachedPlugin.destroy();

    // Remove from cache
    pluginCache.delete(pluginId);

    return true;
  } catch (error) {
    console.error(`Failed to unload plugin ${pluginId}:`, error);
    return false;
  }
}

/**
 * Clear plugin cache (primarily for testing)
 */
export function clearPluginCache(): void {
  pluginCache.clear();
}

/**
 * Get cached plugin API
 */
export function getCachedPluginAPI(pluginId: string): PluginAPI | undefined {
  return pluginCache.get(pluginId);
}

/**
 * Check if plugin is loaded in cache
 */
export function isPluginLoaded(pluginId: string): boolean {
  return pluginCache.has(pluginId);
}

export default loadPlugin;
