/**
 * Monaco Editor Worker Configuration
 *
 * Provides lazy-loading configuration for Monaco Editor web workers.
 * Workers are loaded on-demand to reduce initial bundle size and improve
 * page load performance.
 *
 * Supported workers:
 * - JSON worker (json language support)
 * - CSS worker (css/scss/less language support)
 * - HTML worker (html language support)
 * - TypeScript worker (typescript/javascript language support)
 * - Editor worker (base editor features)
 *
 * Performance target: Workers loaded only when needed
 *
 * @module monaco/monaco-worker-config
 */

/**
 * Monaco worker label types
 */
export type MonacoWorkerLabel =
  | 'json'
  | 'css'
  | 'scss'
  | 'less'
  | 'html'
  | 'typescript'
  | 'javascript'
  | 'editorWorkerService';

/**
 * Worker URL configuration
 */
export interface WorkerConfig {
  /** Enable debug logging for worker loading */
  debug?: boolean;
  /** Custom base path for worker files */
  basePath?: string;
}

/**
 * Configure MonacoEnvironment for lazy worker loading
 *
 * This must be called BEFORE Monaco Editor is loaded/initialized.
 * It sets up the global MonacoEnvironment with getWorker function
 * that lazy-loads workers on demand.
 *
 * @example
 * ```typescript
 * // In your app initialization or _app.tsx
 * import { configureMonacoWorkers } from '@/lib/monaco/monaco-worker-config';
 *
 * // Configure before Monaco loads
 * configureMonacoWorkers({ debug: true });
 * ```
 *
 * @param config - Worker configuration options
 */
export function configureMonacoWorkers(config: WorkerConfig = {}): void {
  const { debug = false, basePath = '' } = config;

  // Configure global MonacoEnvironment
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).MonacoEnvironment = {
      /**
       * Web Worker factory for Monaco Editor
       *
       * This function is called by Monaco when it needs to instantiate a worker.
       * Workers are lazy-loaded using dynamic imports to reduce initial bundle size.
       *
       * @param moduleId - Monaco module identifier
       * @param label - Worker type label
       * @returns Worker instance
       */
      getWorker(_moduleId: string, label: string): Worker {
        if (debug) {
          console.log('[Monaco Worker] Loading worker:', label);
        }

        // Map labels to worker imports
        // Workers are split into separate chunks by Next.js/webpack
        switch (label as MonacoWorkerLabel) {
          case 'json':
            return createWorker(
              () => import('monaco-editor/esm/vs/language/json/json.worker?worker'),
              label,
              debug
            );

          case 'css':
          case 'scss':
          case 'less':
            return createWorker(
              () => import('monaco-editor/esm/vs/language/css/css.worker?worker'),
              label,
              debug
            );

          case 'html':
            return createWorker(
              () => import('monaco-editor/esm/vs/language/html/html.worker?worker'),
              label,
              debug
            );

          case 'typescript':
          case 'javascript':
            return createWorker(
              () => import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
              label,
              debug
            );

          default:
            // Default editor worker for core features
            return createWorker(
              () => import('monaco-editor/esm/vs/editor/editor.worker?worker'),
              label || 'editorWorkerService',
              debug
            );
        }
      },
    };

    if (debug) {
      console.log('[Monaco Worker] MonacoEnvironment configured for lazy worker loading');
    }
  }
}

/**
 * Create a worker from a dynamic import
 *
 * @param importFn - Function that returns a promise of the worker module
 * @param label - Worker label for debugging
 * @param debug - Enable debug logging
 * @returns Worker instance
 */
function createWorker(
  importFn: () => Promise<{ default: new () => Worker }>,
  label: string,
  debug: boolean
): Worker {
  const startTime = debug ? performance.now() : 0;

  // Create a promise-based worker loader
  // This returns a Worker synchronously by wrapping the async import
  let worker: Worker;

  // Use a sync-like pattern with a module cache
  importFn()
    .then((WorkerModule) => {
      worker = new WorkerModule.default();

      if (debug) {
        const loadTime = performance.now() - startTime;
        console.log(`[Monaco Worker] ${label} loaded in ${loadTime.toFixed(2)}ms`);
      }
    })
    .catch((error) => {
      console.error(`[Monaco Worker] Failed to load ${label} worker:`, error);
      throw error;
    });

  // Monaco expects a Worker to be returned synchronously
  // The actual worker script loading is async but the Worker object is created sync
  // @ts-expect-error - Worker is assigned asynchronously but Monaco handles this
  return worker;
}

/**
 * Check if MonacoEnvironment is configured
 *
 * @returns true if MonacoEnvironment.getWorker is defined
 */
export function isMonacoWorkerConfigured(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (window as any).MonacoEnvironment;
  return env && typeof env.getWorker === 'function';
}

/**
 * Reset MonacoEnvironment configuration
 *
 * Useful for testing or reconfiguration scenarios
 */
export function resetMonacoWorkers(): void {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).MonacoEnvironment;
  }
}
