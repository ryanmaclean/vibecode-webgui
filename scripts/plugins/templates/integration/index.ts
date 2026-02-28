/**
 * Integration Plugin Template
 *
 * This template demonstrates how to create an integration plugin that
 * connects VibeCode with external services, APIs, or tools.
 */

import {
  PluginAPI,
  PluginManifest,
  PluginCapabilities,
  PluginContext
} from '@/types/plugin';

import manifest from './plugin.json';

/**
 * Plugin capabilities
 */
const capabilities: PluginCapabilities = {
  providesAIModel: false,
  providesIntegration: true,    // This plugin provides integrations
  providesCommands: true,       // Also provides commands for managing integration
  providesUIComponents: false,
  providesCodeActions: false,
  providesWorkflows: false,
  providesFormatters: false,
  providesLinters: false
};

/**
 * Plugin context
 */
let context: PluginContext | null = null;

/**
 * Integration configuration
 */
interface IntegrationConfig {
  apiKey: string;
  apiUrl: string;
  webhookUrl?: string;
  syncInterval: number;
}

let config: IntegrationConfig | null = null;
let syncTimer: NodeJS.Timeout | null = null;

/**
 * Initialize the plugin
 */
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  ctx.logger.info('Integration plugin initializing...');

  // Load configuration
  config = {
    apiKey: ctx.config.get('apiKey') as string,
    apiUrl: ctx.config.get('apiUrl') as string || 'https://api.example.com',
    webhookUrl: ctx.config.get('webhookUrl') as string | undefined,
    syncInterval: ctx.config.get('syncInterval') as number || 30
  };

  // Validate configuration
  if (!config.apiKey) {
    throw new Error('API key is required. Please configure it in plugin settings.');
  }

  // Test connection to external service
  await testConnection();

  // Register integration
  await registerIntegration(ctx);

  // Register commands
  registerCommands(ctx);

  // Start sync timer if configured
  if (config.syncInterval > 0) {
    startSyncTimer();
  }

  // Register webhook handler if URL provided
  if (config.webhookUrl) {
    await registerWebhook(ctx);
  }

  ctx.logger.info('Integration plugin initialized successfully!');
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('Integration plugin shutting down...');

    // Stop sync timer
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    // Unregister webhook if active
    await unregisterWebhook();

    context = null;
    config = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('Integration plugin installed!');
    context.logger.info('Please configure your API credentials in the plugin settings.');
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('Integration plugin uninstalled.');

    // Clean up any stored data
    await cleanupData();
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context && config) {
    context.logger.info('Integration plugin enabled!');

    // Resume syncing
    if (config.syncInterval > 0) {
      startSyncTimer();
    }
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('Integration plugin disabled.');

    // Stop syncing
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(`Integration plugin updated from ${oldVersion} to ${newVersion}`);

    // Perform any necessary migration
    await migrateData(oldVersion, newVersion);
  }
}

/**
 * Test connection to external service
 */
async function testConnection(): Promise<void> {
  if (!config || !context) {
    throw new Error('Plugin not initialized');
  }

  context.logger.debug('Testing connection to external service...');

  // TODO: Replace with your actual connection test
  // Example:
  // const response = await fetch(`${config.apiUrl}/health`, {
  //   headers: {
  //     'Authorization': `Bearer ${config.apiKey}`
  //   }
  // });
  //
  // if (!response.ok) {
  //   throw new Error(`Connection test failed: ${response.statusText}`);
  // }

  context.logger.debug('Connection test successful');
}

/**
 * Register the integration
 */
async function registerIntegration(ctx: PluginContext): Promise<void> {
  ctx.logger.debug('Registering integration...');

  // TODO: Replace with your actual integration registration
  // Example:
  // await ctx.integration.register({
  //   id: manifest.id,
  //   name: manifest.name,
  //   type: 'service',
  //   status: 'connected',
  //   capabilities: ['sync', 'webhook', 'export', 'import'],
  //   handlers: {
  //     sync: handleSync,
  //     export: handleExport,
  //     import: handleImport
  //   }
  // });

  ctx.logger.debug('Integration registered successfully');
}

/**
 * Register commands
 */
function registerCommands(ctx: PluginContext): void {
  ctx.logger.debug('Registering integration commands...');

  // TODO: Register your commands
  // Example commands:
  // - sync: Manually trigger synchronization
  // - status: Show integration status
  // - configure: Update configuration
  // - export: Export data to external service
  // - import: Import data from external service
}

/**
 * Start automatic sync timer
 */
function startSyncTimer(): void {
  if (!config || !context) return;

  if (syncTimer) {
    clearInterval(syncTimer);
  }

  context.logger.debug(`Starting sync timer (interval: ${config.syncInterval} minutes)`);

  syncTimer = setInterval(async () => {
    try {
      await handleSync();
    } catch (error) {
      context?.logger.error('Sync failed:', error);
    }
  }, config.syncInterval * 60 * 1000);
}

/**
 * Handle synchronization
 */
async function handleSync(): Promise<void> {
  if (!config || !context) {
    throw new Error('Plugin not initialized');
  }

  context.logger.info('Starting synchronization...');

  // TODO: Implement your sync logic
  // Example:
  // 1. Fetch data from external service
  // 2. Compare with local data
  // 3. Update changed items
  // 4. Push local changes to external service

  context.logger.info('Synchronization completed');
}

/**
 * Register webhook handler
 */
async function registerWebhook(ctx: PluginContext): Promise<void> {
  if (!config) return;

  ctx.logger.debug(`Registering webhook: ${config.webhookUrl}`);

  // TODO: Register your webhook with the external service
  // Example:
  // await fetch(`${config.apiUrl}/webhooks`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${config.apiKey}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     url: config.webhookUrl,
  //     events: ['created', 'updated', 'deleted']
  //   })
  // });
}

/**
 * Unregister webhook handler
 */
async function unregisterWebhook(): Promise<void> {
  if (!config || !context) return;

  context.logger.debug('Unregistering webhook...');

  // TODO: Unregister your webhook from the external service
}

/**
 * Handle incoming webhook event
 */
export async function handleWebhook(event: Record<string, unknown>): Promise<void> {
  if (!context) {
    throw new Error('Plugin not initialized');
  }

  context.logger.debug('Received webhook event:', event);

  // TODO: Process the webhook event
  // Example:
  // switch (event.type) {
  //   case 'created':
  //     await handleCreated(event.data);
  //     break;
  //   case 'updated':
  //     await handleUpdated(event.data);
  //     break;
  //   case 'deleted':
  //     await handleDeleted(event.data);
  //     break;
  // }
}

/**
 * Export data to external service
 */
export async function handleExport(data: unknown): Promise<void> {
  if (!config || !context) {
    throw new Error('Plugin not initialized');
  }

  context.logger.info('Exporting data...');

  // TODO: Implement export logic
}

/**
 * Import data from external service
 */
export async function handleImport(): Promise<unknown> {
  if (!config || !context) {
    throw new Error('Plugin not initialized');
  }

  context.logger.info('Importing data...');

  // TODO: Implement import logic
  return null;
}

/**
 * Clean up stored data
 */
async function cleanupData(): Promise<void> {
  if (!context) return;

  context.logger.debug('Cleaning up stored data...');

  // TODO: Remove any stored data or cache
}

/**
 * Migrate data between versions
 */
async function migrateData(oldVersion: string, newVersion: string): Promise<void> {
  if (!context) return;

  context.logger.debug(`Migrating data from ${oldVersion} to ${newVersion}...`);

  // TODO: Implement any necessary data migration
}

/**
 * Get integration status
 */
export function getStatus(): {
  connected: boolean;
  lastSync?: string;
  syncInterval: number;
  webhookActive: boolean;
} {
  return {
    connected: config !== null,
    syncInterval: config?.syncInterval || 0,
    webhookActive: config?.webhookUrl !== undefined
  };
}

/**
 * Plugin API export
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
