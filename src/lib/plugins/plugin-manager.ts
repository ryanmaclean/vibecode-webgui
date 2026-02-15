/**
 * Plugin Manager
 * Core plugin management system coordinating installation, loading, and lifecycle
 */

import path from 'path';
import { promises as fs } from 'fs';
import { prisma } from '@/lib/prisma';
import {
  Plugin,
  PluginManifest,
  PluginInstallOptions,
  PluginSearchCriteria,
  PluginEvent,
  PluginEventType,
  PluginStatus,
  PluginSandboxConfig
} from '@/types/plugin';
import {
  loadPlugin,
  unloadPlugin,
  isPluginLoaded,
  PluginLoadOptions
} from './plugin-loader';
import {
  registerPlugin,
  getPlugin as getRegistryPlugin,
  getAllPlugins as getAllRegistryPlugins,
  getPluginsByStatus,
  updatePluginStatus as updateRegistryStatus,
  unregisterPlugin,
  hasPlugin as hasRegistryPlugin
} from './plugin-registry';
import {
  validateManifestComprehensive,
  sanitizeManifest
} from './plugin-validator';
import { EventEmitter } from 'events';

/**
 * Plugin installation result
 */
export interface PluginInstallResult {
  success: boolean;
  pluginId?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Plugin operation result
 */
export interface PluginOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  pluginsDirectory: string;
  autoLoadOnStartup: boolean;
  allowUnsafePlugins: boolean;
  defaultSandboxConfig?: Partial<PluginSandboxConfig>;
}

/**
 * Default plugin manager configuration
 */
const DEFAULT_CONFIG: PluginManagerConfig = {
  pluginsDirectory: path.join(process.cwd(), 'plugins'),
  autoLoadOnStartup: true,
  allowUnsafePlugins: false
};

/**
 * Plugin Manager class
 * Manages the complete plugin lifecycle: install, uninstall, enable, disable
 */
export class PluginManager extends EventEmitter {
  private config: PluginManagerConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<PluginManagerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize plugin manager and load existing plugins
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure plugins directory exists
    await this.ensurePluginsDirectory();

    // Load plugins from database
    if (this.config.autoLoadOnStartup) {
      await this.loadInstalledPlugins();
    }

    this.initialized = true;
    this.emit('manager:initialized');
  }

  /**
   * Ensure plugins directory exists
   */
  private async ensurePluginsDirectory(): Promise<void> {
    try {
      await fs.access(this.config.pluginsDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.mkdir(this.config.pluginsDirectory, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Load all installed plugins from database
   */
  private async loadInstalledPlugins(): Promise<void> {
    try {
      // Get all installed plugins from database
      const dbPlugins = await prisma.plugin.findMany({
        where: {
          status: {
            in: ['installed', 'enabled', 'active']
          }
        }
      });

      // Load each plugin
      for (const dbPlugin of dbPlugins) {
        const pluginPath = path.join(this.config.pluginsDirectory, dbPlugin.name);

        try {
          const loadOptions: PluginLoadOptions = {
            autoRegister: true,
            enableAfterLoad: dbPlugin.status === 'active' || dbPlugin.status === 'enabled',
            validateManifest: true
          };

          const result = await loadPlugin(pluginPath, loadOptions);

          if (!result.success) {
            // Update plugin status to error in database
            await prisma.plugin.update({
              where: { id: dbPlugin.id },
              data: {
                status: 'error',
                updated_at: new Date()
              }
            });
          }
        } catch (error) {
          this.emit('plugin:error', {
            type: 'plugin:error',
            pluginId: dbPlugin.name,
            timestamp: new Date(),
            error: error as Error
          } as PluginEvent);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load installed plugins: ${(error as Error).message}`);
    }
  }

  /**
   * Install a plugin from a source (directory, URL, or package)
   */
  async install(options: PluginInstallOptions): Promise<PluginInstallResult> {
    try {
      // Resolve plugin source
      const pluginPath = await this.resolvePluginSource(options.source);

      // Load and validate manifest
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifestObj = JSON.parse(manifestData);

      // Validate manifest
      if (!options.skipValidation) {
        const validation = validateManifestComprehensive(manifestObj);

        if (!validation.valid) {
          return {
            success: false,
            error: `Invalid plugin manifest: ${validation.errors.join(', ')}`,
            warnings: validation.warnings
          };
        }

        // Check for unsafe plugins
        if (!this.config.allowUnsafePlugins && validation.warnings.length > 0) {
          const hasHighRiskWarnings = validation.warnings.some(w =>
            w.includes('high-risk') || w.includes('dangerous')
          );

          if (hasHighRiskWarnings) {
            return {
              success: false,
              error: 'Plugin has high-risk permissions. Enable allowUnsafePlugins to install.',
              warnings: validation.warnings
            };
          }
        }
      }

      // Sanitize manifest
      const manifest = sanitizeManifest(manifestObj);
      if (!manifest) {
        return {
          success: false,
          error: 'Failed to sanitize plugin manifest'
        };
      }

      // Check if plugin already exists
      const existingPlugin = await prisma.plugin.findFirst({
        where: {
          name: manifest.name,
          version: manifest.version
        }
      });

      if (existingPlugin && !options.force) {
        return {
          success: false,
          error: `Plugin ${manifest.name}@${manifest.version} is already installed. Use force option to reinstall.`
        };
      }

      // Copy plugin to plugins directory if from external source
      const targetPath = path.join(this.config.pluginsDirectory, manifest.name);
      if (pluginPath !== targetPath) {
        await this.copyPlugin(pluginPath, targetPath);
      }

      // Install or update in database
      const dbPlugin = existingPlugin
        ? await prisma.plugin.update({
            where: { id: existingPlugin.id },
            data: {
              version: manifest.version,
              author: manifest.author.name,
              status: 'installed',
              manifest: manifest as unknown as Record<string, unknown>,
              updated_at: new Date()
            }
          })
        : await prisma.plugin.create({
            data: {
              name: manifest.name,
              version: manifest.version,
              author: manifest.author.name,
              status: 'installed',
              manifest: manifest as unknown as Record<string, unknown>
            }
          });

      // Load plugin
      const loadResult = await loadPlugin(targetPath, {
        autoRegister: true,
        enableAfterLoad: options.autoEnable || false,
        validateManifest: false // Already validated
      });

      if (!loadResult.success) {
        // Rollback database entry
        await prisma.plugin.delete({
          where: { id: dbPlugin.id }
        });

        return {
          success: false,
          error: `Failed to load plugin: ${loadResult.error}`
        };
      }

      // Update status if auto-enabled
      if (options.autoEnable) {
        await prisma.plugin.update({
          where: { id: dbPlugin.id },
          data: { status: 'active' }
        });
      }

      // Emit event
      this.emitPluginEvent('plugin:installed', manifest.id);

      return {
        success: true,
        pluginId: manifest.id
      };
    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string): Promise<PluginOperationResult> {
    try {
      // Check if plugin exists in registry
      if (!hasRegistryPlugin(pluginId)) {
        return {
          success: false,
          error: `Plugin '${pluginId}' is not installed`
        };
      }

      // Get plugin from registry
      const plugin = getRegistryPlugin(pluginId);
      if (!plugin) {
        return {
          success: false,
          error: `Plugin '${pluginId}' not found in registry`
        };
      }

      // Unload plugin if loaded
      if (isPluginLoaded(pluginId)) {
        await unloadPlugin(pluginId);
      }

      // Remove from registry
      unregisterPlugin(pluginId);

      // Remove from database
      await prisma.plugin.deleteMany({
        where: { name: pluginId }
      });

      // Remove plugin directory
      const pluginPath = path.join(this.config.pluginsDirectory, pluginId);
      try {
        await fs.rm(pluginPath, { recursive: true, force: true });
      } catch (error) {
        // Log but don't fail if directory removal fails
        this.emit('warning', `Failed to remove plugin directory: ${(error as Error).message}`);
      }

      // Emit event
      this.emitPluginEvent('plugin:uninstalled', pluginId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Uninstallation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<PluginOperationResult> {
    try {
      // Check if plugin exists
      if (!hasRegistryPlugin(pluginId)) {
        return {
          success: false,
          error: `Plugin '${pluginId}' is not installed`
        };
      }

      // Get plugin from registry
      const plugin = getRegistryPlugin(pluginId);
      if (!plugin) {
        return {
          success: false,
          error: `Plugin '${pluginId}' not found`
        };
      }

      // Check current status
      if (plugin.status === 'active') {
        return {
          success: false,
          error: `Plugin '${pluginId}' is already enabled`
        };
      }

      // Update registry status
      updateRegistryStatus(pluginId, 'active');

      // Update database
      await prisma.plugin.updateMany({
        where: { name: pluginId },
        data: {
          status: 'active',
          updated_at: new Date()
        }
      });

      // Emit event
      this.emitPluginEvent('plugin:enabled', pluginId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to enable plugin: ${(error as Error).message}`
      };
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<PluginOperationResult> {
    try {
      // Check if plugin exists
      if (!hasRegistryPlugin(pluginId)) {
        return {
          success: false,
          error: `Plugin '${pluginId}' is not installed`
        };
      }

      // Get plugin from registry
      const plugin = getRegistryPlugin(pluginId);
      if (!plugin) {
        return {
          success: false,
          error: `Plugin '${pluginId}' not found`
        };
      }

      // Check current status
      if (plugin.status === 'installed' || plugin.status === 'disabled') {
        return {
          success: false,
          error: `Plugin '${pluginId}' is already disabled`
        };
      }

      // Update registry status
      updateRegistryStatus(pluginId, 'installed');

      // Update database
      await prisma.plugin.updateMany({
        where: { name: pluginId },
        data: {
          status: 'installed',
          updated_at: new Date()
        }
      });

      // Emit event
      this.emitPluginEvent('plugin:disabled', pluginId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to disable plugin: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get plugin by ID
   */
  async getPlugin(pluginId: string): Promise<Plugin | null> {
    const plugin = getRegistryPlugin(pluginId);
    return plugin || null;
  }

  /**
   * Get all plugins
   */
  async getAllPlugins(): Promise<Plugin[]> {
    return getAllRegistryPlugins();
  }

  /**
   * Search/filter plugins
   */
  async searchPlugins(criteria: PluginSearchCriteria): Promise<Plugin[]> {
    let plugins = getAllRegistryPlugins();

    // Filter by type
    if (criteria.type) {
      plugins = plugins.filter(p => p.metadata.keywords.includes(criteria.type!));
    }

    // Filter by status
    if (criteria.status) {
      plugins = plugins.filter(p => p.status === criteria.status);
    }

    // Filter by keyword
    if (criteria.keyword) {
      const keyword = criteria.keyword.toLowerCase();
      plugins = plugins.filter(
        p =>
          p.name.toLowerCase().includes(keyword) ||
          p.description.toLowerCase().includes(keyword) ||
          p.metadata.keywords.some(k => k.toLowerCase().includes(keyword))
      );
    }

    // Filter by author
    if (criteria.author) {
      plugins = plugins.filter(p => p.author.toLowerCase().includes(criteria.author!.toLowerCase()));
    }

    return plugins;
  }

  /**
   * Get active plugins
   */
  async getActivePlugins(): Promise<Plugin[]> {
    return getPluginsByStatus('active');
  }

  /**
   * Resolve plugin source (directory, URL, or npm package)
   */
  private async resolvePluginSource(source: string): Promise<string> {
    // Check if it's a local directory
    try {
      const stats = await fs.stat(source);
      if (stats.isDirectory()) {
        return path.resolve(source);
      }
    } catch (error) {
      // Not a local directory, continue to other resolution methods
    }

    // TODO: Add support for URLs and npm packages
    // For now, only support local directories
    throw new Error(`Plugin source resolution not implemented for: ${source}`);
  }

  /**
   * Copy plugin from source to target directory
   */
  private async copyPlugin(source: string, target: string): Promise<void> {
    // Remove target if exists
    try {
      await fs.rm(target, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }

    // Copy directory recursively
    await fs.cp(source, target, { recursive: true });
  }

  /**
   * Emit plugin event
   */
  private emitPluginEvent(type: PluginEventType, pluginId: string, data?: Record<string, unknown>): void {
    const event: PluginEvent = {
      type,
      pluginId,
      timestamp: new Date(),
      data
    };

    this.emit(type, event);
    this.emit('plugin:event', event);
  }

  /**
   * Destroy plugin manager and cleanup
   */
  async destroy(): Promise<void> {
    this.removeAllListeners();
    this.initialized = false;
  }
}

/**
 * Global plugin manager instance
 */
let pluginManagerInstance: PluginManager | null = null;

/**
 * Get or create global plugin manager instance
 */
export function getPluginManager(config?: Partial<PluginManagerConfig>): PluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new PluginManager(config);
  }
  return pluginManagerInstance;
}

/**
 * Initialize plugin manager
 */
export async function initializePluginManager(config?: Partial<PluginManagerConfig>): Promise<PluginManager> {
  const manager = getPluginManager(config);
  await manager.initialize();
  return manager;
}

/**
 * Install a plugin (convenience function)
 */
export async function installPlugin(options: PluginInstallOptions): Promise<PluginInstallResult> {
  const manager = getPluginManager();
  return manager.install(options);
}

/**
 * Uninstall a plugin (convenience function)
 */
export async function uninstallPlugin(pluginId: string): Promise<PluginOperationResult> {
  const manager = getPluginManager();
  return manager.uninstall(pluginId);
}

/**
 * Enable a plugin (convenience function)
 */
export async function enablePlugin(pluginId: string): Promise<PluginOperationResult> {
  const manager = getPluginManager();
  return manager.enable(pluginId);
}

/**
 * Disable a plugin (convenience function)
 */
export async function disablePlugin(pluginId: string): Promise<PluginOperationResult> {
  const manager = getPluginManager();
  return manager.disable(pluginId);
}

/**
 * Get plugin by ID (convenience function)
 */
export async function getPluginById(pluginId: string): Promise<Plugin | null> {
  const manager = getPluginManager();
  return manager.getPlugin(pluginId);
}

/**
 * Get all plugins (convenience function)
 */
export async function listAllPlugins(): Promise<Plugin[]> {
  const manager = getPluginManager();
  return manager.getAllPlugins();
}

/**
 * Search plugins (convenience function)
 */
export async function findPlugins(criteria: PluginSearchCriteria): Promise<Plugin[]> {
  const manager = getPluginManager();
  return manager.searchPlugins(criteria);
}

export default PluginManager;
