/**
 * AI Model Provider Plugin Template
 *
 * This template demonstrates how to create a custom AI model provider plugin.
 * Replace the placeholder implementation with your actual model integration.
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
  providesAIModel: true,        // This plugin provides AI models
  providesIntegration: false,
  providesCommands: false,
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
 * Model configuration
 */
interface ModelConfig {
  apiKey: string;
  endpoint: string;
  defaultModel: string;
}

let config: ModelConfig | null = null;

/**
 * Initialize the plugin
 */
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  ctx.logger.info('AI Model Provider plugin initializing...');

  // Load configuration
  config = {
    apiKey: ctx.config.get('apiKey') as string,
    endpoint: ctx.config.get('endpoint') as string || 'https://api.example.com/v1',
    defaultModel: ctx.config.get('defaultModel') as string || 'gpt-4'
  };

  // Validate configuration
  if (!config.apiKey) {
    throw new Error('API key is required. Please configure it in plugin settings.');
  }

  // Register the AI model provider
  await registerModelProvider(ctx);

  ctx.logger.info('AI Model Provider plugin initialized successfully!');
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('AI Model Provider plugin shutting down...');
    context = null;
    config = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('AI Model Provider plugin installed!');
    context.logger.info('Please configure your API key in the plugin settings.');
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('AI Model Provider plugin uninstalled.');
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context) {
    context.logger.info('AI Model Provider plugin enabled!');
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('AI Model Provider plugin disabled.');
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(`AI Model Provider plugin updated from ${oldVersion} to ${newVersion}`);
  }
}

/**
 * Register the AI model provider
 */
async function registerModelProvider(ctx: PluginContext): Promise<void> {
  ctx.logger.debug('Registering AI model provider...');

  // TODO: Replace this with your actual model provider registration
  // Example structure:
  //
  // await ctx.ai.registerProvider({
  //   id: manifest.id,
  //   name: manifest.name,
  //   models: getAvailableModels(),
  //   chat: handleChatRequest,
  //   completion: handleCompletionRequest,
  //   embedding: handleEmbeddingRequest
  // });

  ctx.logger.debug('AI model provider registered successfully');
}

/**
 * Get available models from this provider
 */
export function getAvailableModels(): Array<{
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  capabilities: string[];
}> {
  // TODO: Replace with your actual models
  return [
    {
      id: 'my-model-small',
      name: 'My Model Small',
      description: 'Fast and efficient model for simple tasks',
      contextWindow: 8192,
      capabilities: ['chat', 'completion']
    },
    {
      id: 'my-model-large',
      name: 'My Model Large',
      description: 'Powerful model for complex tasks',
      contextWindow: 32768,
      capabilities: ['chat', 'completion', 'embedding']
    }
  ];
}

/**
 * Handle chat completion request
 */
export async function handleChatRequest(
  messages: Array<{ role: string; content: string }>,
  options?: Record<string, unknown>
): Promise<{ content: string; usage?: Record<string, number> }> {
  if (!config) {
    throw new Error('Plugin not initialized');
  }

  // TODO: Replace with your actual API call
  // Example:
  // const response = await fetch(`${config.endpoint}/chat/completions`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${config.apiKey}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     model: options?.model || config.defaultModel,
  //     messages,
  //     ...options
  //   })
  // });
  //
  // const data = await response.json();
  // return {
  //   content: data.choices[0].message.content,
  //   usage: data.usage
  // };

  throw new Error('Not implemented - replace with your model API call');
}

/**
 * Handle text completion request
 */
export async function handleCompletionRequest(
  prompt: string,
  options?: Record<string, unknown>
): Promise<{ content: string; usage?: Record<string, number> }> {
  if (!config) {
    throw new Error('Plugin not initialized');
  }

  // TODO: Implement your completion logic
  throw new Error('Not implemented - replace with your model API call');
}

/**
 * Handle embedding request
 */
export async function handleEmbeddingRequest(
  text: string,
  options?: Record<string, unknown>
): Promise<{ embedding: number[]; usage?: Record<string, number> }> {
  if (!config) {
    throw new Error('Plugin not initialized');
  }

  // TODO: Implement your embedding logic
  throw new Error('Not implemented - replace with your model API call');
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
