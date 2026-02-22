/**
 * Plugin Manager
 * Core plugin management system coordinating installation, loading, and lifecycle
 */

import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  Plugin,
  PluginInstallOptions,
  PluginSearchCriteria,
  PluginEvent,
  PluginEventType,
  PluginSandboxConfig
} from '@/types/plugin';
import {
  loadPlugin,
  unloadPlugin,
  isPluginLoaded,
  PluginLoadOptions
} from './plugin-loader';
import {
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
import { createServiceLogger } from '@/lib/logging';

const execFileAsync = promisify(execFile);
const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'plugin-manager' });

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
            in: ['inactive', 'active']
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
    let resolvedSourcePath: string | null = null;
    let shouldCleanupResolvedSource = false;

    try {
      // Resolve plugin source
      const sourceResolution = await this.resolvePluginSource(options.source);
      resolvedSourcePath = sourceResolution.path;
      shouldCleanupResolvedSource = sourceResolution.cleanup;

      // Load and validate manifest
      const manifestPath = path.join(sourceResolution.path, 'plugin.json');
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
          name: manifest.id,
          version: manifest.version
        }
      });

      if (existingPlugin && !options.force) {
        return {
          success: false,
          error: `Plugin ${manifest.id}@${manifest.version} is already installed. Use force option to reinstall.`
        };
      }

      // Copy plugin to plugins directory if from external source
      const targetPath = path.join(this.config.pluginsDirectory, manifest.id);
      if (sourceResolution.path !== targetPath) {
        await this.copyPlugin(sourceResolution.path, targetPath);
      }

      const authorName = typeof manifest.author === 'string' ? manifest.author : manifest.author.name;

      // Install or update in database
      const dbPlugin = existingPlugin
        ? await prisma.plugin.update({
            where: { id: existingPlugin.id },
            data: {
              version: manifest.version,
              author: authorName,
              status: 'inactive',
              manifest: manifest as unknown as Prisma.JsonObject,
              updated_at: new Date()
            }
          })
        : await prisma.plugin.create({
            data: {
              name: manifest.id,
              version: manifest.version,
              author: authorName,
              status: 'inactive',
              manifest: manifest as unknown as Prisma.JsonObject
            }
          });

      // Load plugin
      const loadResult = await loadPlugin(targetPath, {
        autoRegister: true,
        enableAfterLoad: options.autoEnable || false,
        validateManifest: false // Already validated
      });

      if (!loadResult.success) {
        try {
          await fs.rm(targetPath, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn('Plugin install rollback failed to remove plugin directory', {
            targetPath,
            error: cleanupError,
          });
        }

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
    } finally {
      if (shouldCleanupResolvedSource && resolvedSourcePath) {
        try {
          await fs.rm(resolvedSourcePath, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn('Failed to cleanup resolved plugin source', {
            sourcePath: resolvedSourcePath,
            error: cleanupError,
          });
        }
      }
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

      // Update database
      await prisma.plugin.updateMany({
        where: { name: pluginId },
        data: {
          status: 'active',
          updated_at: new Date()
        }
      });

      // Update in-memory status only after persistence succeeds
      updateRegistryStatus(pluginId, 'active');

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
      if (plugin.status === 'inactive') {
        return {
          success: false,
          error: `Plugin '${pluginId}' is already disabled`
        };
      }

      // Update database
      await prisma.plugin.updateMany({
        where: { name: pluginId },
        data: {
          status: 'inactive',
          updated_at: new Date()
        }
      });

      // Update in-memory status only after persistence succeeds
      updateRegistryStatus(pluginId, 'inactive');

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
      plugins = plugins.filter(p => p.manifest.type === criteria.type || p.manifest.keywords?.includes(criteria.type!));
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
          p.manifest.name.toLowerCase().includes(keyword) ||
          p.manifest.description.toLowerCase().includes(keyword) ||
          p.manifest.keywords?.some((k: string) => k.toLowerCase().includes(keyword))
      );
    }

    // Filter by author
    if (criteria.author) {
      plugins = plugins.filter(p => p.manifest.author.name.toLowerCase().includes(criteria.author!.toLowerCase()));
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
  private async resolvePluginSource(source: string): Promise<{ path: string; cleanup: boolean }> {
    // Handle URL sources by downloading to a temporary file first
    if (/^https?:\/\//i.test(source)) {
      const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibecode-plugin-download-'));
      const sourceUrl = new URL(source);
      const fileName = path.basename(sourceUrl.pathname) || 'plugin.zip';
      const downloadedFilePath = path.join(downloadDir, fileName);
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error(`Failed to download plugin source: ${response.status} ${response.statusText}`);
      }

      const bytes = await response.arrayBuffer();
      await fs.writeFile(downloadedFilePath, Buffer.from(bytes));

      const extractedPath = await this.extractPluginArchive(downloadedFilePath);
      return { path: extractedPath, cleanup: true };
    }

    // Check if it's a local directory
    try {
      const stats = await fs.stat(source);
      if (stats.isDirectory()) {
        return { path: path.resolve(source), cleanup: false };
      }

      if (stats.isFile()) {
        const extractedPath = await this.extractPluginArchive(path.resolve(source));
        return { path: extractedPath, cleanup: true };
      }
    } catch (error) {
      // Not a local directory, continue to other resolution methods
    }

    throw new Error(`Plugin source resolution not implemented for: ${source}`);
  }

  private async extractPluginArchive(archivePath: string): Promise<string> {
    const tempExtractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibecode-plugin-extract-'));
    const extension = archivePath.toLowerCase();

    if (extension.endsWith('.zip')) {
      await execFileAsync('unzip', ['-q', archivePath, '-d', tempExtractDir]);
    } else if (extension.endsWith('.tar.gz') || extension.endsWith('.tgz')) {
      await execFileAsync('tar', ['-xzf', archivePath, '-C', tempExtractDir]);
    } else if (extension.endsWith('.tar')) {
      await execFileAsync('tar', ['-xf', archivePath, '-C', tempExtractDir]);
    } else {
      throw new Error(`Unsupported plugin archive format: ${archivePath}`);
    }

    return this.findPluginRootDirectory(tempExtractDir);
  }

  private async findPluginRootDirectory(baseDir: string): Promise<string> {
    const manifestAtRoot = path.join(baseDir, 'plugin.json');
    try {
      await fs.access(manifestAtRoot);
      return baseDir;
    } catch {
      // Continue searching child directories
    }

    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = path.join(baseDir, entry.name);
      try {
        await fs.access(path.join(candidate, 'plugin.json'));
        return candidate;
      } catch {
        // Continue searching remaining entries
      }
    }

    throw new Error('Plugin archive does not contain plugin.json');
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
