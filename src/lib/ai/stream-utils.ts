/**
 * Stream Utilities for AI Operations
 * Provides token counting, timing tracking, and progress estimation for streaming AI responses
 */

/**
 * Metadata tracked during a streaming operation
 */
export interface StreamMetadata {
  /** Total tokens processed so far */
  tokenCount: number
  /** Start time of the stream */
  startTime: number
  /** Last update timestamp */
  lastUpdateTime: number
  /** Elapsed time in milliseconds */
  elapsedMs: number
  /** Tokens per second rate */
  tokensPerSecond: number
  /** Estimated completion time in milliseconds (if available) */
  estimatedCompletionMs?: number
  /** Model being used */
  model?: string
  /** Whether the stream is complete */
  isComplete: boolean
}

/**
 * Token estimation options
 */
export interface TokenEstimationOptions {
  /** Average characters per token (default: 4) */
  charsPerToken?: number
  /** Whether to include whitespace in counting (default: true) */
  includeWhitespace?: boolean
}

/**
 * Progress tracking state for a stream
 */
export interface StreamProgressState {
  /** Current accumulated content */
  content: string
  /** Current metadata */
  metadata: StreamMetadata
  /** Snapshot history for rate calculation */
  snapshots: StreamSnapshot[]
}

/**
 * A snapshot of stream state at a point in time
 */
export interface StreamSnapshot {
  timestamp: number
  tokenCount: number
}

/**
 * Configuration for stream tracker
 */
export interface StreamTrackerConfig {
  /** Model name for metadata */
  model?: string
  /** How often to take snapshots for rate calculation (ms) */
  snapshotInterval?: number
  /** Maximum number of snapshots to keep */
  maxSnapshots?: number
  /** Token estimation options */
  tokenOptions?: TokenEstimationOptions
}

/**
 * Estimates token count from text
 * Uses a simple heuristic: ~4 characters per token for English text
 * This is an approximation - actual tokenization varies by model
 */
export function estimateTokenCount(
  text: string,
  options: TokenEstimationOptions = {}
): number {
  const { charsPerToken = 4, includeWhitespace = true } = options

  if (!text) return 0

  const relevantText = includeWhitespace ? text : text.replace(/\s+/g, '')
  return Math.ceil(relevantText.length / charsPerToken)
}

/**
 * Calculates tokens per second rate
 */
export function calculateTokensPerSecond(
  tokenCount: number,
  elapsedMs: number
): number {
  if (elapsedMs === 0) return 0
  return (tokenCount / elapsedMs) * 1000
}

/**
 * Estimates completion time based on current rate and expected total tokens
 */
export function estimateCompletionTime(
  currentTokens: number,
  totalEstimatedTokens: number,
  tokensPerSecond: number
): number | undefined {
  if (tokensPerSecond === 0 || currentTokens >= totalEstimatedTokens) {
    return undefined
  }

  const remainingTokens = totalEstimatedTokens - currentTokens
  return (remainingTokens / tokensPerSecond) * 1000 // Convert to ms
}

/**
 * Creates a new stream tracker for monitoring progress
 */
export class StreamTracker {
  private state: StreamProgressState
  private config: Required<StreamTrackerConfig>
  private lastSnapshotTime: number

  constructor(config: StreamTrackerConfig = {}) {
    const now = Date.now()

    this.config = {
      model: config.model || 'unknown',
      snapshotInterval: config.snapshotInterval || 1000, // 1 second
      maxSnapshots: config.maxSnapshots || 10,
      tokenOptions: config.tokenOptions || {},
    }

    this.state = {
      content: '',
      metadata: {
        tokenCount: 0,
        startTime: now,
        lastUpdateTime: now,
        elapsedMs: 0,
        tokensPerSecond: 0,
        model: this.config.model,
        isComplete: false,
      },
      snapshots: [{ timestamp: now, tokenCount: 0 }],
    }

    this.lastSnapshotTime = now
  }

  /**
   * Updates the tracker with new content chunk
   */
  update(contentChunk: string): StreamMetadata {
    const now = Date.now()

    // Append content
    this.state.content += contentChunk

    // Update token count
    const newTokenCount = estimateTokenCount(
      this.state.content,
      this.config.tokenOptions
    )

    // Update timing
    const elapsedMs = now - this.state.metadata.startTime
    const tokensPerSecond = calculateTokensPerSecond(newTokenCount, elapsedMs)

    // Take snapshot if interval elapsed
    if (now - this.lastSnapshotTime >= this.config.snapshotInterval) {
      this.takeSnapshot(now, newTokenCount)
    }

    // Update metadata
    this.state.metadata = {
      ...this.state.metadata,
      tokenCount: newTokenCount,
      lastUpdateTime: now,
      elapsedMs,
      tokensPerSecond,
    }

    return this.getMetadata()
  }

  /**
   * Takes a snapshot of current state
   */
  private takeSnapshot(timestamp: number, tokenCount: number): void {
    this.state.snapshots.push({ timestamp, tokenCount })

    // Keep only recent snapshots
    if (this.state.snapshots.length > this.config.maxSnapshots) {
      this.state.snapshots.shift()
    }

    this.lastSnapshotTime = timestamp
  }

  /**
   * Calculates moving average tokens per second from snapshots
   */
  getMovingAverageRate(): number {
    if (this.state.snapshots.length < 2) {
      return this.state.metadata.tokensPerSecond
    }

    const first = this.state.snapshots[0]
    const last = this.state.snapshots[this.state.snapshots.length - 1]

    const tokenDiff = last.tokenCount - first.tokenCount
    const timeDiff = last.timestamp - first.timestamp

    return calculateTokensPerSecond(tokenDiff, timeDiff)
  }

  /**
   * Sets estimated completion time
   */
  setEstimatedCompletion(totalEstimatedTokens: number): void {
    const rate = this.getMovingAverageRate()
    const estimatedMs = estimateCompletionTime(
      this.state.metadata.tokenCount,
      totalEstimatedTokens,
      rate
    )

    this.state.metadata.estimatedCompletionMs = estimatedMs
  }

  /**
   * Marks the stream as complete
   */
  complete(): StreamMetadata {
    const now = Date.now()
    this.state.metadata = {
      ...this.state.metadata,
      lastUpdateTime: now,
      elapsedMs: now - this.state.metadata.startTime,
      isComplete: true,
      estimatedCompletionMs: 0,
    }

    return this.getMetadata()
  }

  /**
   * Gets current metadata
   */
  getMetadata(): StreamMetadata {
    return { ...this.state.metadata }
  }

  /**
   * Gets current content
   */
  getContent(): string {
    return this.state.content
  }

  /**
   * Gets full state
   */
  getState(): StreamProgressState {
    return {
      content: this.state.content,
      metadata: this.getMetadata(),
      snapshots: [...this.state.snapshots],
    }
  }

  /**
   * Resets the tracker
   */
  reset(): void {
    const now = Date.now()
    this.state = {
      content: '',
      metadata: {
        tokenCount: 0,
        startTime: now,
        lastUpdateTime: now,
        elapsedMs: 0,
        tokensPerSecond: 0,
        model: this.config.model,
        isComplete: false,
      },
      snapshots: [{ timestamp: now, tokenCount: 0 }],
    }
    this.lastSnapshotTime = now
  }
}

/**
 * Formats elapsed time to human-readable string
 */
export function formatElapsedTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)

  if (minutes === 0) {
    return `${seconds}s`
  }

  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Formats tokens per second to readable rate
 */
export function formatTokenRate(tokensPerSecond: number): string {
  if (tokensPerSecond < 1) {
    return '< 1 token/s'
  }

  return `${Math.round(tokensPerSecond)} tokens/s`
}

/**
 * Formats estimated completion time
 */
export function formatEstimatedCompletion(ms: number | undefined): string {
  if (ms === undefined || ms === 0) {
    return 'Unknown'
  }

  if (ms < 1000) {
    return '< 1s'
  }

  return `~${formatElapsedTime(ms)}`
}
