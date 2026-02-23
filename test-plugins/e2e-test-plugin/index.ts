/**
 * E2e Test Plugin Plugin
 *
 * End-to-end test plugin
 */

import {
  PluginAPI,
  PluginManifest,
  PluginCapabilities,
  PluginContext
} from '@/types/plugin';

// Import the manifest
import manifest from './plugin.json';

/**
 * Plugin capabilities
 */
const capabilities: PluginCapabilities = {
  "providesAIModel": false,
  "providesIntegration": true,
  "providesCommands": true,
  "providesUIComponents": false,
  "providesCodeActions": false,
  "providesWorkflows": false,
  "providesFormatters": false,
  "providesLinters": false
};

/**
 * Plugin context (set during initialization)
 */
let context: PluginContext | null = null;

/**
 * Initialize the plugin
 */
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  ctx.logger.info('E2e Test Plugin plugin initializing...');
  ctx.logger.info(`Plugin ID: ${ctx.pluginId}`);
  ctx.logger.info(`Plugin Path: ${ctx.pluginPath}`);
  ctx.logger.info(`Data Path: ${ctx.dataPath}`);

  // TODO: Add your initialization logic here

  ctx.logger.info('E2e Test Plugin plugin initialized successfully!');
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('E2e Test Plugin plugin shutting down...');
    // TODO: Add cleanup logic here
    context = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('E2e Test Plugin plugin installed!');
    // TODO: Add installation logic here
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('E2e Test Plugin plugin uninstalled.');
    // TODO: Add uninstallation cleanup here
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context) {
    context.logger.info('E2e Test Plugin plugin enabled!');
    // TODO: Add enable logic here
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('E2e Test Plugin plugin disabled.');
    // TODO: Add disable logic here
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(`E2e Test Plugin plugin updated from ${oldVersion} to ${newVersion}`);
    // TODO: Add update migration logic here
  }
}

/**
 * Plugin API export
 *
 * This is the main interface that VibeCode uses to interact with the plugin
 */
const plugin: PluginAPI = {
  manifest: manifest as PluginManifest,
  capabilities,
  initialize,
  destroy,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onUpdate
};

export default plugin;
