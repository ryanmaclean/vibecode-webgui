/**
 * Optimistic Update Middleware for Zustand
 *
 * Provides optimistic updates with automatic rollback on error
 *
 * @module stores/middleware/optimisticMiddleware
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface OptimisticUpdate<T = any> {
  /** Unique update ID */
  id: string;

  /** Previous state snapshot */
  previousState: T;

  /** Timestamp of update */
  timestamp: number;

  /** Whether update is pending */
  pending: boolean;

  /** Error if update failed */
  error?: Error;
}

export interface OptimisticMiddlewareOptions {
  /** Maximum time before auto-rollback (ms) */
  timeout?: number;

  /** Whether to auto-rollback on timeout */
  autoRollback?: boolean;

  /** Error handler callback */
  onError?: (error: Error, update: OptimisticUpdate) => void;

  /** Success handler callback */
  onSuccess?: (update: OptimisticUpdate) => void;
}

// ============================================================================
// Optimistic Update Manager
// ============================================================================

class OptimisticUpdateManager<T = any> {
  private updates: Map<string, OptimisticUpdate<T>> = new Map();
  private options: Required<OptimisticMiddlewareOptions>;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: OptimisticMiddlewareOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000, // 30 seconds
      autoRollback: options.autoRollback ?? true,
      onError: options.onError ?? (() => {}),
      onSuccess: options.onSuccess ?? (() => {}),
    };
  }

  /**
   * Create optimistic update
   */
  create(id: string, previousState: T): OptimisticUpdate<T> {
    const update: OptimisticUpdate<T> = {
      id,
      previousState,
      timestamp: Date.now(),
      pending: true,
    };

    this.updates.set(id, update);

    // Set timeout for auto-rollback
    if (this.options.autoRollback) {
      const timeout = setTimeout(() => {
        this.rollback(id, new Error('Optimistic update timeout'));
      }, this.options.timeout);

      this.timeouts.set(id, timeout);
    }

    return update;
  }

  /**
   * Commit optimistic update
   */
  commit(id: string): void {
    const update = this.updates.get(id);
    if (update) {
      update.pending = false;
      this.options.onSuccess(update);
      this.cleanup(id);
    }
  }

  /**
   * Rollback optimistic update
   */
  rollback(id: string, error?: Error): T | undefined {
    const update = this.updates.get(id);
    if (update) {
      update.pending = false;
      update.error = error;

      if (error) {
        this.options.onError(error, update);
      }

      this.cleanup(id);
      return update.previousState;
    }
  }

  /**
   * Cleanup update and timeout
   */
  private cleanup(id: string): void {
    const timeout = this.timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(id);
    }
    this.updates.delete(id);
  }

  /**
   * Get pending updates
   */
  getPendingUpdates(): OptimisticUpdate<T>[] {
    return Array.from(this.updates.values()).filter((u) => u.pending);
  }

  /**
   * Clear all updates
   */
  clearAll(): void {
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts.clear();
    this.updates.clear();
  }
}

// ============================================================================
// Middleware Implementation
// ============================================================================

export interface OptimisticMiddleware<T = any> {
  optimistic: {
    manager: OptimisticUpdateManager<T>;
    create: (id: string, previousState: T) => OptimisticUpdate<T>;
    commit: (id: string) => void;
    rollback: (id: string, error?: Error) => T | undefined;
    getPendingUpdates: () => OptimisticUpdate<T>[];
    clearAll: () => void;
  };
}

type OptimisticMiddlewareImpl = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<
    T,
    [...Mps, ['optimistic', OptimisticMiddleware<T>]],
    Mcs
  >
) => StateCreator<T, Mps, [['optimistic', OptimisticMiddleware<T>], ...Mcs]>;

/**
 * Create optimistic update middleware for Zustand
 */
export const optimisticMiddleware: (
  options?: OptimisticMiddlewareOptions
) => OptimisticMiddlewareImpl =
  (options = {}) =>
  (initializer) =>
  (set: any, get: any, store: any) => {
    const manager = new OptimisticUpdateManager(options);

    // Add optimistic methods to store
    const optimistic: OptimisticMiddleware['optimistic'] = {
      manager,
      create: manager.create.bind(manager),
      commit: manager.commit.bind(manager),
      rollback: manager.rollback.bind(manager),
      getPendingUpdates: manager.getPendingUpdates.bind(manager),
      clearAll: manager.clearAll.bind(manager),
    };

    // Extend store with optimistic functionality
    const extendedStore = initializer(
      set,
      get,
      store as Parameters<typeof initializer>[2]
    );

    return {
      ...extendedStore,
      optimistic,
    };
  };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create optimistic update wrapper
 */
export function withOptimisticUpdate<T, R>(
  updateId: string,
  getCurrentState: () => T,
  optimisticUpdate: () => void,
  asyncOperation: () => Promise<R>,
  onSuccess?: (result: R) => void,
  onError?: (error: Error, previousState: T) => void
): Promise<R> {
  const manager = new OptimisticUpdateManager<T>();
  const previousState = getCurrentState();

  // Create optimistic update
  manager.create(updateId, previousState);

  // Apply optimistic update immediately
  optimisticUpdate();

  // Execute async operation
  return asyncOperation()
    .then((result) => {
      manager.commit(updateId);
      onSuccess?.(result);
      return result;
    })
    .catch((error) => {
      const rolledBackState = manager.rollback(updateId, error);
      if (rolledBackState) {
        onError?.(error, rolledBackState);
      }
      throw error;
    });
}

/**
 * Generate optimistic update ID
 */
export function generateOptimisticId(prefix = 'opt'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
