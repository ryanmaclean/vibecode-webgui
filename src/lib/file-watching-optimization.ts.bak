/**
 * File Watching Optimization
 *
 * High-performance file watching with intelligent batching and filtering
 * Optimizes file system monitoring for large codebases and rapid changes
 *
 * Staff Engineer Implementation - Enterprise-grade file watching performance
 */

import * as chokidar from 'chokidar'
import { EventEmitter } from 'events'
import path from 'path'

// Minimal utilities to avoid lodash dependency
type Debounced<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & { flush: () => void; cancel: () => void }

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number, options?: { maxWait?: number }): Debounced<T> {
  let timeout: NodeJS.Timeout | null = null
  let startTime: number | null = null
  const maxWait = options?.maxWait
  const wrapper = ((...args: Parameters<T>) => {
    const now = Date.now()
    if (startTime === null) startTime = now
    if (timeout) clearTimeout(timeout)
    const shouldFlush = typeof maxWait === 'number' && now - startTime >= maxWait
    if (shouldFlush) {
      startTime = now
      fn(...args)
      return
    }
    timeout = setTimeout(() => {
      startTime = null
      fn(...args)
    }, wait)
  }) as Debounced<T>
  wrapper.flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    startTime = null
    // Execute immediately with no args
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(fn as any)()
  }
  wrapper.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    startTime = null
  }
  return wrapper
}

function throttle<T extends (...args: any[]) => void>(fn: T, wait: number, opts?: { leading?: boolean; trailing?: boolean }) {
  const leading = opts?.leading !== false
  const trailingEnabled = opts?.trailing !== false
  let last = 0
  let trailing: NodeJS.Timeout | null = null
  let lastArgs: Parameters<T> | null = null
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (!last && !leading) last = now
    const remaining = wait - (now - last)
    lastArgs = args
    if (remaining <= 0) {
      if (trailing) {
        clearTimeout(trailing)
        trailing = null
      }
      last = now
      fn(...args)
    } else if (trailingEnabled && !trailing) {
      trailing = setTimeout(() => {
        last = leading === false ? 0 : Date.now()
        trailing = null
        if (lastArgs) fn(...lastArgs)
      }, remaining)
    }
  }
}

interface OptimizedWatcherConfig {
  watchPath: string
  ignored?: string[]
  batchDelay?: number
  throttleDelay?: number
  maxBatchSize?: number
  enablePolling?: boolean
  pollingInterval?: number
  depth?: number
  followSymlinks?: boolean
  enableStats?: boolean
}

interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
  stats?: any
  timestamp: number
}

interface BatchedChanges {
  events: FileChangeEvent[]
  timestamp: number
  batchId: string
}

interface WatcherStats {
  totalEvents: number
  batchesProcessed: number
  averageBatchSize: number
  eventsPerSecond: number
  filteredEvents: number
  lastBatchTime: number
}

export class OptimizedFileWatcher extends EventEmitter {
  private config: Required<OptimizedWatcherConfig>
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private pendingEvents: FileChangeEvent[] = []
  private stats: WatcherStats
  private isWatching = false
  private batchProcessor: Debounced<() => Promise<void>>
  private eventThrottle: Map<string, ReturnType<typeof throttle>> = new Map()
  private recentEvents = new Set<string>()
  private startTime = Date.now()

  constructor(config: OptimizedWatcherConfig) {
    super()

    this.config = {
      watchPath: config.watchPath,
      ignored: config.ignored || this.getDefaultIgnorePatterns(),
      batchDelay: config.batchDelay || 100,
      throttleDelay: config.throttleDelay || 50,
      maxBatchSize: config.maxBatchSize || 1000,
      enablePolling: config.enablePolling || false,
      pollingInterval: config.pollingInterval || 1000,
      depth: config.depth || 10,
      followSymlinks: config.followSymlinks || false,
      enableStats: config.enableStats || true
    }

    this.stats = {
      totalEvents: 0,
      batchesProcessed: 0,
      averageBatchSize: 0,
      eventsPerSecond: 0,
      filteredEvents: 0,
      lastBatchTime: 0
    }

    this.batchProcessor = debounce(
      this.processBatch.bind(this),
      this.config.batchDelay,
      { maxWait: this.config.batchDelay * 5 }
    )
  }

  /**
   * Start watching files
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      throw new Error('Watcher is already running')
    }

    try {
      await this.initializeWatcher()
      this.isWatching = true
      this.emit('ready')
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return
    }

    try {
      if (this.watcher) {
        await this.watcher.close()
        this.watcher = null
      }

      // Process any pending events
      if (this.pendingEvents.length > 0) {
        await this.processBatch()
      }

      this.isWatching = false
      this.eventThrottle.clear()
      this.recentEvents.clear()
      this.emit('stopped')

    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Initialize the file watcher with optimizations
   */
  private async initializeWatcher(): Promise<void> {
    const watchOptions = {
      ignored: this.config.ignored,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: this.config.followSymlinks,
      depth: this.config.depth,

      // Performance optimizations
      usePolling: this.config.enablePolling,
      interval: this.config.pollingInterval,
      binaryInterval: this.config.pollingInterval * 2,

      // Stability optimizations
      awaitWriteFinish: {
        stabilityThreshold: this.config.batchDelay,
        pollInterval: Math.max(this.config.batchDelay / 4, 25)
      },

      // File system optimizations
      atomic: true,
      ignorePermissionErrors: true,

      // Advanced options for large directories
      alwaysStat: this.config.enableStats,
      disableGlobbing: true
    }

    this.watcher = chokidar.watch(this.config.watchPath, watchOptions)

    // Setup event handlers with optimization
    this.setupEventHandlers()
  }

  /**
   * Setup optimized event handlers
   */
  private setupEventHandlers(): void {
    if (!this.watcher) return

    // File events with intelligent throttling
    this.watcher
      .on('add', (filePath: string, stats?: unknown) => this.handleFileEvent('add', filePath, stats))
      .on('change', (filePath: string, stats?: unknown) => this.handleFileEvent('change', filePath, stats))
      .on('unlink', (filePath: string) => this.handleFileEvent('unlink', filePath))
      .on('addDir', (dirPath: string, stats?: unknown) => this.handleFileEvent('addDir', dirPath, stats))
      .on('unlinkDir', (dirPath: string) => this.handleFileEvent('unlinkDir', dirPath))
      .on('error', (error: unknown) => this.emit('error', error))
      .on('ready', () => this.emit('watcher-ready'))
  }

  /**
   * Handle file system events with optimizations
   */
  private handleFileEvent(
    type: FileChangeEvent['type'],
    filePath: string,
    stats?: any
  ): void {
    // Normalize path
    const normalizedPath = path.normalize(filePath)

    // Apply additional filtering
    if (this.shouldIgnoreEvent(normalizedPath, type)) {
      this.stats.filteredEvents++
      return
    }

    // Create event object
    const event: FileChangeEvent = {
      type,
      path: normalizedPath,
      stats,
      timestamp: Date.now()
    }

    // Apply throttling for rapid changes to same file
    this.applyThrottling(normalizedPath, event)
  }

  /**
   * Apply intelligent throttling to prevent event spam
   */
  private applyThrottling(filePath: string, event: FileChangeEvent): void {
    const eventKey = `${filePath}-${event.type}`

    // Check for duplicate recent events
    if (this.recentEvents.has(eventKey)) {
      return
    }

    // Add to recent events with automatic cleanup
    this.recentEvents.add(eventKey)
    setTimeout(() => {
      this.recentEvents.delete(eventKey)
    }, this.config.throttleDelay * 2)

    // Get or create throttled handler for this file
    let throttledHandler = this.eventThrottle.get(filePath)
    if (!throttledHandler) {
      throttledHandler = throttle(
        (latestEvent: FileChangeEvent) => this.addToBatch(latestEvent),
        this.config.throttleDelay,
        { leading: true, trailing: true }
      )
      this.eventThrottle.set(filePath, throttledHandler)
    }

    // Apply throttling
    throttledHandler(event)
  }

  /**
   * Add event to batch for processing
   */
  private addToBatch(event: FileChangeEvent): void {
    this.pendingEvents.push(event)
    this.stats.totalEvents++

    // Process batch if it reaches max size
    if (this.pendingEvents.length >= this.config.maxBatchSize) {
      this.processBatch()
    } else {
      // Schedule batch processing
      this.batchProcessor()
    }
  }

  /**
   * Process batched events
   */
  private async processBatch(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return
    }

    const events = [...this.pendingEvents]
    this.pendingEvents = []

    // Optimize batch: remove duplicates and merge related events
    const optimizedEvents = this.optimizeBatch(events)

    const batch: BatchedChanges = {
      events: optimizedEvents,
      timestamp: Date.now(),
      batchId: this.generateBatchId()
    }

    // Update statistics
    this.updateStats(batch)

    // Emit batch event
    this.emit('batch', batch)

    // Emit individual events for compatibility
    optimizedEvents.forEach(event => {
      this.emit('file-change', event)
    })
  }

  /**
   * Optimize batch by removing duplicates and merging events
   */
  private optimizeBatch(events: FileChangeEvent[]): FileChangeEvent[] {
    // Group events by file path
    const eventsByPath = new Map<string, FileChangeEvent[]>()

    events.forEach(event => {
      const pathEvents = eventsByPath.get(event.path) || []
      pathEvents.push(event)
      eventsByPath.set(event.path, pathEvents)
    })

    const optimizedEvents: FileChangeEvent[] = []

    // Process each file's events
    eventsByPath.forEach((fileEvents, filePath) => {
      if (fileEvents.length === 1) {
        optimizedEvents.push(fileEvents[0])
        return
      }

      // Sort by timestamp
      fileEvents.sort((a, b) => a.timestamp - b.timestamp)

      // Apply optimization rules
      const lastEvent = fileEvents[fileEvents.length - 1]

      // If file ends up deleted, only keep the delete event
      if (lastEvent.type === 'unlink' || lastEvent.type === 'unlinkDir') {
        optimizedEvents.push(lastEvent)
        return
      }

      // For other cases, keep the latest event
      optimizedEvents.push(lastEvent)
    })

    return optimizedEvents.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Check if event should be ignored
   */
  private shouldIgnoreEvent(filePath: string, type: FileChangeEvent['type']): boolean {
    // Check file extension filters
    const ext = path.extname(filePath).toLowerCase()
    const ignoredExtensions = [
      '.tmp', '.temp', '.swp', '.swo', '.log', '.lock',
      '.DS_Store', 'Thumbs.db', '.git', '.svn'
    ]

    if (ignoredExtensions.some(ignored => filePath.includes(ignored))) {
      return true
    }

    // Check for temporary files
    const fileName = path.basename(filePath)
    if (fileName.startsWith('.') && fileName.endsWith('.tmp')) {
      return true
    }

    // Check for backup files
    if (fileName.includes('~') || fileName.endsWith('.bak')) {
      return true
    }

    // Check directory depth for performance
    const depth = filePath.split(path.sep).length
    if (depth > this.config.depth) {
      return true
    }

    return false
  }

  /**
   * Update performance statistics
   */
  private updateStats(batch: BatchedChanges): void {
    this.stats.batchesProcessed++
    this.stats.lastBatchTime = batch.timestamp

    // Calculate average batch size
    this.stats.averageBatchSize = Math.round(
      this.stats.totalEvents / this.stats.batchesProcessed
    )

    // Calculate events per second
    const elapsedSeconds = (Date.now() - this.startTime) / 1000
    this.stats.eventsPerSecond = Math.round(
      this.stats.totalEvents / elapsedSeconds
    )
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get default ignore patterns
   */
  private getDefaultIgnorePatterns(): string[] {
    return [
      // Dependencies
      '**/node_modules/**',
      '**/bower_components/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',

      // Version control
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',

      // IDE and editor files
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.swp',
      '**/*.swo',
      '**/*~',

      // System files
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.tmp',
      '**/*.temp',
      '**/*.log',
      '**/*.lock',

      // Cache directories
      '**/.cache/**',
      '**/coverage/**',
      '**/.nyc_output/**',

      // Environment files
      '**/.env',
      '**/.env.local',
      '**/.env.production',
      '**/.env.*.local'
    ]
  }

  /**
   * Get current statistics
   */
  getStats(): WatcherStats {
    return { ...this.stats }
  }

  /**
   * Get watcher status
   */
  isActive(): boolean {
    return this.isWatching
  }

  /**
   * Force process pending events
   */
  async flush(): Promise<void> {
    if (this.pendingEvents.length > 0) {
      this.batchProcessor.flush()
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimizedWatcherConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Recreate batch processor with new delay
    if (newConfig.batchDelay) {
      this.batchProcessor = debounce(
        this.processBatch.bind(this),
        this.config.batchDelay,
        { maxWait: this.config.batchDelay * 5 }
      )
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.stop()
    this.batchProcessor.cancel()
    this.eventThrottle.clear()
    this.recentEvents.clear()
    this.removeAllListeners()
  }
}

/**
 * Factory function to create optimized watcher
 */
export function createOptimizedWatcher(
  watchPath: string,
  options: Partial<OptimizedWatcherConfig> = {}
): OptimizedFileWatcher {
  return new OptimizedFileWatcher({
    watchPath,
    ...options
  })
}

/**
 * Workspace-specific watcher manager
 */
export class WorkspaceWatcherManager {
  private watchers = new Map<string, OptimizedFileWatcher>()
  private globalStats = {
    totalWorkspaces: 0,
    totalEvents: 0,
    totalBatches: 0
  }

  /**
   * Create watcher for workspace
   */
  async createWatcher(
    workspaceId: string,
    workspacePath: string,
    options: Partial<OptimizedWatcherConfig> = {}
  ): Promise<OptimizedFileWatcher> {
    if (this.watchers.has(workspaceId)) {
      throw new Error(`Watcher already exists for workspace: ${workspaceId}`)
    }

    const watcher = createOptimizedWatcher(workspacePath, {
      ...options,
      enableStats: true
    })

    // Setup global stats tracking
    watcher.on('batch', (batch) => {
      this.globalStats.totalEvents += batch.events.length
      this.globalStats.totalBatches++
    })

    this.watchers.set(workspaceId, watcher)
    this.globalStats.totalWorkspaces++

    await watcher.start()
    return watcher
  }

  /**
   * Get watcher for workspace
   */
  getWatcher(workspaceId: string): OptimizedFileWatcher | undefined {
    return this.watchers.get(workspaceId)
  }

  /**
   * Remove watcher for workspace
   */
  async removeWatcher(workspaceId: string): Promise<void> {
    const watcher = this.watchers.get(workspaceId)
    if (watcher) {
      await watcher.destroy()
      this.watchers.delete(workspaceId)
      this.globalStats.totalWorkspaces--
    }
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    const individualStats = Array.from(this.watchers.values()).map(w => w.getStats())

    return {
      ...this.globalStats,
      workspaces: individualStats,
      averageEventsPerWorkspace: this.globalStats.totalWorkspaces > 0
        ? Math.round(this.globalStats.totalEvents / this.globalStats.totalWorkspaces)
        : 0
    }
  }

  /**
   * Cleanup all watchers
   */
  async destroy(): Promise<void> {
    const promises = Array.from(this.watchers.values()).map(w => w.destroy())
    await Promise.all(promises)
    this.watchers.clear()
  }
}

// Global workspace watcher manager instance
export const workspaceWatcherManager = new WorkspaceWatcherManager()
