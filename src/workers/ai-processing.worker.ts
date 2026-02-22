/**
 * AI Processing Web Worker
 *
 * Offloads AI operations from the main thread to prevent UI freezing when
 * processing large files. Handles chunked AI operations, streaming responses,
 * and incremental processing without blocking the editor.
 *
 * Key features:
 * - Chunked AI operations for large files
 * - Streaming response handling
 * - Progress reporting for long-running operations
 * - Memory-efficient incremental processing
 * - Cancellation support
 * - Integration with file chunking system
 *
 * @module workers/ai-processing
 */

import type { FileChunk } from '../lib/editor/file-chunking';

/**
 * Message types for AI worker communication
 */
export type AIWorkerMessageType =
  | 'PROCESS_CHUNK'
  | 'PROCESS_COMPLETE'
  | 'PROCESS_ERROR'
  | 'STREAM_CHUNK'
  | 'CANCEL'
  | 'PROGRESS';

/**
 * AI operation types supported by the worker
 */
export type AIOperationType =
  | 'analyze'
  | 'transform'
  | 'complete'
  | 'explain'
  | 'refactor'
  | 'generate';

/**
 * Configuration for AI processing
 */
export interface AIProcessingConfig {
  /** Type of AI operation to perform */
  operationType: AIOperationType;

  /** Model to use for processing */
  model?: string;

  /** Temperature for generation (0-1) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Enable streaming responses */
  streaming?: boolean;

  /** Additional parameters for the operation */
  parameters?: Record<string, any>;
}

/**
 * Input message for processing a chunk with AI
 */
export interface ProcessChunkMessage {
  type: 'PROCESS_CHUNK';
  payload: {
    chunk: FileChunk;
    config: AIProcessingConfig;
    chunkId: string;
    context?: {
      previousChunks?: string[];
      fileLanguage?: string;
      fileName?: string;
    };
  };
}

/**
 * Response message for completed AI processing
 */
export interface ProcessCompleteMessage {
  type: 'PROCESS_COMPLETE';
  payload: {
    chunkId: string;
    result: AIProcessingResult;
    duration: number;
  };
}

/**
 * Streaming chunk message for incremental responses
 */
export interface StreamChunkMessage {
  type: 'STREAM_CHUNK';
  payload: {
    chunkId: string;
    content: string;
    isComplete: boolean;
  };
}

/**
 * Error message from AI worker
 */
export interface ProcessErrorMessage {
  type: 'PROCESS_ERROR';
  payload: {
    chunkId: string;
    error: string;
    errorType: 'network' | 'timeout' | 'parsing' | 'validation' | 'unknown';
  };
}

/**
 * Progress update message
 */
export interface AIProgressMessage {
  type: 'PROGRESS';
  payload: {
    chunkId: string;
    stage: 'preparing' | 'processing' | 'streaming' | 'finalizing';
    progress: number;
    message?: string;
  };
}

/**
 * Cancel message to stop AI processing
 */
export interface CancelMessage {
  type: 'CANCEL';
  payload: {
    chunkId?: string;
  };
}

/**
 * Union type for all AI worker messages
 */
export type AIWorkerMessage =
  | ProcessChunkMessage
  | ProcessCompleteMessage
  | StreamChunkMessage
  | ProcessErrorMessage
  | AIProgressMessage
  | CancelMessage;

/**
 * Result of AI processing operation
 */
export interface AIProcessingResult {
  /** Original chunk that was processed */
  chunk: FileChunk;

  /** Processed/transformed content */
  content: string;

  /** Metadata about the processing */
  metadata: {
    /** Tokens used in the operation */
    tokensUsed?: number;

    /** Confidence score (0-1) */
    confidence?: number;

    /** Model used */
    model?: string;

    /** Processing time in ms */
    processingTime: number;

    /** Whether the result was streamed */
    wasStreamed: boolean;
  };

  /** Additional operation-specific data */
  extras?: Record<string, any>;
}

/**
 * Active processing state tracker
 */
interface ProcessingState {
  chunkId: string;
  startTime: number;
  abortController: AbortController;
  streamBuffer: string;
}

/**
 * Active processing operations
 */
const activeProcessing = new Map<string, ProcessingState>();

/**
 * Simulates AI processing for a chunk
 * In production, this would call actual AI API endpoints
 *
 * @param chunk - File chunk to process
 * @param config - AI processing configuration
 * @param chunkId - Unique identifier for this operation
 * @param onProgress - Progress callback
 * @param onStream - Stream callback for incremental results
 * @returns Processing result
 */
async function processChunkWithAI(
  chunk: FileChunk,
  config: AIProcessingConfig,
  chunkId: string,
  onProgress: (stage: string, progress: number, message?: string) => void,
  onStream?: (content: string, isComplete: boolean) => void
): Promise<AIProcessingResult> {
  const startTime = performance.now();

  // Get abort controller for this operation
  const state = activeProcessing.get(chunkId);
  if (!state) {
    throw new Error('Processing state not found');
  }

  // Stage 1: Preparing
  onProgress('preparing', 0.1, 'Preparing chunk for AI processing');

  // Validate chunk
  if (!chunk.content || chunk.content.trim().length === 0) {
    throw new Error('Empty chunk content');
  }

  // Stage 2: Processing
  onProgress('processing', 0.3, `Processing with ${config.operationType}`);

  // Simulate API call delay (in production, this would be actual AI API call)
  await simulateDelay(100);

  // Check if cancelled
  if (state.abortController.signal.aborted) {
    throw new Error('Operation cancelled');
  }

  // Stage 3: Streaming or direct response
  let result: string;
  let wasStreamed = false;

  if (config.streaming && onStream) {
    wasStreamed = true;
    onProgress('streaming', 0.5, 'Streaming AI response');

    // Simulate streaming response
    result = await simulateStreamingResponse(
      chunk,
      config,
      onStream,
      state.abortController.signal
    );
  } else {
    onProgress('processing', 0.7, 'Generating response');
    result = await simulateDirectResponse(chunk, config, state.abortController.signal);
  }

  // Stage 4: Finalizing
  onProgress('finalizing', 0.9, 'Finalizing result');

  const processingTime = performance.now() - startTime;

  return {
    chunk,
    content: result,
    metadata: {
      processingTime,
      wasStreamed,
      model: config.model || 'default',
      tokensUsed: estimateTokenCount(chunk.content) + estimateTokenCount(result),
      confidence: 0.95,
    },
    extras: {
      operationType: config.operationType,
    },
  };
}

/**
 * Simulates a streaming AI response
 */
async function simulateStreamingResponse(
  chunk: FileChunk,
  config: AIProcessingConfig,
  onStream: (content: string, isComplete: boolean) => void,
  signal: AbortSignal
): Promise<string> {
  // In production, this would connect to SSE endpoint or WebSocket
  const transformedContent = transformContent(chunk.content, config.operationType);
  const words = transformedContent.split(' ');

  let accumulated = '';

  // Stream words incrementally
  for (let i = 0; i < words.length; i++) {
    if (signal.aborted) {
      throw new Error('Streaming cancelled');
    }

    const word = words[i];
    accumulated += (i > 0 ? ' ' : '') + word;

    // Send stream chunk
    onStream(accumulated, i === words.length - 1);

    // Simulate network delay between chunks
    await simulateDelay(10);
  }

  return accumulated;
}

/**
 * Simulates a direct (non-streaming) AI response
 */
async function simulateDirectResponse(
  chunk: FileChunk,
  config: AIProcessingConfig,
  signal: AbortSignal
): Promise<string> {
  // Simulate processing time
  await simulateDelay(200);

  if (signal.aborted) {
    throw new Error('Operation cancelled');
  }

  return transformContent(chunk.content, config.operationType);
}

/**
 * Transforms content based on operation type
 * This is a placeholder - real implementation would call AI APIs
 */
function transformContent(content: string, operationType: AIOperationType): string {
  switch (operationType) {
    case 'analyze':
      return `Analysis: This code contains ${content.split('\n').length} lines and ${
        content.split(/\s+/).length
      } words.`;

    case 'transform':
      return content.toUpperCase();

    case 'complete':
      return content + '\n// AI-generated completion';

    case 'explain':
      return `Explanation: This code performs operations on ${
        content.split('\n').length
      } lines.`;

    case 'refactor':
      return `// Refactored version\n${content}`;

    case 'generate':
      return `// Generated based on:\n${content}`;

    default:
      return content;
  }
}

/**
 * Estimates token count for content
 */
function estimateTokenCount(content: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(content.length / 4);
}

/**
 * Simulates async delay
 */
function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Worker message handler
 */
self.addEventListener('message', async (event: MessageEvent<AIWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'PROCESS_CHUNK': {
      const { chunk, config, chunkId, context } = message.payload;

      // Create processing state
      const state: ProcessingState = {
        chunkId,
        startTime: performance.now(),
        abortController: new AbortController(),
        streamBuffer: '',
      };

      activeProcessing.set(chunkId, state);

      try {
        // Progress callback
        const onProgress = (
          stage: 'preparing' | 'processing' | 'streaming' | 'finalizing',
          progress: number,
          progressMessage?: string
        ): void => {
          if (activeProcessing.has(chunkId)) {
            const progressMsg: AIProgressMessage = {
              type: 'PROGRESS',
              payload: {
                chunkId,
                stage,
                progress,
                message: progressMessage,
              },
            };
            self.postMessage(progressMsg);
          }
        };

        // Stream callback
        const onStream = config.streaming
          ? (content: string, isComplete: boolean): void => {
              if (activeProcessing.has(chunkId)) {
                const streamMsg: StreamChunkMessage = {
                  type: 'STREAM_CHUNK',
                  payload: {
                    chunkId,
                    content,
                    isComplete,
                  },
                };
                self.postMessage(streamMsg);
              }
            }
          : undefined;

        // Process the chunk
        const result = await processChunkWithAI(chunk, config, chunkId, onProgress, onStream);

        const duration = performance.now() - state.startTime;

        // Check if still active (not cancelled)
        if (activeProcessing.has(chunkId)) {
          const response: ProcessCompleteMessage = {
            type: 'PROCESS_COMPLETE',
            payload: {
              chunkId,
              result,
              duration,
            },
          };

          self.postMessage(response);
        }
      } catch (error) {
        const errorMsg: ProcessErrorMessage = {
          type: 'PROCESS_ERROR',
          payload: {
            chunkId,
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error && error.message.includes('cancelled')
              ? 'unknown'
              : error instanceof Error && error.message.includes('network')
              ? 'network'
              : error instanceof Error && error.message.includes('timeout')
              ? 'timeout'
              : 'unknown',
          },
        };

        self.postMessage(errorMsg);
      } finally {
        // Clean up
        activeProcessing.delete(chunkId);
      }

      break;
    }

    case 'CANCEL': {
      const { chunkId } = message.payload;

      if (chunkId) {
        // Cancel specific operation
        const state = activeProcessing.get(chunkId);
        if (state) {
          state.abortController.abort();
          activeProcessing.delete(chunkId);
        }
      } else {
        // Cancel all operations
        const entries = Array.from(activeProcessing.entries());
        for (const [id, state] of entries) {
          state.abortController.abort();
          activeProcessing.delete(id);
        }
      }

      break;
    }

    default:
      // Ignore unknown message types
      break;
  }
});

/**
 * Worker ready signal
 */
self.postMessage({ type: 'READY' });
