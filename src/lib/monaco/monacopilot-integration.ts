/**
 * Monacopilot Integration for Monaco Editor 0.52
 * 
 * This module provides AI-powered code completion for Monaco Editor
 * using Monacopilot with support for multiple AI providers.
 * 
 * @see https://monacopilot.dev/
 */

import * as monaco from 'monaco-editor';
import { registerCompletion, type RegisterCompletionOptions } from 'monacopilot';

export interface MonacopilotConfig {
  /** API endpoint for completion requests */
  endpoint: string;
  /** Programming language */
  language: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom request headers */
  headers?: Record<string, string>;
}

/**
 * Register AI completion for a Monaco Editor instance
 * 
 * @example
 * ```typescript
 * const editor = monaco.editor.create(container, {
 *   language: 'typescript',
 *   theme: 'vs-dark'
 * });
 * 
 * setupMonacopilot(monaco, editor, {
 *   endpoint: '/api/code-completion',
 *   language: 'typescript'
 * });
 * ```
 */
export function setupMonacopilot(
  monacoInstance: typeof monaco,
  editor: monaco.editor.IStandaloneCodeEditor,
  config: MonacopilotConfig
): void {
  const options: RegisterCompletionOptions = {
    language: config.language,
    endpoint: config.endpoint,
    ...(config.headers && { headers: config.headers }),
  };

  registerCompletion(monacoInstance, editor, options);

  if (config.debug) {
    console.log('[Monacopilot] AI completion registered', {
      language: config.language,
      endpoint: config.endpoint,
    });
  }
}

/**
 * Setup Monacopilot for multiple editor instances
 */
export function setupMonacopilotMulti(
  monacoInstance: typeof monaco,
  editors: monaco.editor.IStandaloneCodeEditor[],
  config: MonacopilotConfig
): void {
  editors.forEach((editor) => {
    setupMonacopilot(monacoInstance, editor, config);
  });
}
