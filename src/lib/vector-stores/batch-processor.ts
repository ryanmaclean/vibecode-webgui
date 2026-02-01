/**
 * Batch Vector Operations Processor
 * Optimizes vector operations through intelligent batching
 */

interface BatchOperation {
  type: 'store' | 'search' | 'delete'
  payload: any
  callback: (result: any) => void
  timestamp: number
}

interface BatchConfig {
  maxBatchSize: number
  maxWaitTimeMs: number
  operation: 'store' | 'search' | 'delete'
}

export class VectorBatchProcessor {
  private queues: Map<string, BatchOperation[]> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private defaultConfig: Record<string, BatchConfig> = {
    store: { maxBatchSize: 10, maxWaitTimeMs: 2000, operation: 'store' },
    search: { maxBatchSize: 5, maxWaitTimeMs: 500, operation: 'search' },
    delete: { maxBatchSize: 20, maxWaitTimeMs: 1000, operation: 'delete' }
  }

  /**
   * Add operation to batch queue
   */
  addToBatch(
    operation: 'store' | 'search' | 'delete',
    payload: any,
    callback: (result: any) => void
  ): void {
    const config = this.defaultConfig[operation]
    const queueKey = operation
    
    if (!this.queues.has(queueKey)) {
      this.queues.set(queueKey, [])
    }

    const queue = this.queues.get(queueKey)!
    queue.push({
      type: operation,
      payload,
      callback,
      timestamp: Date.now()
    })

    // Process immediately if batch is full
    if (queue.length >= config.maxBatchSize) {
      this.processBatch(queueKey)
      return
    }

    // Set timer if not already set
    if (!this.timers.has(queueKey)) {
      const timer = setTimeout(() => {
        this.processBatch(queueKey)
      }, config.maxWaitTimeMs)
      this.timers.set(queueKey, timer)
    }
  }

  /**
   * Process batched operations
   */
  private async processBatch(queueKey: string): Promise<void> {
    const queue = this.queues.get(queueKey)
    if (!queue || queue.length === 0) return

    const operations = [...queue]
    queue.length = 0 // Clear queue

    // Clear timer
    const timer = this.timers.get(queueKey)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(queueKey)
    }

    console.log(`Processing batch of ${operations.length} ${queueKey} operations`)

    try {
      switch (queueKey) {
        case 'store':
          await this.processBatchStore(operations)
          break
        case 'search':
          await this.processBatchSearch(operations)
          break
        case 'delete':
          await this.processBatchDelete(operations)
          break
      }
    } catch (error) {
      console.error(`Batch ${queueKey} processing failed:`, error)
      // Call error callbacks
      operations.forEach(op => op.callback({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  /**
   * Process batched store operations
   */
  private async processBatchStore(operations: BatchOperation[]): Promise<void> {
    // Group by workspace/file for efficient storage
    const grouped = operations.reduce((acc, op) => {
      const key = `${op.payload.workspaceId}-${op.payload.fileId}`
      if (!acc[key]) acc[key] = []
      acc[key].push(op)
      return acc
    }, {} as Record<string, BatchOperation[]>)

    for (const [key, ops] of Object.entries(grouped)) {
      try {
        const documents = ops.map(op => op.payload.document)
        // Batch store to vector database
        const result = await this.batchStoreDocuments(documents)
        ops.forEach(op => op.callback(result))
      } catch (error) {
        ops.forEach(op => op.callback({ error: error instanceof Error ? error.message : String(error) }))
      }
    }
  }

  /**
   * Process batched search operations
   */
  private async processBatchSearch(operations: BatchOperation[]): Promise<void> {
    // Execute searches in parallel for different queries
    const searchPromises = operations.map(async (op) => {
      try {
        const result = await this.executeSearch(op.payload)
        op.callback(result)
      } catch (error) {
        op.callback({ error: error instanceof Error ? error.message : String(error) })
      }
    })

    await Promise.all(searchPromises)
  }

  /**
   * Process batched delete operations
   */
  private async processBatchDelete(operations: BatchOperation[]): Promise<void> {
    // Batch delete by workspace and file IDs
    const fileIds = operations.map(op => op.payload.fileId).filter(Boolean)
    const workspaceIds = operations.map(op => op.payload.workspaceId).filter(Boolean)

    try {
      const result = await this.batchDeleteDocuments({ fileIds, workspaceIds })
      operations.forEach(op => op.callback(result))
    } catch (error) {
      operations.forEach(op => op.callback({ error: error instanceof Error ? error.message : String(error) }))
    }
  }

  /**
   * Batch store implementation (placeholder)
   */
  private async batchStoreDocuments(documents: any[]): Promise<any> {
    // Implementation would integrate with actual vector store
    console.log(`Batch storing ${documents.length} documents`)
    return { stored: documents.length, success: true }
  }

  /**
   * Execute search (placeholder)
   */
  private async executeSearch(payload: any): Promise<any> {
    // Implementation would integrate with actual vector search
    console.log(`Executing search for: ${payload.query}`)
    return { results: [], query: payload.query }
  }

  /**
   * Batch delete implementation (placeholder)
   */
  private async batchDeleteDocuments(options: { fileIds: number[], workspaceIds: number[] }): Promise<any> {
    console.log(`Batch deleting files: ${options.fileIds.length}, workspaces: ${options.workspaceIds.length}`)
    return { deleted: options.fileIds.length + options.workspaceIds.length }
  }

  /**
   * Get batch processing statistics
   */
  getStats(): Record<string, { queueLength: number; oldestOperation: number }> {
    const stats: Record<string, { queueLength: number; oldestOperation: number }> = {}
    for (const [key, queue] of this.queues.entries()) {
      stats[key] = {
        queueLength: queue.length,
        oldestOperation: queue.length > 0 ? Date.now() - queue[0].timestamp : 0
      }
    }
    return stats
  }

  /**
   * Clear all queues and timers
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.queues.clear()
  }
}

export const vectorBatchProcessor = new VectorBatchProcessor()