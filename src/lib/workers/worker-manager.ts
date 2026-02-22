/**
 * Web Worker Manager for Lifecycle Management
 *
 * Manages the lifecycle of Web Workers with pooling, health monitoring,
 * and resource cleanup for optimal performance when working with large files.
 *
 * Key features:
 * - Worker pooling for resource reuse
 * - Automatic lifecycle management (creation, idle, termination)
 * - Health monitoring and error recovery
 * - Memory-efficient worker limits
 * - Graceful cleanup and termination
 * - Performance metrics and monitoring
 *
 * @module lib/workers/worker-manager
 */

/**
 * Worker types supported by the manager
 */
export type WorkerType = 'syntax-highlighter' | 'ai-processing';

/**
 * Worker state tracking
 */
export type WorkerState = 'idle' | 'active' | 'error' | 'terminated';

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Maximum number of workers to create per type */
  maxWorkers?: number;

  /** Minimum number of workers to keep alive */
  minWorkers?: number;

  /** Maximum idle time before terminating worker (ms) */
  maxIdleTime?: number;

  /** Enable worker reuse */
  enableReuse?: boolean;

  /** Enable health monitoring */
  enableHealthCheck?: boolean;

  /** Health check interval (ms) */
  healthCheckInterval?: number;

  /** Enable performance metrics */
  enableMetrics?: boolean;

  /** Debug mode */
  debug?: boolean;
}

/**
 * Worker instance metadata
 */
export interface WorkerInstance {
  /** Unique worker ID */
  id: string;

  /** Worker type */
  type: WorkerType;

  /** Worker instance */
  worker: Worker;

  /** Current state */
  state: WorkerState;

  /** Creation timestamp */
  createdAt: number;

  /** Last used timestamp */
  lastUsedAt: number;

  /** Number of tasks processed */
  tasksProcessed: number;

  /** Total processing time (ms) */
  totalProcessingTime: number;

  /** Error count */
  errorCount: number;

  /** Last error */
  lastError?: string;
}

/**
 * Worker pool metrics
 */
export interface WorkerPoolMetrics {
  /** Total workers created */
  totalWorkersCreated: number;

  /** Active workers by type */
  activeWorkers: Record<WorkerType, number>;

  /** Idle workers by type */
  idleWorkers: Record<WorkerType, number>;

  /** Total tasks processed */
  totalTasksProcessed: number;

  /** Average task processing time (ms) */
  averageProcessingTime: number;

  /** Total errors */
  totalErrors: number;

  /** Workers terminated */
  workersTerminated: number;

  /** Pool utilization (0-1) */
  poolUtilization: number;
}

/**
 * Worker acquisition options
 */
export interface AcquireWorkerOptions {
  /** Worker type to acquire */
  type: WorkerType;

  /** Timeout for acquiring worker (ms) */
  timeout?: number;

  /** Create new worker if none available */
  createIfUnavailable?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<WorkerPoolConfig> = {
  maxWorkers: 4,
  minWorkers: 1,
  maxIdleTime: 60000, // 1 minute
  enableReuse: true,
  enableHealthCheck: true,
  healthCheckInterval: 30000, // 30 seconds
  enableMetrics: true,
  debug: false,
};

/**
 * Worker paths by type
 */
const WORKER_PATHS: Record<WorkerType, string> = {
  'syntax-highlighter': '/workers/syntax-highlighter.worker.js',
  'ai-processing': '/workers/ai-processing.worker.js',
};

/**
 * Web Worker Manager Class
 *
 * Manages a pool of Web Workers with lifecycle management, health monitoring,
 * and resource cleanup.
 */
export class WorkerManager {
  private config: Required<WorkerPoolConfig>;
  private workers: Map<string, WorkerInstance> = new Map();
  private idleWorkers: Map<WorkerType, string[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Metrics
  private metrics = {
    totalWorkersCreated: 0,
    totalTasksProcessed: 0,
    totalProcessingTime: 0,
    totalErrors: 0,
    workersTerminated: 0,
  };

  constructor(config: WorkerPoolConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize idle worker queues
    this.idleWorkers.set('syntax-highlighter', []);
    this.idleWorkers.set('ai-processing', []);

    // Start health monitoring if enabled
    if (this.config.enableHealthCheck) {
      this.startHealthMonitoring();
    }

    // Start cleanup monitoring
    this.startCleanupMonitoring();

    if (this.config.debug) {
      console.log('[WorkerManager] Initialized with config:', this.config);
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Acquire a worker from the pool
   *
   * @param options - Acquisition options
   * @returns Worker instance or null if unavailable
   */
  async acquireWorker(options: AcquireWorkerOptions): Promise<WorkerInstance | null> {
    const { type, timeout = 5000, createIfUnavailable = true } = options;

    // Try to get idle worker first
    const idleWorker = this.getIdleWorker(type);
    if (idleWorker) {
      idleWorker.state = 'active';
      idleWorker.lastUsedAt = Date.now();

      if (this.config.debug) {
        console.log(`[WorkerManager] Acquired idle worker ${idleWorker.id} of type ${type}`);
      }

      return idleWorker;
    }

    // Create new worker if below limit and creation allowed
    if (createIfUnavailable && this.canCreateWorker(type)) {
      const worker = await this.createWorker(type);

      if (this.config.debug) {
        console.log(`[WorkerManager] Created new worker ${worker.id} of type ${type}`);
      }

      return worker;
    }

    // Wait for worker to become available
    if (timeout > 0) {
      const worker = await this.waitForWorker(type, timeout);
      if (worker) {
        return worker;
      }
    }

    if (this.config.debug) {
      console.log(`[WorkerManager] No worker available for type ${type}`);
    }

    return null;
  }

  /**
   * Release a worker back to the pool
   *
   * @param workerId - Worker ID to release
   */
  releaseWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      if (this.config.debug) {
        console.warn(`[WorkerManager] Cannot release unknown worker ${workerId}`);
      }
      return;
    }

    // Update state
    worker.state = 'idle';
    worker.lastUsedAt = Date.now();

    // Add to idle queue if reuse is enabled
    if (this.config.enableReuse) {
      const idleQueue = this.idleWorkers.get(worker.type);
      if (idleQueue && !idleQueue.includes(workerId)) {
        idleQueue.push(workerId);
      }

      if (this.config.debug) {
        console.log(`[WorkerManager] Released worker ${workerId} to idle pool`);
      }
    } else {
      // Terminate if reuse is disabled
      this.terminateWorker(workerId);
    }
  }

  /**
   * Report task completion for a worker
   *
   * @param workerId - Worker ID
   * @param processingTime - Time taken to process task (ms)
   */
  reportTaskCompletion(workerId: string, processingTime: number): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.tasksProcessed++;
    worker.totalProcessingTime += processingTime;

    if (this.config.enableMetrics) {
      this.metrics.totalTasksProcessed++;
      this.metrics.totalProcessingTime += processingTime;
    }
  }

  /**
   * Report worker error
   *
   * @param workerId - Worker ID
   * @param error - Error message
   */
  reportWorkerError(workerId: string, error: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.errorCount++;
    worker.lastError = error;
    worker.state = 'error';

    if (this.config.enableMetrics) {
      this.metrics.totalErrors++;
    }

    if (this.config.debug) {
      console.error(`[WorkerManager] Worker ${workerId} error:`, error);
    }

    // Terminate worker if it has too many errors
    if (worker.errorCount >= 3) {
      if (this.config.debug) {
        console.warn(`[WorkerManager] Terminating worker ${workerId} due to repeated errors`);
      }
      this.terminateWorker(workerId);
    }
  }

  /**
   * Terminate a specific worker
   *
   * @param workerId - Worker ID to terminate
   */
  terminateWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Remove from idle queue
    const idleQueue = this.idleWorkers.get(worker.type);
    if (idleQueue) {
      const index = idleQueue.indexOf(workerId);
      if (index !== -1) {
        idleQueue.splice(index, 1);
      }
    }

    // Terminate worker
    worker.worker.terminate();
    worker.state = 'terminated';

    // Remove from pool
    this.workers.delete(workerId);

    if (this.config.enableMetrics) {
      this.metrics.workersTerminated++;
    }

    if (this.config.debug) {
      console.log(`[WorkerManager] Terminated worker ${workerId}`);
    }
  }

  /**
   * Terminate all workers and cleanup
   */
  terminateAll(): void {
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Terminate all workers
    for (const workerId of Array.from(this.workers.keys())) {
      this.terminateWorker(workerId);
    }

    // Clear pools
    this.workers.clear();
    this.idleWorkers.get('syntax-highlighter')?.splice(0);
    this.idleWorkers.get('ai-processing')?.splice(0);

    if (this.config.debug) {
      console.log('[WorkerManager] All workers terminated');
    }
  }

  /**
   * Get pool metrics
   *
   * @returns Current pool metrics
   */
  getMetrics(): WorkerPoolMetrics {
    const activeWorkers: Record<WorkerType, number> = {
      'syntax-highlighter': 0,
      'ai-processing': 0,
    };

    const idleWorkers: Record<WorkerType, number> = {
      'syntax-highlighter': 0,
      'ai-processing': 0,
    };

    // Count workers by state and type
    for (const worker of Array.from(this.workers.values())) {
      if (worker.state === 'active') {
        activeWorkers[worker.type]++;
      } else if (worker.state === 'idle') {
        idleWorkers[worker.type]++;
      }
    }

    const totalWorkers = this.workers.size;
    const totalActive = Object.values(activeWorkers).reduce((sum, count) => sum + count, 0);
    const poolUtilization = totalWorkers > 0 ? totalActive / totalWorkers : 0;

    const averageProcessingTime =
      this.metrics.totalTasksProcessed > 0
        ? this.metrics.totalProcessingTime / this.metrics.totalTasksProcessed
        : 0;

    return {
      totalWorkersCreated: this.metrics.totalWorkersCreated,
      activeWorkers,
      idleWorkers,
      totalTasksProcessed: this.metrics.totalTasksProcessed,
      averageProcessingTime,
      totalErrors: this.metrics.totalErrors,
      workersTerminated: this.metrics.workersTerminated,
      poolUtilization,
    };
  }

  /**
   * Get all workers of a specific type
   *
   * @param type - Worker type
   * @returns Array of worker instances
   */
  getWorkersByType(type: WorkerType): WorkerInstance[] {
    return Array.from(this.workers.values()).filter((worker) => worker.type === type);
  }

  /**
   * Get worker by ID
   *
   * @param workerId - Worker ID
   * @returns Worker instance or undefined
   */
  getWorker(workerId: string): WorkerInstance | undefined {
    return this.workers.get(workerId);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get an idle worker from the pool
   */
  private getIdleWorker(type: WorkerType): WorkerInstance | null {
    const idleQueue = this.idleWorkers.get(type);
    if (!idleQueue || idleQueue.length === 0) {
      return null;
    }

    // Get first idle worker
    const workerId = idleQueue.shift();
    if (!workerId) return null;

    const worker = this.workers.get(workerId);
    if (!worker || worker.state !== 'idle') {
      // Worker is invalid, try next
      return this.getIdleWorker(type);
    }

    return worker;
  }

  /**
   * Check if a new worker can be created
   */
  private canCreateWorker(type: WorkerType): boolean {
    const typeWorkers = this.getWorkersByType(type);
    return typeWorkers.length < this.config.maxWorkers;
  }

  /**
   * Create a new worker
   */
  private async createWorker(type: WorkerType): Promise<WorkerInstance> {
    const workerId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const workerPath = WORKER_PATHS[type];

    // Create worker instance
    const worker = new Worker(workerPath, { type: 'module' });

    // Create worker metadata
    const instance: WorkerInstance = {
      id: workerId,
      type,
      worker,
      state: 'active',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tasksProcessed: 0,
      totalProcessingTime: 0,
      errorCount: 0,
    };

    // Add to pool
    this.workers.set(workerId, instance);

    if (this.config.enableMetrics) {
      this.metrics.totalWorkersCreated++;
    }

    // Wait for worker ready signal
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 5000);

      worker.addEventListener('message', function onMessage(event) {
        if (event.data.type === 'READY') {
          clearTimeout(timeout);
          worker.removeEventListener('message', onMessage);
          resolve();
        }
      });

      worker.addEventListener('error', function onError(error) {
        clearTimeout(timeout);
        worker.removeEventListener('error', onError);
        reject(error);
      });
    });

    return instance;
  }

  /**
   * Wait for a worker to become available
   */
  private async waitForWorker(type: WorkerType, timeout: number): Promise<WorkerInstance | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const worker = this.getIdleWorker(type);
      if (worker) {
        worker.state = 'active';
        worker.lastUsedAt = Date.now();
        return worker;
      }

      // Wait a bit before trying again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all workers
   */
  private performHealthCheck(): void {
    for (const worker of Array.from(this.workers.values())) {
      // Check if worker is in error state
      if (worker.state === 'error') {
        if (this.config.debug) {
          console.warn(
            `[WorkerManager] Health check: Worker ${worker.id} in error state, terminating`
          );
        }
        this.terminateWorker(worker.id);
      }
    }
  }

  /**
   * Start cleanup monitoring for idle workers
   */
  private startCleanupMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleWorkers();
    }, this.config.maxIdleTime / 2);
  }

  /**
   * Cleanup idle workers that exceeded max idle time
   */
  private cleanupIdleWorkers(): void {
    const now = Date.now();

    for (const worker of Array.from(this.workers.values())) {
      // Skip if not idle
      if (worker.state !== 'idle') continue;

      // Calculate idle time
      const idleTime = now - worker.lastUsedAt;

      // Terminate if exceeded max idle time and above minimum workers
      if (idleTime > this.config.maxIdleTime) {
        const typeWorkers = this.getWorkersByType(worker.type);
        if (typeWorkers.length > this.config.minWorkers) {
          if (this.config.debug) {
            console.log(
              `[WorkerManager] Terminating idle worker ${worker.id} (idle for ${idleTime}ms)`
            );
          }
          this.terminateWorker(worker.id);
        }
      }
    }
  }
}

/**
 * Singleton instance for global worker management
 */
let globalWorkerManager: WorkerManager | null = null;

/**
 * Get or create the global worker manager instance
 *
 * @param config - Optional configuration (only used on first call)
 * @returns Global worker manager instance
 */
export function getWorkerManager(config?: WorkerPoolConfig): WorkerManager {
  if (!globalWorkerManager) {
    globalWorkerManager = new WorkerManager(config);
  }
  return globalWorkerManager;
}

/**
 * Cleanup global worker manager
 */
export function cleanupWorkerManager(): void {
  if (globalWorkerManager) {
    globalWorkerManager.terminateAll();
    globalWorkerManager = null;
  }
}
