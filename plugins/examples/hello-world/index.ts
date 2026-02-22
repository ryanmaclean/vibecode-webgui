/**
 * Hello World Plugin
 *
 * A simple example plugin demonstrating the basic plugin structure.
 * This plugin registers a "hello" command that logs a greeting message.
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
  providesAIModel: false,
  providesIntegration: false,
  providesCommands: true,      // This plugin provides a command
  providesUIComponents: false,
  providesCodeActions: false,
  providesWorkflows: false,
  providesFormatters: false,
  providesLinters: false
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

  ctx.logger.info('Hello World plugin initializing...');
  ctx.logger.info(`Plugin ID: ${ctx.pluginId}`);
  ctx.logger.info(`Plugin Path: ${ctx.pluginPath}`);
  ctx.logger.info(`Data Path: ${ctx.dataPath}`);

  // Register the hello command
  registerHelloCommand(ctx);

  ctx.logger.info('Hello World plugin initialized successfully!');
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('Hello World plugin shutting down...');
    context = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('Hello World plugin installed!');
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('Goodbye from Hello World plugin!');
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context) {
    context.logger.info('Hello World plugin enabled!');
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('Hello World plugin disabled.');
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(`Hello World plugin updated from ${oldVersion} to ${newVersion}`);
  }
}

/**
 * Register the hello command
 *
 * In a real implementation, this would integrate with VibeCode's command system.
 * For this example, we'll just demonstrate the structure.
 */
function registerHelloCommand(ctx: PluginContext): void {
  // Example command registration (pseudo-code - actual implementation would
  // depend on VibeCode's command registration API)
  ctx.logger.debug('Registering "hello" command');

  // The command would be accessible via:
  // - CLI: vibecode hello
  // - UI: Command palette -> "Hello World"
  // - API: POST /api/commands/hello
}

/**
 * Execute the hello command
 *
 * This is what would be called when the user runs the hello command
 */
export function executeHelloCommand(name?: string): string {
  const greeting = name ? `Hello, ${name}!` : 'Hello, World!';

  if (context) {
    context.logger.info(greeting);
  }

  return greeting;
}

/**
 * Get plugin information
 */
export function getPluginInfo(): Record<string, unknown> {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    capabilities,
    status: context ? 'initialized' : 'not-initialized'
  };
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
