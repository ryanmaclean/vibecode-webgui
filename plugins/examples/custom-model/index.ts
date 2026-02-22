/**
 * Custom AI Model Plugin
 *
 * This example demonstrates how to register a custom AI model provider.
 * It shows how to extend VibeCode's AI capabilities with your own models
 * or third-party AI services.
 */

import {
  PluginAPI,
  PluginManifest,
  PluginCapabilities,
  PluginContext
} from '@/types/plugin';

import {
  AIProvider,
  AIModel
} from '@/lib/ai-providers';

// Import the manifest
import manifest from './plugin.json';

/**
 * Plugin capabilities
 */
const capabilities: PluginCapabilities = {
  providesAIModel: true,         // This plugin provides AI models
  providesIntegration: false,
  providesCommands: false,
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
 * Example custom AI provider configuration
 *
 * This demonstrates how to define a custom provider with multiple models.
 * In a real implementation, this could be:
 * - A self-hosted LLM (e.g., Ollama, LocalAI)
 * - A proprietary AI service
 * - A specialized fine-tuned model
 */
const customProvider: AIProvider = {
  id: 'custom-ai',
  name: 'Custom AI Provider',
  company: 'Example Corp',
  models: [
    {
      id: 'custom-code-model',
      name: 'Custom Code Model',
      description: 'A specialized model fine-tuned for code generation',
      contextWindow: 16384,
      maxTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      costPer1kTokens: {
        input: 0.001,
        output: 0.002
      }
    },
    {
      id: 'custom-chat-model',
      name: 'Custom Chat Model',
      description: 'A conversational model optimized for developer assistance',
      contextWindow: 8192,
      maxTokens: 2048,
      supportsFunctionCalling: false,
      supportsVision: false,
      costPer1kTokens: {
        input: 0.0005,
        output: 0.001
      }
    }
  ],
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: false,
    codeGeneration: true,
    reasoning: true
  },
  pricing: 'low',
  status: 'active'
};

/**
 * Initialize the plugin
 */
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  ctx.logger.info('Custom AI Model plugin initializing...');
  ctx.logger.info(`Registering provider: ${customProvider.name}`);

  // Register the custom AI provider
  registerCustomProvider(ctx, customProvider);

  ctx.logger.info('Custom AI Model plugin initialized successfully!');
  ctx.logger.info(`Registered ${customProvider.models.length} models:`);
  customProvider.models.forEach(model => {
    ctx.logger.info(`  - ${model.name} (${model.id})`);
  });
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('Custom AI Model plugin shutting down...');
    unregisterCustomProvider(context);
    context = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('Custom AI Model plugin installed!');
    context.logger.info('You can now use custom AI models in your workflows.');
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('Custom AI Model plugin uninstalled.');
    context.logger.info('Custom AI providers have been removed.');
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context) {
    context.logger.info('Custom AI Model plugin enabled!');
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('Custom AI Model plugin disabled.');
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(`Custom AI Model plugin updated from ${oldVersion} to ${newVersion}`);
  }
}

/**
 * Register a custom AI provider
 *
 * In a real implementation, this would:
 * 1. Register the provider with VibeCode's AI model registry
 * 2. Set up API endpoints for model inference
 * 3. Configure authentication and rate limiting
 * 4. Add provider to the UI model selector
 */
function registerCustomProvider(ctx: PluginContext, provider: AIProvider): void {
  ctx.logger.debug(`Registering AI provider: ${provider.id}`);

  // Example: In a real implementation, you would call VibeCode's API
  // to register the provider, like:
  //
  // ctx.api.aiModels.registerProvider({
  //   id: provider.id,
  //   name: provider.name,
  //   models: provider.models,
  //   getModelEndpoint: (modelId) => `https://api.example.com/v1/models/${modelId}`,
  //   authenticate: async () => ({ apiKey: process.env.CUSTOM_AI_KEY }),
  //   handleRequest: async (modelId, prompt, options) => {
  //     // Custom inference logic
  //   }
  // });

  ctx.logger.info(`Provider ${provider.id} registered successfully`);
}

/**
 * Unregister the custom AI provider
 */
function unregisterCustomProvider(ctx: PluginContext): void {
  ctx.logger.debug(`Unregistering AI provider: ${customProvider.id}`);

  // Example: Remove the provider from the registry
  // ctx.api.aiModels.unregisterProvider(customProvider.id);

  ctx.logger.info(`Provider ${customProvider.id} unregistered`);
}

/**
 * Get custom model information
 *
 * Export this function so other plugins or the UI can query available models
 */
export function getCustomModels(): AIModel[] {
  return customProvider.models;
}

/**
 * Get provider information
 */
export function getProviderInfo(): AIProvider {
  return customProvider;
}

/**
 * Execute inference with a custom model
 *
 * Example function showing how to implement model inference
 */
export async function executeInference(
  modelId: string,
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }
): Promise<string> {
  if (!context) {
    throw new Error('Plugin not initialized');
  }

  const model = customProvider.models.find(m => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }

  context.logger.debug(`Executing inference with model: ${modelId}`);

  // In a real implementation, this would:
  // 1. Validate the input
  // 2. Make an API call to the AI service
  // 3. Handle streaming if enabled
  // 4. Process and return the response
  //
  // Example:
  // const response = await fetch('https://api.example.com/v1/completions', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.CUSTOM_AI_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     model: modelId,
  //     prompt,
  //     temperature: options?.temperature ?? 0.7,
  //     max_tokens: options?.maxTokens ?? model.maxTokens
  //   })
  // });
  //
  // const data = await response.json();
  // return data.choices[0].text;

  // For this example, return a mock response
  return `Mock response from ${model.name} for prompt: "${prompt}"`;
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
    provider: {
      id: customProvider.id,
      name: customProvider.name,
      modelCount: customProvider.models.length
    },
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
