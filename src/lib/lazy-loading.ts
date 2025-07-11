/**
 * Lazy Loading for Large Files
 * 
 * High-performance lazy loading system for large files with virtual scrolling
 * Implements efficient memory management and smooth user experience
 * 
 * Staff Engineer Implementation - Enterprise-grade lazy loading
 */

import { EventEmitter } from 'events'

interface LazyLoadConfig {
  chunkSize: number
  preloadChunks: number
  maxCachedChunks: number
  virtualScrollThreshold: number
  prefetchDistance: number
  compressionEnabled: boolean
}

interface FileChunk {
  id: string
  startLine: number
  endLine: number
  content: string
  size: number
  loadedAt: number
  accessCount: number
  compressed?: boolean
}

interface VirtualScrollState {
  visibleStartLine: number
  visibleEndLine: number
  totalLines: number
  containerHeight: number
  lineHeight: number
  scrollTop: number
}

interface LoadRequest {
  chunkId: string
  priority: 'low' | 'normal' | 'high'
  resolve: (chunk: FileChunk) => void
  reject: (error: Error) => void
}

export class LazyFileLoader extends EventEmitter {
  private config: LazyLoadConfig
  private chunks = new Map<string, FileChunk>()
  private loadQueue: LoadRequest[] = []
  private loadingChunks = new Set<string>()
  private fileMetadata: {
    filePath: string
    totalLines: number
    totalSize: number
    lineBreaks: number[]
  } | null = null
  private accessPattern = new Map<string, number>()
  private compressionWorker: Worker | null = null

  constructor(config: Partial<LazyLoadConfig> = {}) {
    super()
    
    this.config = {
      chunkSize: config.chunkSize || 1000, // Lines per chunk
      preloadChunks: config.preloadChunks || 3,
      maxCachedChunks: config.maxCachedChunks || 50,
      virtualScrollThreshold: config.virtualScrollThreshold || 10000, // Lines
      prefetchDistance: config.prefetchDistance || 2, // Chunks
      compressionEnabled: config.compressionEnabled || true
    }

    if (this.config.compressionEnabled && typeof Worker !== 'undefined') {
      this.initializeCompressionWorker()
    }
  }

  /**
   * Initialize file for lazy loading
   */
  async initializeFile(filePath: string): Promise<void> {
    try {
      // Get file metadata
      const metadata = await this.analyzeFile(filePath)
      this.fileMetadata = metadata
      
      // Preload initial chunks
      await this.preloadInitialChunks()
      
      this.emit('file-initialized', {
        filePath,
        totalLines: metadata.totalLines,
        totalSize: metadata.totalSize,
        chunksRequired: Math.ceil(metadata.totalLines / this.config.chunkSize)
      })
      
    } catch (error) {
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Get lines for virtual scrolling viewport
   */
  async getViewportLines(virtualState: VirtualScrollState): Promise<string[]> {
    if (!this.fileMetadata) {
      throw new Error('File not initialized')
    }

    const { visibleStartLine, visibleEndLine } = virtualState
    const requiredChunks = this.calculateRequiredChunks(visibleStartLine, visibleEndLine)
    
    // Load required chunks
    await this.ensureChunksLoaded(requiredChunks, 'high')
    
    // Prefetch adjacent chunks
    this.prefetchAdjacentChunks(requiredChunks)
    
    // Extract lines from chunks
    const lines = this.extractLines(visibleStartLine, visibleEndLine)
    
    // Update access patterns
    this.updateAccessPattern(requiredChunks)
    
    return lines
  }

  /**
   * Get specific line range
   */
  async getLineRange(startLine: number, endLine: number): Promise<string[]> {
    if (!this.fileMetadata) {
      throw new Error('File not initialized')
    }

    const requiredChunks = this.calculateRequiredChunks(startLine, endLine)
    await this.ensureChunksLoaded(requiredChunks, 'normal')
    
    return this.extractLines(startLine, endLine)
  }

  /**
   * Search within file with lazy loading
   */
  async searchInFile(
    query: string, 
    options: {
      caseSensitive?: boolean
      wholeWord?: boolean
      regex?: boolean
      maxResults?: number
    } = {}
  ): Promise<Array<{ line: number; content: string; match: RegExp | null }>> {
    if (!this.fileMetadata) {
      throw new Error('File not initialized')
    }

    const results: Array<{ line: number; content: string; match: RegExp | null }> = []
    const maxResults = options.maxResults || 1000
    
    // Create search pattern
    let searchPattern: RegExp
    if (options.regex) {
      searchPattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi')
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
      searchPattern = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
    }

    // Search through chunks progressively
    const totalChunks = Math.ceil(this.fileMetadata.totalLines / this.config.chunkSize)
    
    for (let chunkIndex = 0; chunkIndex < totalChunks && results.length < maxResults; chunkIndex++) {
      const startLine = chunkIndex * this.config.chunkSize
      const endLine = Math.min(startLine + this.config.chunkSize, this.fileMetadata.totalLines)
      
      try {
        // Load chunk with low priority for search
        const chunkId = this.getChunkId(chunkIndex)
        await this.ensureChunksLoaded([chunkId], 'low')
        
        const chunk = this.chunks.get(chunkId)
        if (!chunk) continue
        
        const lines = chunk.content.split('\n')
        lines.forEach((line, index) => {
          const lineNumber = startLine + index
          const match = line.match(searchPattern)
          if (match && results.length < maxResults) {
            results.push({
              line: lineNumber,
              content: line,
              match: searchPattern
            })
          }
        })
        
        // Emit progress
        this.emit('search-progress', {
          processed: chunkIndex + 1,
          total: totalChunks,
          results: results.length
        })
        
      } catch (error) {
        console.warn(`Failed to search in chunk ${chunkIndex}:`, error)
      }
    }

    return results
  }

  /**
   * Analyze file structure
   */
  private async analyzeFile(filePath: string): Promise<{
    filePath: string
    totalLines: number
    totalSize: number
    lineBreaks: number[]
  }> {
    // This would typically use fs or a file API
    // For now, simulate file analysis
    const response = await fetch(`/api/files/analyze?path=${encodeURIComponent(filePath)}`)
    if (!response.ok) {
      throw new Error(`Failed to analyze file: ${response.statusText}`)
    }
    
    return response.json()
  }

  /**
   * Calculate required chunks for line range
   */
  private calculateRequiredChunks(startLine: number, endLine: number): string[] {
    const startChunk = Math.floor(startLine / this.config.chunkSize)
    const endChunk = Math.floor(endLine / this.config.chunkSize)
    
    const chunks: string[] = []
    for (let i = startChunk; i <= endChunk; i++) {
      chunks.push(this.getChunkId(i))
    }
    
    return chunks
  }

  /**
   * Ensure chunks are loaded
   */
  private async ensureChunksLoaded(chunkIds: string[], priority: 'low' | 'normal' | 'high'): Promise<void> {
    const missingChunks = chunkIds.filter(id => 
      !this.chunks.has(id) && !this.loadingChunks.has(id)
    )
    
    if (missingChunks.length === 0) return
    
    const loadPromises = missingChunks.map(chunkId => 
      this.loadChunk(chunkId, priority)
    )
    
    await Promise.all(loadPromises)
  }

  /**
   * Load individual chunk
   */
  private async loadChunk(chunkId: string, priority: 'low' | 'normal' | 'high'): Promise<FileChunk> {
    if (this.chunks.has(chunkId)) {
      return this.chunks.get(chunkId)!
    }

    if (this.loadingChunks.has(chunkId)) {
      // Wait for existing load
      return new Promise((resolve, reject) => {
        this.loadQueue.push({ chunkId, priority, resolve, reject })
      })
    }

    this.loadingChunks.add(chunkId)

    try {
      const chunkIndex = parseInt(chunkId.split('_')[1])
      const startLine = chunkIndex * this.config.chunkSize
      const endLine = Math.min(startLine + this.config.chunkSize, this.fileMetadata!.totalLines)
      
      // Load chunk data
      const response = await fetch(`/api/files/chunk?path=${encodeURIComponent(this.fileMetadata!.filePath)}&start=${startLine}&end=${endLine}`)
      if (!response.ok) {
        throw new Error(`Failed to load chunk: ${response.statusText}`)
      }
      
      const content = await response.text()
      
      const chunk: FileChunk = {
        id: chunkId,
        startLine,
        endLine,
        content,
        size: content.length,
        loadedAt: Date.now(),
        accessCount: 1
      }

      // Apply compression if enabled
      if (this.config.compressionEnabled) {
        chunk.compressed = true
        // Compress content (placeholder - would use actual compression)
        // chunk.content = await this.compressContent(content)
      }

      // Cache management
      this.manageCache(chunk)
      
      this.chunks.set(chunkId, chunk)
      this.loadingChunks.delete(chunkId)
      
      // Resolve queued requests
      this.resolveQueuedRequests(chunkId, chunk)
      
      this.emit('chunk-loaded', chunk)
      return chunk
      
    } catch (error) {
      this.loadingChunks.delete(chunkId)
      this.rejectQueuedRequests(chunkId, error as Error)
      throw error
    }
  }

  /**
   * Prefetch adjacent chunks
   */
  private prefetchAdjacentChunks(currentChunks: string[]): void {
    if (!this.fileMetadata) return

    const prefetchChunks = new Set<string>()
    
    currentChunks.forEach(chunkId => {
      const chunkIndex = parseInt(chunkId.split('_')[1])
      
      // Prefetch chunks before and after
      for (let i = 1; i <= this.config.prefetchDistance; i++) {
        const prevChunk = chunkIndex - i
        const nextChunk = chunkIndex + i
        
        if (prevChunk >= 0) {
          prefetchChunks.add(this.getChunkId(prevChunk))
        }
        
        const totalChunks = Math.ceil(this.fileMetadata.totalLines / this.config.chunkSize)
        if (nextChunk < totalChunks) {
          prefetchChunks.add(this.getChunkId(nextChunk))
        }
      }
    })

    // Load prefetch chunks with low priority
    const missingPrefetchChunks = Array.from(prefetchChunks).filter(id => 
      !this.chunks.has(id) && !this.loadingChunks.has(id)
    )

    missingPrefetchChunks.forEach(chunkId => {
      // Use setTimeout to avoid blocking main operations
      setTimeout(() => {
        this.loadChunk(chunkId, 'low').catch(error => {
          console.warn(`Prefetch failed for chunk ${chunkId}:`, error)
        })
      }, 0)
    })
  }

  /**
   * Extract lines from loaded chunks
   */
  private extractLines(startLine: number, endLine: number): string[] {
    const lines: string[] = []
    const requiredChunks = this.calculateRequiredChunks(startLine, endLine)
    
    requiredChunks.forEach(chunkId => {
      const chunk = this.chunks.get(chunkId)
      if (!chunk) return
      
      let content = chunk.content
      if (chunk.compressed) {
        // Decompress content (placeholder)
        // content = this.decompressContent(chunk.content)
      }
      
      const chunkLines = content.split('\n')
      const chunkStartLine = chunk.startLine
      
      chunkLines.forEach((line, index) => {
        const lineNumber = chunkStartLine + index
        if (lineNumber >= startLine && lineNumber <= endLine) {
          lines[lineNumber - startLine] = line
        }
      })
    })

    return lines
  }

  /**
   * Manage chunk cache
   */
  private manageCache(newChunk: FileChunk): void {
    if (this.chunks.size >= this.config.maxCachedChunks) {
      // Find least recently used chunks
      const sortedChunks = Array.from(this.chunks.values())
        .sort((a, b) => {
          // Priority: access count (lower is worse) then loaded time (older is worse)
          if (a.accessCount !== b.accessCount) {
            return a.accessCount - b.accessCount
          }
          return a.loadedAt - b.loadedAt
        })

      // Remove least used chunks
      const chunksToRemove = Math.floor(this.config.maxCachedChunks * 0.2) // Remove 20%
      for (let i = 0; i < chunksToRemove && i < sortedChunks.length; i++) {
        this.chunks.delete(sortedChunks[i].id)
        this.emit('chunk-evicted', sortedChunks[i])
      }
    }
  }

  /**
   * Update access patterns for intelligent caching
   */
  private updateAccessPattern(chunkIds: string[]): void {
    chunkIds.forEach(chunkId => {
      const chunk = this.chunks.get(chunkId)
      if (chunk) {
        chunk.accessCount++
        chunk.loadedAt = Date.now() // Update last access time
      }
      
      // Update global access pattern
      const count = this.accessPattern.get(chunkId) || 0
      this.accessPattern.set(chunkId, count + 1)
    })
  }

  /**
   * Preload initial chunks
   */
  private async preloadInitialChunks(): Promise<void> {
    if (!this.fileMetadata) return

    const initialChunks: string[] = []
    for (let i = 0; i < this.config.preloadChunks; i++) {
      initialChunks.push(this.getChunkId(i))
    }

    await this.ensureChunksLoaded(initialChunks, 'high')
  }

  /**
   * Get chunk ID from index
   */
  private getChunkId(chunkIndex: number): string {
    return `chunk_${chunkIndex}`
  }

  /**
   * Resolve queued requests for chunk
   */
  private resolveQueuedRequests(chunkId: string, chunk: FileChunk): void {
    const remainingQueue: LoadRequest[] = []
    
    this.loadQueue.forEach(request => {
      if (request.chunkId === chunkId) {
        request.resolve(chunk)
      } else {
        remainingQueue.push(request)
      }
    })
    
    this.loadQueue = remainingQueue
  }

  /**
   * Reject queued requests for chunk
   */
  private rejectQueuedRequests(chunkId: string, error: Error): void {
    const remainingQueue: LoadRequest[] = []
    
    this.loadQueue.forEach(request => {
      if (request.chunkId === chunkId) {
        request.reject(error)
      } else {
        remainingQueue.push(request)
      }
    })
    
    this.loadQueue = remainingQueue
  }

  /**
   * Initialize compression worker
   */
  private initializeCompressionWorker(): void {
    try {
      // Create compression worker (placeholder)
      // this.compressionWorker = new Worker('/workers/compression-worker.js')
    } catch (error) {
      console.warn('Failed to initialize compression worker:', error)
      this.config.compressionEnabled = false
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const totalSize = Array.from(this.chunks.values())
      .reduce((sum, chunk) => sum + chunk.size, 0)
    
    const accessCounts = Array.from(this.chunks.values())
      .map(chunk => chunk.accessCount)
    
    return {
      cachedChunks: this.chunks.size,
      maxCachedChunks: this.config.maxCachedChunks,
      totalCacheSize: totalSize,
      averageChunkSize: this.chunks.size > 0 ? totalSize / this.chunks.size : 0,
      averageAccessCount: accessCounts.length > 0 
        ? accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length 
        : 0,
      loadingChunks: this.loadingChunks.size,
      queuedRequests: this.loadQueue.length
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.chunks.clear()
    this.accessPattern.clear()
    this.loadingChunks.clear()
    this.loadQueue.forEach(request => {
      request.reject(new Error('Cache cleared'))
    })
    this.loadQueue = []
    
    this.emit('cache-cleared')
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearCache()
    
    if (this.compressionWorker) {
      this.compressionWorker.terminate()
      this.compressionWorker = null
    }
    
    this.removeAllListeners()
  }
}

/**
 * Virtual scrolling helper for large files
 */
export class VirtualFileScroller extends EventEmitter {
  private lazyLoader: LazyFileLoader
  private containerElement: HTMLElement
  private virtualState: VirtualScrollState
  private scrollTimeout: NodeJS.Timeout | null = null

  constructor(
    containerElement: HTMLElement,
    lazyLoader: LazyFileLoader,
    lineHeight: number = 20
  ) {
    super()
    this.containerElement = containerElement
    this.lazyLoader = lazyLoader
    
    this.virtualState = {
      visibleStartLine: 0,
      visibleEndLine: 0,
      totalLines: 0,
      containerHeight: 0,
      lineHeight,
      scrollTop: 0
    }

    this.setupScrollHandler()
  }

  /**
   * Initialize virtual scroller
   */
  async initialize(totalLines: number): Promise<void> {
    this.virtualState.totalLines = totalLines
    this.virtualState.containerHeight = this.containerElement.clientHeight
    
    this.updateVisibleRange()
    await this.loadVisibleContent()
  }

  /**
   * Setup scroll event handler
   */
  private setupScrollHandler(): void {
    this.containerElement.addEventListener('scroll', () => {
      this.virtualState.scrollTop = this.containerElement.scrollTop
      
      // Debounce scroll updates
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout)
      }
      
      this.scrollTimeout = setTimeout(async () => {
        this.updateVisibleRange()
        await this.loadVisibleContent()
      }, 16) // ~60fps
    })
  }

  /**
   * Update visible line range
   */
  private updateVisibleRange(): void {
    const { scrollTop, containerHeight, lineHeight, totalLines } = this.virtualState
    
    this.virtualState.visibleStartLine = Math.floor(scrollTop / lineHeight)
    this.virtualState.visibleEndLine = Math.min(
      this.virtualState.visibleStartLine + Math.ceil(containerHeight / lineHeight),
      totalLines - 1
    )
  }

  /**
   * Load content for visible range
   */
  private async loadVisibleContent(): Promise<void> {
    try {
      const lines = await this.lazyLoader.getViewportLines(this.virtualState)
      this.emit('content-loaded', {
        startLine: this.virtualState.visibleStartLine,
        endLine: this.virtualState.visibleEndLine,
        lines
      })
    } catch (error) {
      this.emit('error', error)
    }
  }

  /**
   * Scroll to specific line
   */
  scrollToLine(lineNumber: number): void {
    const scrollTop = lineNumber * this.virtualState.lineHeight
    this.containerElement.scrollTop = scrollTop
  }

  /**
   * Update line height
   */
  updateLineHeight(lineHeight: number): void {
    this.virtualState.lineHeight = lineHeight
    this.updateVisibleRange()
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }
    this.removeAllListeners()
  }
}

/**
 * Factory function to create lazy file loader
 */
export function createLazyFileLoader(config: Partial<LazyLoadConfig> = {}): LazyFileLoader {
  return new LazyFileLoader(config)
}