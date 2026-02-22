import { useState, useCallback, useRef, useEffect } from 'react'
import { StreamTracker, StreamMetadata, StreamTrackerConfig } from '@/lib/ai/stream-utils'

/**
 * Configuration for AI streaming operations
 */
export interface AIStreamConfig {
  /** API endpoint for streaming (default: '/api/ai/chat/stream') */
  endpoint?: string
  /** Model to use for AI responses */
  model?: string
  /** Additional context for the AI */
  context?: {
    workspaceId?: string
    files?: string[]
    previousMessages?: any[]
    [key: string]: any
  }
  /** Stream tracker configuration */
  trackerConfig?: StreamTrackerConfig
  /** Callback when stream starts */
  onStreamStart?: () => void
  /** Callback when stream updates */
  onStreamUpdate?: (content: string, metadata: StreamMetadata) => void
  /** Callback when stream completes */
  onStreamComplete?: (content: string, metadata: StreamMetadata) => void
  /** Callback when stream errors */
  onStreamError?: (error: Error) => void
  /** Callback when stream is canceled */
  onStreamCancel?: () => void
}

/**
 * State returned by useAIStream hook
 */
export interface AIStreamState {
  /** Current accumulated content from the stream */
  content: string
  /** Current streaming metadata (tokens, timing, etc.) */
  metadata: StreamMetadata | null
  /** Whether a stream is currently active */
  isStreaming: boolean
  /** Whether the stream has completed successfully */
  isComplete: boolean
  /** Current error, if any */
  error: Error | null
  /** The last sent message (for regeneration) */
  lastMessage: string | null
}

/**
 * Actions returned by useAIStream hook
 */
export interface AIStreamActions {
  /** Send a message and start streaming response */
  send: (message: string) => Promise<void>
  /** Cancel the current streaming operation */
  cancel: () => void
  /** Regenerate the last response */
  regenerate: () => Promise<void>
  /** Reset the stream state */
  reset: () => void
}

/**
 * Return type of useAIStream hook
 */
export type UseAIStreamReturn = AIStreamState & AIStreamActions

/**
 * Custom React hook for AI streaming operations with progress tracking
 *
 * Features:
 * - Real-time token counting and timing metrics
 * - Cancel streaming operations mid-flight
 * - Regenerate previous responses
 * - Automatic progress tracking with StreamTracker
 * - SSE (Server-Sent Events) streaming support
 * - Error handling and recovery
 *
 * Use cases:
 * - AI chat interfaces with real-time response streaming
 * - Code generation with progress indicators
 * - Long-form content generation with cancel/retry
 *
 * Performance:
 * - Minimal re-renders (only on content/metadata updates)
 * - Automatic cleanup of streaming connections
 * - AbortController for proper request cancellation
 *
 * @param config - Configuration options for streaming
 * @returns Stream state and control functions
 *
 * @example
 * // Basic usage
 * const { content, metadata, isStreaming, send, cancel } = useAIStream({
 *   model: 'anthropic/claude-3-sonnet',
 *   onStreamComplete: (content, metadata) => {
 *     console.log('Received', metadata.tokenCount, 'tokens')
 *   }
 * })
 *
 * // Send a message
 * await send('Explain quantum computing')
 *
 * // Cancel if needed
 * cancel()
 *
 * @example
 * // With context and callbacks
 * const { content, isStreaming, send, regenerate } = useAIStream({
 *   endpoint: '/api/ai/chat/stream',
 *   model: 'openai/gpt-4',
 *   context: {
 *     workspaceId: 'my-workspace',
 *     files: ['App.tsx', 'utils.ts']
 *   },
 *   onStreamStart: () => console.log('Stream started'),
 *   onStreamUpdate: (content, metadata) => {
 *     console.log(`Progress: ${metadata.tokenCount} tokens`)
 *   }
 * })
 */
export function useAIStream(config: AIStreamConfig = {}): UseAIStreamReturn {
  const {
    endpoint = '/api/ai/chat/stream',
    model,
    context,
    trackerConfig,
    onStreamStart,
    onStreamUpdate,
    onStreamComplete,
    onStreamError,
    onStreamCancel,
  } = config

  // State
  const [content, setContent] = useState<string>('')
  const [metadata, setMetadata] = useState<StreamMetadata | null>(null)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [isComplete, setIsComplete] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  // Refs for cancellation and tracking
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamTrackerRef = useRef<StreamTracker | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  /**
   * Cleanup function to abort streaming and reset refs
   */
  const cleanup = useCallback(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Cancel reader if active
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {
        // Ignore cancellation errors
      })
      readerRef.current = null
    }

    // Reset tracker
    streamTrackerRef.current = null
  }, [])

  /**
   * Reset stream state to initial values
   */
  const reset = useCallback(() => {
    cleanup()
    setContent('')
    setMetadata(null)
    setIsStreaming(false)
    setIsComplete(false)
    setError(null)
    setLastMessage(null)
  }, [cleanup])

  /**
   * Cancel the current streaming operation
   */
  const cancel = useCallback(() => {
    if (!isStreaming) return

    cleanup()
    setIsStreaming(false)
    setIsComplete(false)
    onStreamCancel?.()
  }, [isStreaming, cleanup, onStreamCancel])

  /**
   * Send a message and start streaming the response
   */
  const send = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        console.warn('useAIStream: Cannot send empty message')
        return
      }

      if (isStreaming) {
        console.warn('useAIStream: Stream already in progress, canceling previous stream')
        cancel()
      }

      // Reset state for new stream
      setContent('')
      setMetadata(null)
      setError(null)
      setIsComplete(false)
      setLastMessage(message)

      // Create new abort controller for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Create stream tracker
      const tracker = new StreamTracker({
        model,
        ...trackerConfig,
      })
      streamTrackerRef.current = tracker

      setIsStreaming(true)
      onStreamStart?.()

      try {
        // Make streaming request
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            model,
            context,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Response body is null')
        }

        // Process the stream
        const reader = response.body.getReader()
        readerRef.current = reader
        const decoder = new TextDecoder()

        let done = false
        let accumulatedContent = ''

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone

          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            accumulatedContent += chunk

            // Update tracker with new chunk
            const currentMetadata = tracker.update(chunk)

            // Update state
            setContent(accumulatedContent)
            setMetadata(currentMetadata)
            onStreamUpdate?.(accumulatedContent, currentMetadata)
          }
        }

        // Mark stream as complete
        const finalMetadata = tracker.complete()
        setMetadata(finalMetadata)
        setIsStreaming(false)
        setIsComplete(true)
        onStreamComplete?.(accumulatedContent, finalMetadata)
      } catch (err) {
        // Only handle as error if not aborted (cancellation is intentional)
        if (err instanceof Error && err.name === 'AbortError') {
          // Stream was canceled, not an error - just update streaming state
          setIsStreaming(false)
          return
        }

        const error = err instanceof Error ? err : new Error('Unknown streaming error')
        console.error('useAIStream error:', error)
        setError(error)
        setIsStreaming(false)
        setIsComplete(false)
        onStreamError?.(error)
      } finally {
        // Clean up refs
        readerRef.current = null
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [
      endpoint,
      model,
      context,
      trackerConfig,
      isStreaming,
      cancel,
      onStreamStart,
      onStreamUpdate,
      onStreamComplete,
      onStreamError,
    ]
  )

  /**
   * Regenerate the last response
   */
  const regenerate = useCallback(async () => {
    if (!lastMessage) {
      console.warn('useAIStream: No previous message to regenerate')
      return
    }

    await send(lastMessage)
  }, [lastMessage, send])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    // State
    content,
    metadata,
    isStreaming,
    isComplete,
    error,
    lastMessage,

    // Actions
    send,
    cancel,
    regenerate,
    reset,
  }
}
