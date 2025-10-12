/**
 * Monacopilot Integration for Monaco Editor 0.52
 *
 * This module provides AI-powered code completion for Monaco Editor
 * using Monacopilot with support for multiple AI providers.
 *
 * @see https://monacopilot.dev/
 *
 * Note: monacopilot is an optional dependency. If not installed,
 * functions will throw with a helpful error message.
 */

import * as monaco from 'monaco-editor';
import { logger } from '@/lib/logger';

// Dynamic import for optional monacopilot dependency
type RegisterCompletionOptions = {
  language: string;
  endpoint: string;
  headers?: Record<string, string>;
};

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
export async function setupMonacopilot(
  monacoInstance: typeof monaco,
  editor: monaco.editor.IStandaloneCodeEditor,
  config: MonacopilotConfig
): Promise<void> {
  try {
    // Try to dynamically import monacopilot
    const { registerCompletion } = await import('monacopilot');

    const options: RegisterCompletionOptions = {
      language: config.language,
      endpoint: config.endpoint,
      ...(config.headers && { headers: config.headers }),
    };

    registerCompletion(monacoInstance, editor, options);

    if (config.debug) {
      logger.info('[Monacopilot] AI completion registered', {
        language: config.language,
        endpoint: config.endpoint,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Monacopilot is not installed. To enable AI code completion, install it with: npm install monacopilot\nError: ${errorMessage}`
    );
  }
}

/**
 * Setup Monacopilot for multiple editor instances
 */
export async function setupMonacopilotMulti(
  monacoInstance: typeof monaco,
  editors: monaco.editor.IStandaloneCodeEditor[],
  config: MonacopilotConfig
): Promise<void> {
  for (const editor of editors) {
    await setupMonacopilot(monacoInstance, editor, config);
  }
}
