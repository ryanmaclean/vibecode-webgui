/**
 * File Watcher Service
 *
 * Watches project directories for file changes and triggers incremental indexing
 * Implements debouncing and ignore patterns for efficient change detection
 *
 * Integrates with CodebaseIndexer for automatic re-indexing on file changes
 */

import * as chokidar from 'chokidar'
import { EventEmitter } from 'events'
import path from 'path'
import * as fs from 'fs/promises'
import * as crypto from 'crypto'

/**
 * File change event types
 */
export type FileChangeType = 'add' | 'change' | 'unlink'

/**
 * File change event data
 */
export interface FileChangeEvent {
  type: FileChangeType
  filePath: string
  timestamp: Date
}

/**
 * FileWatcher configuration options
 */
export interface FileWatcherConfig {
  /**
   * Root directory to watch
   */
  watchPath: string

  /**
   * Workspace ID for context
   */
  workspaceId: string

  /**
   * Project ID for context
   */
  projectId: string

  /**
   * Glob patterns to ignore (e.g., ['node_modules/**', '.git/**'])
   */
  ignorePatterns?: string[]

  /**
   * Debounce delay in milliseconds (default: 500ms)
   */
  debounceMs?: number

  /**
   * Whether to watch for additions (default: true)
   */
  watchAdd?: boolean

  /**
   * Whether to watch for changes (default: true)
   */
  watchChange?: boolean

  /**
   * Whether to watch for deletions (default: true)
   */
  watchUnlink?: boolean
}

/**
 * FileWatcher events interface for type-safe event handling
 */
export interface FileWatcherEvents {
  'file-added': (event: FileChangeEvent) => void
  'file-changed': (event: FileChangeEvent) => void
  'file-deleted': (event: FileChangeEvent) => void
  'error': (error: Error) => void
  'ready': () => void
}

/**
 * Type-safe event emitter for FileWatcher
 */
export declare interface FileWatcher {
  on<E extends keyof FileWatcherEvents>(event: E, listener: FileWatcherEvents[E]): this
  emit<E extends keyof FileWatcherEvents>(
    event: E,
    ...args: Parameters<FileWatcherEvents[E]>
  ): boolean
}

/**
 * FileWatcher Service
 *
 * Watches a project directory for file changes and emits events for:
 * - File additions (new files)
 * - File modifications (content changes)
 * - File deletions (removed files)
 *
 * Features:
 * - Debouncing to handle rapid consecutive changes
 * - Ignore patterns (.gitignore, node_modules, etc.)
 * - Type-safe event emissions
 * - Graceful start/stop lifecycle
 */
export class FileWatcher extends EventEmitter {
  private config: FileWatcherConfig
  private watcher: chokidar.FSWatcher | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private fileHashes: Map<string, string> = new Map() // Track file content hashes for deduplication
  private isWatching = false

  constructor(config: FileWatcherConfig) {
    super()
    this.config = this.validateConfig(config)
  }

  /**
   * Validate and normalize configuration
   */
  private validateConfig(config: FileWatcherConfig): FileWatcherConfig {
    if (!config.watchPath || typeof config.watchPath !== 'string') {
      throw new Error('watchPath is required and must be a string')
    }

    if (!config.workspaceId || typeof config.workspaceId !== 'string') {
      throw new Error('workspaceId is required and must be a string')
    }

    if (!config.projectId || typeof config.projectId !== 'string') {
      throw new Error('projectId is required and must be a string')
    }

    // Normalize watch path
    const normalizedPath = path.resolve(config.watchPath)

    // Default ignore patterns
    const defaultIgnorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.log',
      '**/*.tmp',
      '**/.env',
      '**/.env.local',
      '**/.env.production'
    ]

    return {
      ...config,
      watchPath: normalizedPath,
      ignorePatterns: [
        ...defaultIgnorePatterns,
        ...(config.ignorePatterns || [])
      ],
      debounceMs: config.debounceMs ?? 500,
      watchAdd: config.watchAdd ?? true,
      watchChange: config.watchChange ?? true,
      watchUnlink: config.watchUnlink ?? true
    }
  }

  /**
   * Start watching the directory
   */
  public async start(): Promise<void> {
    if (this.isWatching) {
      throw new Error('FileWatcher is already watching')
    }

    try {
      // Verify watch path exists
      const stats = await fs.stat(this.config.watchPath)
      if (!stats.isDirectory()) {
        throw new Error(`Watch path is not a directory: ${this.config.watchPath}`)
      }

      // Initialize chokidar watcher
      this.watcher = chokidar.watch(this.config.watchPath, {
        ignored: this.config.ignorePatterns,
        persistent: true,
        ignoreInitial: true, // Don't emit events for existing files on startup
        awaitWriteFinish: {
          stabilityThreshold: 100, // Wait 100ms for file write to finish
          pollInterval: 50
        },
        depth: 99, // Watch subdirectories up to 99 levels deep
        followSymlinks: false, // Don't follow symbolic links for security
      })

      // Set up event handlers
      if (this.config.watchAdd) {
        this.watcher.on('add', (filePath: string) => {
          this.handleFileChange('add', filePath)
        })
      }

      if (this.config.watchChange) {
        this.watcher.on('change', (filePath: string) => {
          this.handleFileChange('change', filePath)
        })
      }

      if (this.config.watchUnlink) {
        this.watcher.on('unlink', (filePath: string) => {
          this.handleFileChange('unlink', filePath)
        })
      }

      // Error handling
      this.watcher.on('error', (error: Error) => {
        this.emit('error', error)
      })

      // Wait for watcher to be ready
      await new Promise<void>((resolve) => {
        this.watcher!.on('ready', () => {
          this.isWatching = true
          this.emit('ready')
          resolve()
        })
      })
    } catch (error) {
      this.isWatching = false
      throw new Error(
        `Failed to start FileWatcher: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Calculate file hash for deduplication
   */
  private async calculateFileHash(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath)
      return crypto.createHash('sha256').update(content).digest('hex')
    } catch (error) {
      // File may have been deleted or is inaccessible
      return null
    }
  }

  /**
   * Handle file change with debouncing and deduplication
   */
  private handleFileChange(type: FileChangeType, filePath: string): void {
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath)

      // For file deletions, always emit event
      if (type === 'unlink') {
        this.fileHashes.delete(filePath)
        this.emitFileChangeEvent(type, filePath)
        return
      }

      // For additions and changes, check if content actually changed
      const currentHash = await this.calculateFileHash(filePath)

      // If we can't read the file, skip this event
      if (currentHash === null) {
        return
      }

      const previousHash = this.fileHashes.get(filePath)

      // Only emit event if hash changed (or is new file)
      if (currentHash !== previousHash) {
        this.fileHashes.set(filePath, currentHash)
        this.emitFileChangeEvent(type, filePath)
      }
      // If hash is the same, silently skip (deduplication)
    }, this.config.debounceMs)

    this.debounceTimers.set(filePath, timer)
  }

  /**
   * Emit file change event
   */
  private emitFileChangeEvent(type: FileChangeType, filePath: string): void {
    const event: FileChangeEvent = {
      type,
      filePath,
      timestamp: new Date()
    }

    // Emit specific event based on change type
    switch (type) {
      case 'add':
        this.emit('file-added', event)
        break
      case 'change':
        this.emit('file-changed', event)
        break
      case 'unlink':
        this.emit('file-deleted', event)
        break
    }
  }

  /**
   * Stop watching the directory
   */
  public async stop(): Promise<void> {
    if (!this.isWatching) {
      return
    }

    // Clear all pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Clear file hash cache
    this.fileHashes.clear()

    // Close the watcher
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    this.isWatching = false
  }

  /**
   * Check if the watcher is currently active
   */
  public isActive(): boolean {
    return this.isWatching
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Readonly<FileWatcherConfig> {
    return { ...this.config }
  }

  /**
   * Dispose of the watcher and clean up resources
   */
  public async dispose(): Promise<void> {
    await this.stop()
    this.removeAllListeners()
  }
}
