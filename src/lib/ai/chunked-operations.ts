/**
 * Chunked AI Operations Handler
 *
 * Orchestrates AI operations on large files by:
 * - Splitting files into manageable chunks using file-chunking utilities
 * - Distributing chunks to AI processing Web Workers
 * - Aggregating and streaming results back to the UI
 * - Tracking performance metrics and memory usage
 * - Managing operation lifecycle with cancellation support
 *
 * Key features:
 * - Automatic file chunking for large files
 * - Web Worker integration for non-blocking processing
 * - Streaming results with progress tracking
 * - Memory-efficient chunk batching
 * - Comprehensive error handling and recovery
 * - Performance monitoring and metrics
 *
 * @module ai/chunked-operations
 */

import {
  chunkFileContent,
  type FileChunk,
  type ChunkedFile,
  type ChunkMetadata,
  DEFAULT_CHUNK_SIZE,
  CHUNKING_THRESHOLDS,
  estimateChunkMemoryUsage,
} from '../editor/file-chunking';

import type {
  AIWorkerMessage,
  ProcessChunkMessage,
  ProcessCompleteMessage,
  StreamChunkMessage,
  ProcessErrorMessage,
  AIProgressMessage,
  AIOperationType,
  AIProcessingConfig,
  AIProcessingResult,
} from '../../workers/ai-processing.worker';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for chunked AI operations
 */
export interface ChunkedOperationConfig {
  /** Type of AI operation to perform */
  operationType: AIOperationType;

  /** Model to use for processing */
  model?: string;

  /** Temperature for generation (0-1) */
  temperature?: number;

  /** Maximum tokens per chunk */
  maxTokens?: number;

  /** Enable streaming responses */
  streaming?: boolean;

  /** Custom chunk size (lines) - if not provided, uses DEFAULT_CHUNK_SIZE.AI_PROCESSING */
  chunkSize?: number;

  /** Custom overlap size (lines) */
  overlapSize?: number;

  /** Maximum concurrent chunks to process */
  maxConcurrentChunks?: number;

  /** Timeout per chunk (ms) */
  chunkTimeout?: number;

  /** Include context from previous chunks */
  includeContext?: boolean;

  /** Maximum context chunks to include */
  maxContextChunks?: number;

  /** Additional operation-specific parameters */
  parameters?: Record<string, any>;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<ChunkedOperationConfig> = {
  streaming: true,
  maxConcurrentChunks: 3,
  chunkTimeout: 60000, // 60 seconds per chunk
  includeContext: true,
  maxContextChunks: 2,
  temperature: 0.7,
};

// ============================================================================
// Progress and Status Types
// ============================================================================

/**
 * Status of a chunked operation
 */
export type ChunkedOperationStatus =
  | 'pending'
  | 'chunking'
  | 'processing'
  | 'aggregating'
  | 'completed'
  | 'error'
  | 'cancelled';

/**
 * Progress information for a chunked operation
 */
export interface ChunkedOperationProgress {
  /** Current status */
  status: ChunkedOperationStatus;

  /** Total number of chunks */
  totalChunks: number;

  /** Number of chunks completed */
  completedChunks: number;

  /** Number of chunks in progress */
  processingChunks: number;

  /** Number of chunks with errors */
  errorChunks: number;

  /** Overall progress (0-1) */
  progress: number;

  /** Current stage message */
  message?: string;

  /** Processing time so far (ms) */
  elapsedTime: number;

  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;
}

/**
 * Result of a chunked AI operation
 */
export interface ChunkedOperationResult {
  /** Aggregated result content */
  content: string;

  /** Individual chunk results */
  chunkResults: AIProcessingResult[];

  /** Metadata about the operation */
  metadata: {
    /** Total chunks processed */
    totalChunks: number;

    /** Total processing time (ms) */
    totalTime: number;

    /** Average time per chunk (ms) */
    avgTimePerChunk: number;

    /** Total tokens used */
    totalTokens: number;

    /** Whether results were streamed */
    wasStreamed: boolean;

    /** File information */
    fileInfo: ChunkMetadata;

    /** Any errors encountered */
    errors?: Array<{ chunkIndex: number; error: string }>;
  };
}

// ============================================================================
// Chunk Processing State
// ============================================================================

/**
 * State for tracking a single chunk's processing
 */
interface ChunkProcessingState {
  chunk: FileChunk;
  chunkId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: AIProcessingResult;
  error?: string;
  startTime?: number;
  endTime?: number;
}

// ============================================================================
// Chunked Operation Handler
// ============================================================================

/**
 * Handles AI operations on large files using chunking and Web Workers
 */
export class ChunkedOperationHandler {
  private worker: Worker | null = null;
  private operationId: string;
  private config: Required<ChunkedOperationConfig>;
  private chunkStates: Map<string, ChunkProcessingState> = new Map();
  private startTime: number = 0;
  private aborted: boolean = false;

  // Callbacks
  private onProgressCallback?: (progress: ChunkedOperationProgress) => void;
  private onStreamCallback?: (chunkIndex: number, content: string) => void;
  private onCompleteCallback?: (result: ChunkedOperationResult) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(config: ChunkedOperationConfig) {
    this.operationId = generateOperationId();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<ChunkedOperationConfig>;
  }

  /**
   * Execute the chunked AI operation
   */
  async execute(
    content: string,
    fileName?: string,
    fileLanguage?: string
  ): Promise<ChunkedOperationResult> {
    this.startTime = performance.now();
    this.aborted = false;

    try {
      // Step 1: Chunk the file
      this.reportProgress({
        status: 'chunking',
        totalChunks: 0,
        completedChunks: 0,
        processingChunks: 0,
        errorChunks: 0,
        progress: 0,
        message: 'Chunking file for processing...',
        elapsedTime: 0,
      });

      const chunkedFile = await this.chunkContent(content);

      // Step 2: Initialize chunk states
      this.initializeChunkStates(chunkedFile.chunks);

      // Step 3: Initialize worker
      this.worker = await this.initializeWorker();

      // Step 4: Process chunks
      this.reportProgress({
        status: 'processing',
        totalChunks: chunkedFile.chunks.length,
        completedChunks: 0,
        processingChunks: 0,
        errorChunks: 0,
        progress: 0.1,
        message: 'Processing chunks...',
        elapsedTime: performance.now() - this.startTime,
      });

      const results = await this.processChunks(chunkedFile, fileName, fileLanguage);

      // Step 5: Aggregate results
      this.reportProgress({
        status: 'aggregating',
        totalChunks: chunkedFile.chunks.length,
        completedChunks: results.length,
        processingChunks: 0,
        errorChunks: 0,
        progress: 0.9,
        message: 'Aggregating results...',
        elapsedTime: performance.now() - this.startTime,
      });

      const aggregatedResult = this.aggregateResults(results, chunkedFile.metadata);

      // Step 6: Complete
      this.reportProgress({
        status: 'completed',
        totalChunks: chunkedFile.chunks.length,
        completedChunks: results.length,
        processingChunks: 0,
        errorChunks: 0,
        progress: 1,
        message: 'Operation completed',
        elapsedTime: performance.now() - this.startTime,
      });

      if (this.onCompleteCallback) {
        this.onCompleteCallback(aggregatedResult);
      }

      return aggregatedResult;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));

      this.reportProgress({
        status: this.aborted ? 'cancelled' : 'error',
        totalChunks: this.chunkStates.size,
        completedChunks: Array.from(this.chunkStates.values()).filter(
          (s) => s.status === 'completed'
        ).length,
        processingChunks: 0,
        errorChunks: Array.from(this.chunkStates.values()).filter((s) => s.status === 'error')
          .length,
        progress: 0,
        message: this.aborted ? 'Operation cancelled' : `Error: ${errorObj.message}`,
        elapsedTime: performance.now() - this.startTime,
      });

      if (this.onErrorCallback) {
        this.onErrorCallback(errorObj);
      }

      throw errorObj;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Cancel the operation
   */
  cancel(): void {
    this.aborted = true;

    if (this.worker) {
      // Send cancel message to worker
      const cancelMsg: AIWorkerMessage = {
        type: 'CANCEL',
        payload: {},
      };
      this.worker.postMessage(cancelMsg);
    }

    this.cleanup();
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: ChunkedOperationProgress) => void): this {
    this.onProgressCallback = callback;
    return this;
  }

  /**
   * Set stream callback
   */
  onStream(callback: (chunkIndex: number, content: string) => void): this {
    this.onStreamCallback = callback;
    return this;
  }

  /**
   * Set complete callback
   */
  onComplete(callback: (result: ChunkedOperationResult) => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  /**
   * Set error callback
   */
  onError(callback: (error: Error) => void): this {
    this.onErrorCallback = callback;
    return this;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Chunk the content into manageable pieces
   */
  private async chunkContent(content: string): Promise<ChunkedFile> {
    // Use file chunking utility with AI_PROCESSING operation type
    return chunkFileContent(content, {
      operationType: 'AI_PROCESSING',
      chunkSize: this.config.chunkSize || DEFAULT_CHUNK_SIZE.AI_PROCESSING,
      overlapSize: this.config.overlapSize,
    });
  }

  /**
   * Initialize chunk processing states
   */
  private initializeChunkStates(chunks: FileChunk[]): void {
    this.chunkStates.clear();

    for (const chunk of chunks) {
      const chunkId = `${this.operationId}-chunk-${chunk.index}`;
      this.chunkStates.set(chunkId, {
        chunk,
        chunkId,
        status: 'pending',
      });
    }
  }

  /**
   * Initialize the AI processing worker
   */
  private async initializeWorker(): Promise<Worker> {
    // In production, this would use the worker-manager to get a pooled worker
    // For now, create a new worker instance
    // Note: The worker path will need to be configured based on your build setup
    // This is a placeholder that works with most bundlers (webpack, vite, etc.)
    const worker = new Worker('/workers/ai-processing.worker.js');

    // Wait for worker to be ready
    await new Promise<void>((resolve) => {
      const onReady = (event: MessageEvent): void => {
        if (event.data.type === 'READY') {
          worker.removeEventListener('message', onReady);
          resolve();
        }
      };
      worker.addEventListener('message', onReady);
    });

    // Set up message handler
    worker.addEventListener('message', this.handleWorkerMessage.bind(this));

    return worker;
  }

  /**
   * Process all chunks with concurrency control
   */
  private async processChunks(
    chunkedFile: ChunkedFile,
    fileName?: string,
    fileLanguage?: string
  ): Promise<AIProcessingResult[]> {
    const results: AIProcessingResult[] = [];
    const chunks = chunkedFile.chunks;
    const maxConcurrent = this.config.maxConcurrentChunks;

    // Process chunks in batches with concurrency control
    for (let i = 0; i < chunks.length; i += maxConcurrent) {
      if (this.aborted) {
        throw new Error('Operation cancelled');
      }

      const batch = chunks.slice(i, i + maxConcurrent);
      const batchPromises = batch.map((chunk) =>
        this.processChunk(chunk, fileName, fileLanguage)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Log error but continue processing
          const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.error(`Chunk processing error: ${errorMsg}`);
        }
      }

      // Update progress after each batch
      this.updateProgressFromStates();
    }

    return results;
  }

  /**
   * Process a single chunk
   */
  private async processChunk(
    chunk: FileChunk,
    fileName?: string,
    fileLanguage?: string
  ): Promise<AIProcessingResult> {
    const chunkId = `${this.operationId}-chunk-${chunk.index}`;
    const state = this.chunkStates.get(chunkId);

    if (!state || !this.worker) {
      throw new Error(`Invalid chunk state for ${chunkId}`);
    }

    // Update state
    state.status = 'processing';
    state.startTime = performance.now();

    // Build context from previous chunks if enabled
    const context = this.config.includeContext ? this.buildContext(chunk, fileName, fileLanguage) : undefined;

    // Send message to worker
    const message: ProcessChunkMessage = {
      type: 'PROCESS_CHUNK',
      payload: {
        chunk,
        config: {
          operationType: this.config.operationType,
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          streaming: this.config.streaming,
          parameters: this.config.parameters,
        },
        chunkId,
        context,
      },
    };

    this.worker.postMessage(message);

    // Wait for result with timeout
    return this.waitForChunkResult(chunkId, this.config.chunkTimeout);
  }

  /**
   * Build context from previous chunks
   */
  private buildContext(
    currentChunk: FileChunk,
    fileName?: string,
    fileLanguage?: string
  ): { previousChunks?: string[]; fileLanguage?: string; fileName?: string } {
    const previousChunks: string[] = [];

    // Get up to maxContextChunks previous chunks
    const startIndex = Math.max(0, currentChunk.index - this.config.maxContextChunks);

    for (let i = startIndex; i < currentChunk.index; i++) {
      const prevState = Array.from(this.chunkStates.values()).find((s) => s.chunk.index === i);
      if (prevState?.result) {
        previousChunks.push(prevState.result.content);
      }
    }

    return {
      previousChunks: previousChunks.length > 0 ? previousChunks : undefined,
      fileLanguage,
      fileName,
    };
  }

  /**
   * Wait for a chunk result with timeout
   */
  private async waitForChunkResult(chunkId: string, timeout: number): Promise<AIProcessingResult> {
    return new Promise<AIProcessingResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Chunk processing timeout: ${chunkId}`));
      }, timeout);

      const checkResult = (): void => {
        const state = this.chunkStates.get(chunkId);

        if (!state) {
          clearTimeout(timeoutId);
          reject(new Error(`Chunk state not found: ${chunkId}`));
          return;
        }

        if (state.status === 'completed' && state.result) {
          clearTimeout(timeoutId);
          resolve(state.result);
        } else if (state.status === 'error') {
          clearTimeout(timeoutId);
          reject(new Error(state.error || 'Unknown error'));
        } else if (this.aborted) {
          clearTimeout(timeoutId);
          reject(new Error('Operation cancelled'));
        } else {
          // Check again in 100ms
          setTimeout(checkResult, 100);
        }
      };

      checkResult();
    });
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent<AIWorkerMessage>): void {
    const message = event.data;

    switch (message.type) {
      case 'PROCESS_COMPLETE': {
        const { chunkId, result, duration } = (message as ProcessCompleteMessage).payload;
        const state = this.chunkStates.get(chunkId);

        if (state) {
          state.status = 'completed';
          state.result = result;
          state.endTime = performance.now();
          this.updateProgressFromStates();
        }

        break;
      }

      case 'STREAM_CHUNK': {
        const { chunkId, content, isComplete } = (message as StreamChunkMessage).payload;
        const state = this.chunkStates.get(chunkId);

        if (state && this.onStreamCallback) {
          this.onStreamCallback(state.chunk.index, content);
        }

        break;
      }

      case 'PROCESS_ERROR': {
        const { chunkId, error } = (message as ProcessErrorMessage).payload;
        const state = this.chunkStates.get(chunkId);

        if (state) {
          state.status = 'error';
          state.error = error;
          state.endTime = performance.now();
          this.updateProgressFromStates();
        }

        break;
      }

      case 'PROGRESS': {
        const { chunkId, stage, progress: chunkProgress, message: progressMsg } = (message as AIProgressMessage).payload;
        // Update overall progress
        this.updateProgressFromStates(progressMsg);
        break;
      }

      default:
        // Ignore unknown messages
        break;
    }
  }

  /**
   * Update progress based on current chunk states
   */
  private updateProgressFromStates(message?: string): void {
    const totalChunks = this.chunkStates.size;
    const completedChunks = Array.from(this.chunkStates.values()).filter(
      (s) => s.status === 'completed'
    ).length;
    const processingChunks = Array.from(this.chunkStates.values()).filter(
      (s) => s.status === 'processing'
    ).length;
    const errorChunks = Array.from(this.chunkStates.values()).filter(
      (s) => s.status === 'error'
    ).length;

    const progress = totalChunks > 0 ? completedChunks / totalChunks : 0;
    const elapsedTime = performance.now() - this.startTime;

    // Estimate remaining time
    let estimatedTimeRemaining: number | undefined;
    if (completedChunks > 0) {
      const avgTimePerChunk = elapsedTime / completedChunks;
      const remainingChunks = totalChunks - completedChunks;
      estimatedTimeRemaining = avgTimePerChunk * remainingChunks;
    }

    this.reportProgress({
      status: 'processing',
      totalChunks,
      completedChunks,
      processingChunks,
      errorChunks,
      progress: 0.1 + progress * 0.8, // Scale to 10-90% range
      message: message || `Processing chunk ${completedChunks + 1}/${totalChunks}`,
      elapsedTime,
      estimatedTimeRemaining,
    });
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: ChunkedOperationProgress): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  /**
   * Aggregate results from all chunks
   */
  private aggregateResults(
    results: AIProcessingResult[],
    fileMetadata: ChunkMetadata
  ): ChunkedOperationResult {
    // Sort results by chunk index
    const sortedResults = results.sort((a, b) => a.chunk.index - b.chunk.index);

    // Combine content
    const aggregatedContent = sortedResults
      .map((r) => r.content)
      .join('\n');

    // Calculate metadata
    const totalTime = performance.now() - this.startTime;
    const avgTimePerChunk = totalTime / results.length;
    const totalTokens = results.reduce((sum, r) => sum + (r.metadata.tokensUsed || 0), 0);

    // Collect errors
    const errors: Array<{ chunkIndex: number; error: string }> = [];
    for (const [chunkId, state] of Array.from(this.chunkStates.entries())) {
      if (state.status === 'error') {
        errors.push({
          chunkIndex: state.chunk.index,
          error: state.error || 'Unknown error',
        });
      }
    }

    return {
      content: aggregatedContent,
      chunkResults: sortedResults,
      metadata: {
        totalChunks: fileMetadata.totalChunks,
        totalTime,
        avgTimePerChunk,
        totalTokens,
        wasStreamed: this.config.streaming,
        fileInfo: fileMetadata,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.chunkStates.clear();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique operation ID
 */
function generateOperationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine if a file should be processed with chunking
 */
export function shouldUseChunking(content: string, threshold?: number): boolean {
  const lineCount = content.split('\n').length;
  const actualThreshold = threshold || CHUNKING_THRESHOLDS.LARGE_FILE;

  return lineCount >= actualThreshold;
}

/**
 * Estimate processing time for a file
 */
export function estimateProcessingTime(
  content: string,
  operationType: AIOperationType
): number {
  const lineCount = content.split('\n').length;
  const chunkSize = DEFAULT_CHUNK_SIZE.AI_PROCESSING;
  const numChunks = Math.ceil(lineCount / chunkSize);

  // Rough estimates in milliseconds per chunk
  const timePerChunk: Record<AIOperationType, number> = {
    analyze: 500,
    transform: 1000,
    complete: 800,
    explain: 600,
    refactor: 1500,
    generate: 1200,
  };

  return numChunks * (timePerChunk[operationType] || 800);
}

/**
 * Estimate memory usage for a chunked operation
 */
export function estimateOperationMemory(content: string): number {
  // Calculate file size in bytes
  const totalBytes = new Blob([content]).size;
  const chunkSize = DEFAULT_CHUNK_SIZE.AI_PROCESSING;

  // Use file chunking memory estimation plus worker overhead
  const fileMemory = estimateChunkMemoryUsage(totalBytes, chunkSize);
  const workerOverhead = 50 * 1024 * 1024; // 50MB for worker

  return fileMemory + workerOverhead;
}
