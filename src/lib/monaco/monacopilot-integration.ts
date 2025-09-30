/**
 * Monacopilot Integration for Monaco Editor 0.52
 * 
 * This module provides AI-powered code completion for Monaco Editor
 * using Monacopilot with support for multiple AI providers.
 * 
 * @see https://monacopilot.dev/
 */

import * as monaco from 'monaco-editor';
import { registerCompletion } from 'monacopilot';
import type { RegisterCompletionOptions } from 'monacopilot';
import type { 
  MonacopilotConfig,
  EnhancedMonacopilotConfig,
  MonacopilotRegistration,
  SetupMonacopilot,
  SetupMonacopilotMulti
} from '../../types/monacopilot';

// Re-export types for convenient access
export type {
  MonacopilotConfig,
  EnhancedMonacopilotConfig,
  MonacopilotRegistration,
  AIProvider,
  AIModel,
  OpenAIModel,
  MistralModel,
  AnthropicModel,
  GroqModel,
  CohereModel,
  FireworksModel,
  SupportedLanguage,
  CompletionTrigger,
  RelatedFile,
  ModelParameters,
  ProviderSpecificConfig,
  OpenAIConfig,
  MistralConfig,
  AnthropicConfig,
  GroqConfig
} from '../../types/monacopilot';

/**
 * Register AI completion for a Monaco Editor instance
 * 
 * @param monacoInstance - The Monaco editor instance
 * @param editor - The standalone code editor
 * @param config - Configuration options for Monacopilot
 * @returns Registration object with deregister and trigger methods
 * 
 * @example
 * ```typescript
 * const editor = monaco.editor.create(container, {
 *   language: 'typescript',
 *   theme: 'vs-dark'
 * });
 * 
 * const registration = setupMonacopilot(monaco, editor, {
 *   endpoint: '/api/code-completion',
 *   language: 'typescript',
 *   provider: 'openai',
 *   model: 'gpt-4-turbo',
 *   debug: process.env.NODE_ENV === 'development'
 * });
 * 
 * // Later, cleanup when component unmounts
 * registration.deregister();
 * ```
 */
export const setupMonacopilot: SetupMonacopilot = (
  monacoInstance: typeof monaco,
  editor: monaco.editor.IStandaloneCodeEditor,
  config: MonacopilotConfig | EnhancedMonacopilotConfig
): MonacopilotRegistration => {
  // Convert our config to RegisterCompletionOptions
  const options: RegisterCompletionOptions = {
    language: config.language,
    endpoint: config.endpoint,
    ...(config.headers && { headers: config.headers }),
  };

  // Add enhanced options if available
  if ('trigger' in config && config.trigger) {
    options.trigger = config.trigger;
  }
  if ('filename' in config && config.filename) {
    options.filename = config.filename;
  }
  if ('technologies' in config && config.technologies) {
    options.technologies = config.technologies;
  }
  if ('relatedFiles' in config && config.relatedFiles) {
    options.relatedFiles = config.relatedFiles;
  }
  if ('maxContextLines' in config && config.maxContextLines) {
    options.maxContextLines = config.maxContextLines;
  }
  if ('enableCaching' in config && typeof config.enableCaching === 'boolean') {
    options.enableCaching = config.enableCaching;
  }
  if ('allowFollowUpCompletions' in config && typeof config.allowFollowUpCompletions === 'boolean') {
    options.allowFollowUpCompletions = config.allowFollowUpCompletions;
  }
  if ('onError' in config && config.onError) {
    options.onError = config.onError;
  }
  if ('requestHandler' in config && config.requestHandler) {
    options.requestHandler = config.requestHandler;
  }
  if ('onCompletionShown' in config && config.onCompletionShown) {
    options.onCompletionShown = config.onCompletionShown;
  }
  if ('onCompletionAccepted' in config && config.onCompletionAccepted) {
    options.onCompletionAccepted = config.onCompletionAccepted;
  }
  if ('onCompletionRejected' in config && config.onCompletionRejected) {
    options.onCompletionRejected = config.onCompletionRejected;
  }
  if ('onCompletionRequested' in config && config.onCompletionRequested) {
    options.onCompletionRequested = config.onCompletionRequested;
  }
  if ('onCompletionRequestFinished' in config && config.onCompletionRequestFinished) {
    options.onCompletionRequestFinished = config.onCompletionRequestFinished;
  }
  if ('triggerIf' in config && config.triggerIf) {
    options.triggerIf = config.triggerIf;
  }

  const registration = registerCompletion(monacoInstance, editor, options);

  if (config.debug) {
    console.log('[Monacopilot] AI completion registered', {
      language: config.language,
      endpoint: config.endpoint,
      provider: 'provider' in config ? config.provider : 'default',
      model: 'model' in config ? config.model : 'default',
      trigger: 'trigger' in config ? config.trigger : 'onIdle',
    });
  }

  return registration;
};

/**
 * Setup Monacopilot for multiple editor instances
 * 
 * @param monacoInstance - The Monaco editor instance
 * @param editors - Array of standalone code editors
 * @param config - Configuration options for Monacopilot
 * @returns Array of registration objects for each editor
 * 
 * @example
 * ```typescript
 * const editors = [editor1, editor2, editor3];
 * 
 * const registrations = setupMonacopilotMulti(monaco, editors, {
 *   endpoint: '/api/code-completion',
 *   language: 'typescript',
 *   provider: 'openai',
 *   model: 'gpt-4-turbo'
 * });
 * 
 * // Later, cleanup all registrations
 * registrations.forEach(reg => reg.deregister());
 * ```
 */
export const setupMonacopilotMulti: SetupMonacopilotMulti = (
  monacoInstance: typeof monaco,
  editors: monaco.editor.IStandaloneCodeEditor[],
  config: MonacopilotConfig | EnhancedMonacopilotConfig
): MonacopilotRegistration[] => {
  return editors.map((editor) => {
    return setupMonacopilot(monacoInstance, editor, config);
  });
};
