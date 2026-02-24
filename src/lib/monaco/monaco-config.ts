/**
 * Monaco Editor Environment Configuration
 *
 * This module configures the global MonacoEnvironment for proper worker loading
 * in Next.js applications with dynamic imports and code splitting.
 *
 * Workers are loaded via dynamic imports for optimal bundle splitting and lazy loading.
 * This configuration should be imported in components that use Monaco Editor.
 *
 * @see https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md
 */

/**
 * Configure Monaco Environment for worker loading
 *
 * Sets up window.MonacoEnvironment with a getWorker function that loads
 * the appropriate worker based on the language label.
 *
 * Supported workers:
 * - json: JSON language worker
 * - css/scss/less: CSS language worker
 * - html/handlebars/razor: HTML language worker
 * - typescript/javascript: TypeScript language worker
 * - default: Editor worker (for all other languages)
 *
 * @example
 * ```typescript
 * import { configureMonacoEnvironment } from '@/lib/monaco/monaco-config';
 *
 * // Call before initializing Monaco Editor
 * configureMonacoEnvironment();
 * ```
 */
export function configureMonacoEnvironment(): void {
  if (typeof window === 'undefined') {
    // Skip configuration in SSR environment
    return;
  }

  // Configure MonacoEnvironment for worker loading
  (window as any).MonacoEnvironment = {
    /**
     * Get worker instance for a specific language
     *
     * @param workerId - Unique identifier for the worker
     * @param label - Language label (json, css, html, typescript, javascript, etc.)
     * @returns Worker instance
     */
    getWorker(_workerId: string, label: string): Worker {
      // Map language labels to their respective worker modules
      const workerMap: Record<string, () => Promise<any>> = {
        json: () => import('monaco-editor/esm/vs/language/json/json.worker?worker'),
        css: () => import('monaco-editor/esm/vs/language/css/css.worker?worker'),
        scss: () => import('monaco-editor/esm/vs/language/css/css.worker?worker'),
        less: () => import('monaco-editor/esm/vs/language/css/css.worker?worker'),
        html: () => import('monaco-editor/esm/vs/language/html/html.worker?worker'),
        handlebars: () => import('monaco-editor/esm/vs/language/html/html.worker?worker'),
        razor: () => import('monaco-editor/esm/vs/language/html/html.worker?worker'),
        typescript: () => import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
        javascript: () => import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
      };

      // Get the appropriate worker loader or use default editor worker
      const workerLoader = workerMap[label] || (() => import('monaco-editor/esm/vs/editor/editor.worker?worker'));

      // Return a new Worker instance using the dynamic import
      return new Promise((resolve, reject) => {
        workerLoader()
          .then((WorkerModule) => {
            // Handle both default and named exports
            const WorkerClass = WorkerModule.default || WorkerModule;
            resolve(new WorkerClass());
          })
          .catch(reject);
      }) as any;
    },
  };
}

/**
 * Check if MonacoEnvironment is already configured
 *
 * @returns true if MonacoEnvironment is configured
 */
export function isMonacoEnvironmentConfigured(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (window as any).MonacoEnvironment !== undefined;
}

/**
 * Reset MonacoEnvironment configuration
 *
 * Useful for testing or reinitializing the configuration
 */
export function resetMonacoEnvironment(): void {
  if (typeof window !== 'undefined') {
    (window as any).MonacoEnvironment = undefined;
  }
}
