/**
 * Context Quality Metrics Tracking
 *
 * Provides comprehensive metrics tracking for context window management:
 * - Token utilization trends
 * - Relevance score distributions
 * - Priority distributions
 * - Inclusion/exclusion rates
 * - Strategy effectiveness
 * - Performance metrics (build time, reranking time)
 *
 * Integrates with the existing logging infrastructure at src/lib/logging/
 * and the monitoring system for metrics submission.
 *
 * @example
 * ```typescript
 * import {
 *   trackContextBuild,
 *   trackContextOptimization,
 *   getContextMetrics,
 *   recordContextEvent
 * } from '@/lib/ai/context/context-metrics';
 *
 * // Track context building
 * const result = await trackContextBuild('session-123', async () => {
 *   return buildChatContext(options);
 * });
 *
 * // Record context event
 * recordContextEvent({
 *   type: 'context_built',
 *   sessionId: 'session-123',
 *   totalTokens: 5000,
 *   utilizationPercent: 75
 * });
 *
 * // Get aggregated metrics
 * const metrics = getContextMetrics('session-123');
 * ```
 */

import { logger, createLogger } from '@/lib/logger';
import { monitoring } from '@/lib/monitoring/datadog-client';
import {
  ContextWindow,
  ContextItem,
  ContextStrategy,
  ContextPriority,
  ContextItemType
} from '../../../types/context';
import { BuiltContext } from './context-integration';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for context metrics thresholds
 */
export interface ContextMetricsThresholds {
  /** Threshold for low utilization warning (default: 30%) */
  lowUtilizationPercent: number;
  /** Threshold for high utilization warning (default: 95%) */
  highUtilizationPercent: number;
  /** Threshold for low relevance score warning (default: 0.3) */
  lowRelevanceScore: number;
  /** Threshold for slow context build in ms (default: 1000) */
  slowBuildMs: number;
  /** Threshold for high exclusion rate (default: 50%) */
  highExclusionRatePercent: number;
}

/**
 * Context event types for tracking
 */
export type ContextEventType =
  | 'context_built'
  | 'context_optimized'
  | 'item_added'
  | 'item_removed'
  | 'item_evicted'
  | 'rerank_performed'
  | 'strategy_changed'
  | 'model_switched';

/**
 * Context event data
 */
export interface ContextEvent {
  /** Type of event */
  type: ContextEventType;
  /** Session or request ID */
  sessionId: string;
  /** Timestamp of event */
  timestamp: Date;
  /** Total tokens in context */
  totalTokens?: number;
  /** Utilization percentage */
  utilizationPercent?: number;
  /** Strategy used */
  strategy?: ContextStrategy;
  /** Model used */
  model?: string;
  /** Number of items included */
  itemsIncluded?: number;
  /** Number of items excluded */
  itemsExcluded?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Priority distribution snapshot
 */
export interface PriorityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  optional: number;
}

/**
 * Context item type distribution
 */
export interface TypeDistribution {
  systemPrompt: number;
  userMessage: number;
  assistantMessage: number;
  file: number;
  ragResult: number;
  conversation: number;
  toolResult: number;
}

/**
 * Relevance score statistics
 */
export interface RelevanceStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  count: number;
}

/**
 * Context quality snapshot
 */
export interface ContextQualitySnapshot {
  sessionId: string;
  timestamp: Date;
  /** Token usage */
  totalTokens: number;
  availableTokens: number;
  utilizationPercent: number;
  /** Item statistics */
  itemsIncluded: number;
  itemsExcluded: number;
  exclusionRate: number;
  /** Distributions */
  priorityDistribution: PriorityDistribution;
  typeDistribution: TypeDistribution;
  /** Quality metrics */
  averageRelevanceScore: number;
  relevanceStats: RelevanceStats;
  /** Strategy and model */
  strategy: ContextStrategy;
  model: string;
  /** Performance */
  buildDurationMs?: number;
  rerankDurationMs?: number;
}

/**
 * Aggregated context metrics over time
 */
export interface AggregatedContextMetrics {
  sessionId: string;
  period: {
    start: Date;
    end: Date;
  };
  /** Total events tracked */
  totalEvents: number;
  /** Context builds */
  contextBuilds: number;
  /** Average token usage */
  averageTokens: number;
  averageUtilization: number;
  /** Utilization distribution */
  utilizationDistribution: {
    low: number; // < 30%
    optimal: number; // 30-80%
    high: number; // 80-95%
    critical: number; // > 95%
  };
  /** Exclusion metrics */
  averageExclusionRate: number;
  totalItemsExcluded: number;
  /** Quality metrics */
  averageRelevanceScore: number;
  /** Strategy usage */
  strategyUsage: Record<ContextStrategy, number>;
  /** Performance metrics */
  averageBuildTimeMs: number;
  averageRerankTimeMs: number;
  /** Latest snapshot */
  latestSnapshot?: ContextQualitySnapshot;
}

/**
 * Context build timing result
 */
export interface ContextBuildTimingResult<T> {
  result: T;
  sessionId: string;
  durationMs: number;
  formattedDuration: string;
  timestamp: number;
  metrics?: ContextQualitySnapshot;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_THRESHOLDS: ContextMetricsThresholds = {
  lowUtilizationPercent: 30,
  highUtilizationPercent: 95,
  lowRelevanceScore: 0.3,
  slowBuildMs: 1000,
  highExclusionRatePercent: 50
};

let currentThresholds: ContextMetricsThresholds = { ...DEFAULT_THRESHOLDS };

/**
 * Configure context metrics thresholds
 */
export function configureMetricsThresholds(
  thresholds: Partial<ContextMetricsThresholds>
): void {
  currentThresholds = { ...currentThresholds, ...thresholds };
}

/**
 * Get current metrics thresholds
 */
export function getMetricsThresholds(): ContextMetricsThresholds {
  return { ...currentThresholds };
}

// ============================================================================
// In-Memory Storage
// ============================================================================

const contextLogger = createLogger({ component: 'context-metrics' });

// Store events by session ID
const eventStore = new Map<string, ContextEvent[]>();

// Store snapshots by session ID
const snapshotStore = new Map<string, ContextQualitySnapshot[]>();

// Maximum events/snapshots per session (prevent memory bloat)
const MAX_EVENTS_PER_SESSION = 1000;
const MAX_SNAPSHOTS_PER_SESSION = 100;

// ============================================================================
// Event Recording
// ============================================================================

/**
 * Record a context event
 *
 * @param event - Context event data
 *
 * @example
 * ```typescript
 * recordContextEvent({
 *   type: 'context_built',
 *   sessionId: 'session-123',
 *   totalTokens: 5000,
 *   utilizationPercent: 75,
 *   strategy: ContextStrategy.HYBRID
 * });
 * ```
 */
export function recordContextEvent(event: ContextEvent): void {
  const { sessionId, type } = event;

  // Ensure timestamp is set
  if (!event.timestamp) {
    event.timestamp = new Date();
  }

  // Get or create event list for session
  let events = eventStore.get(sessionId);
  if (!events) {
    events = [];
    eventStore.set(sessionId, events);
  }

  // Add event
  events.push(event);

  // Trim if exceeds max
  if (events.length > MAX_EVENTS_PER_SESSION) {
    events.shift(); // Remove oldest
  }

  // Log event
  contextLogger.debug('Context event recorded', {
    sessionId,
    type,
    totalTokens: event.totalTokens,
    utilizationPercent: event.utilizationPercent,
    durationMs: event.durationMs
  });

  // Submit to monitoring if available
  if (monitoring) {
    void monitoring.submitMetric({
      metric: 'context.event',
      value: 1,
      tags: [`type:${type}`, `session:${sessionId}`]
    });

    if (event.totalTokens !== undefined) {
      void monitoring.submitMetric({
        metric: 'context.tokens',
        value: event.totalTokens,
        tags: [`session:${sessionId}`]
      });
    }

    if (event.utilizationPercent !== undefined) {
      void monitoring.submitMetric({
        metric: 'context.utilization',
        value: event.utilizationPercent,
        tags: [`session:${sessionId}`]
      });
    }

    if (event.durationMs !== undefined) {
      void monitoring.submitMetric({
        metric: `context.${type}_duration`,
        value: event.durationMs,
        tags: [`session:${sessionId}`]
      });
    }
  }

  // Check thresholds and warn if needed
  checkThresholds(event);
}

/**
 * Check event against thresholds and warn if exceeded
 */
function checkThresholds(event: ContextEvent): void {
  const thresholds = currentThresholds;

  if (
    event.utilizationPercent !== undefined &&
    event.utilizationPercent < thresholds.lowUtilizationPercent
  ) {
    contextLogger.warn('Low context utilization detected', {
      sessionId: event.sessionId,
      utilizationPercent: event.utilizationPercent,
      threshold: thresholds.lowUtilizationPercent
    });
  }

  if (
    event.utilizationPercent !== undefined &&
    event.utilizationPercent > thresholds.highUtilizationPercent
  ) {
    contextLogger.warn('High context utilization detected', {
      sessionId: event.sessionId,
      utilizationPercent: event.utilizationPercent,
      threshold: thresholds.highUtilizationPercent
    });
  }

  if (event.durationMs !== undefined && event.durationMs > thresholds.slowBuildMs) {
    contextLogger.warn('Slow context build detected', {
      sessionId: event.sessionId,
      durationMs: event.durationMs,
      threshold: thresholds.slowBuildMs
    });
  }

  if (event.itemsExcluded !== undefined && event.itemsIncluded !== undefined) {
    const totalItems = event.itemsIncluded + event.itemsExcluded;
    const exclusionRate = totalItems > 0 ? (event.itemsExcluded / totalItems) * 100 : 0;

    if (exclusionRate > thresholds.highExclusionRatePercent) {
      contextLogger.warn('High exclusion rate detected', {
        sessionId: event.sessionId,
        exclusionRate: exclusionRate.toFixed(2),
        itemsExcluded: event.itemsExcluded,
        itemsIncluded: event.itemsIncluded,
        threshold: thresholds.highExclusionRatePercent
      });
    }
  }
}

// ============================================================================
// Snapshot Creation
// ============================================================================

/**
 * Create context quality snapshot from context window
 *
 * @param sessionId - Session or request ID
 * @param window - Context window to snapshot
 * @param options - Additional options
 * @returns Quality snapshot
 */
export function createContextSnapshot(
  sessionId: string,
  window: ContextWindow,
  options: {
    buildDurationMs?: number;
    rerankDurationMs?: number;
  } = {}
): ContextQualitySnapshot {
  const { items, excludedItems, totalTokens, availableTokens, strategy, modelConfig } =
    window;

  // Calculate distributions
  const priorityDist: PriorityDistribution = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    optional: 0
  };

  const typeDist: TypeDistribution = {
    systemPrompt: 0,
    userMessage: 0,
    assistantMessage: 0,
    file: 0,
    ragResult: 0,
    conversation: 0,
    toolResult: 0
  };

  const relevanceScores: number[] = [];

  for (const item of items) {
    // Priority distribution
    switch (item.priority) {
      case ContextPriority.CRITICAL:
        priorityDist.critical++;
        break;
      case ContextPriority.HIGH:
        priorityDist.high++;
        break;
      case ContextPriority.MEDIUM:
        priorityDist.medium++;
        break;
      case ContextPriority.LOW:
        priorityDist.low++;
        break;
      case ContextPriority.OPTIONAL:
        priorityDist.optional++;
        break;
    }

    // Type distribution
    switch (item.type) {
      case ContextItemType.SYSTEM_PROMPT:
        typeDist.systemPrompt++;
        break;
      case ContextItemType.USER_MESSAGE:
        typeDist.userMessage++;
        break;
      case ContextItemType.ASSISTANT_MESSAGE:
        typeDist.assistantMessage++;
        break;
      case ContextItemType.FILE:
        typeDist.file++;
        break;
      case ContextItemType.RAG_RESULT:
        typeDist.ragResult++;
        break;
      case ContextItemType.CONVERSATION:
        typeDist.conversation++;
        break;
      case ContextItemType.TOOL_RESULT:
        typeDist.toolResult++;
        break;
    }

    // Collect relevance scores
    relevanceScores.push(item.relevanceScore);
  }

  // Calculate relevance statistics
  const sortedScores = [...relevanceScores].sort((a, b) => a - b);
  const relevanceStats: RelevanceStats = {
    min: sortedScores[0] ?? 0,
    max: sortedScores[sortedScores.length - 1] ?? 0,
    mean:
      relevanceScores.length > 0
        ? relevanceScores.reduce((sum, s) => sum + s, 0) / relevanceScores.length
        : 0,
    median:
      sortedScores.length > 0
        ? sortedScores[Math.floor(sortedScores.length / 2)]
        : 0,
    p95:
      sortedScores.length > 0
        ? sortedScores[Math.floor(sortedScores.length * 0.95)]
        : 0,
    count: relevanceScores.length
  };

  const utilizationPercent = window.utilizationPercent;
  const totalItems = items.length + excludedItems.length;
  const exclusionRate = totalItems > 0 ? (excludedItems.length / totalItems) * 100 : 0;

  const snapshot: ContextQualitySnapshot = {
    sessionId,
    timestamp: new Date(),
    totalTokens,
    availableTokens,
    utilizationPercent,
    itemsIncluded: items.length,
    itemsExcluded: excludedItems.length,
    exclusionRate,
    priorityDistribution: priorityDist,
    typeDistribution: typeDist,
    averageRelevanceScore: relevanceStats.mean,
    relevanceStats,
    strategy,
    model: modelConfig.model,
    buildDurationMs: options.buildDurationMs,
    rerankDurationMs: options.rerankDurationMs
  };

  // Store snapshot
  let snapshots = snapshotStore.get(sessionId);
  if (!snapshots) {
    snapshots = [];
    snapshotStore.set(sessionId, snapshots);
  }

  snapshots.push(snapshot);

  // Trim if exceeds max
  if (snapshots.length > MAX_SNAPSHOTS_PER_SESSION) {
    snapshots.shift(); // Remove oldest
  }

  return snapshot;
}

/**
 * Create snapshot from built context result
 */
export function createSnapshotFromBuiltContext(
  sessionId: string,
  builtContext: BuiltContext,
  buildDurationMs?: number
): ContextQualitySnapshot {
  return createContextSnapshot(sessionId, builtContext.window, {
    buildDurationMs
  });
}

// ============================================================================
// Context Build Tracking
// ============================================================================

/**
 * Track context building operation with timing
 *
 * Wraps a context building function to automatically track timing
 * and record metrics.
 *
 * @param sessionId - Session or request ID
 * @param buildFn - Async function that builds context
 * @returns Timing result with built context
 *
 * @example
 * ```typescript
 * const result = await trackContextBuild('session-123', async () => {
 *   return buildChatContext({
 *     model: 'gpt-4',
 *     strategy: ContextStrategy.HYBRID,
 *     previousMessages: messages
 *   });
 * });
 * ```
 */
export async function trackContextBuild<T extends BuiltContext>(
  sessionId: string,
  buildFn: () => Promise<T>
): Promise<ContextBuildTimingResult<T>> {
  const startTime = performance.now();

  try {
    const result = await buildFn();
    const durationMs = performance.now() - startTime;
    const formattedDuration = formatDuration(durationMs);

    // Create snapshot
    const snapshot = createSnapshotFromBuiltContext(sessionId, result, durationMs);

    // Record event
    recordContextEvent({
      type: 'context_built',
      sessionId,
      timestamp: new Date(),
      totalTokens: result.window.totalTokens,
      utilizationPercent: result.window.utilizationPercent,
      strategy: result.window.strategy,
      model: result.window.modelConfig.model,
      itemsIncluded: result.window.items.length,
      itemsExcluded: result.window.excludedItems.length,
      durationMs
    });

    contextLogger.info('Context built successfully', {
      sessionId,
      durationMs: durationMs.toFixed(2),
      formattedDuration,
      totalTokens: result.window.totalTokens,
      utilizationPercent: result.window.utilizationPercent.toFixed(2),
      itemsIncluded: result.window.items.length,
      itemsExcluded: result.window.excludedItems.length
    });

    return {
      result,
      sessionId,
      durationMs,
      formattedDuration,
      timestamp: Date.now(),
      metrics: snapshot
    };
  } catch (error) {
    const durationMs = performance.now() - startTime;

    contextLogger.error('Context build failed', {
      sessionId,
      durationMs: durationMs.toFixed(2),
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Track context optimization operation
 */
export async function trackContextOptimization(
  sessionId: string,
  optimizeFn: () => void | Promise<void>
): Promise<{ durationMs: number; formattedDuration: string }> {
  const startTime = performance.now();

  try {
    await optimizeFn();
    const durationMs = performance.now() - startTime;
    const formattedDuration = formatDuration(durationMs);

    recordContextEvent({
      type: 'context_optimized',
      sessionId,
      timestamp: new Date(),
      durationMs
    });

    contextLogger.debug('Context optimized', {
      sessionId,
      durationMs: durationMs.toFixed(2),
      formattedDuration
    });

    return { durationMs, formattedDuration };
  } catch (error) {
    const durationMs = performance.now() - startTime;

    contextLogger.error('Context optimization failed', {
      sessionId,
      durationMs: durationMs.toFixed(2),
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

// ============================================================================
// Metrics Retrieval
// ============================================================================

/**
 * Get context events for a session
 *
 * @param sessionId - Session ID
 * @param options - Filter options
 * @returns Array of context events
 */
export function getContextEvents(
  sessionId: string,
  options: {
    type?: ContextEventType;
    since?: Date;
    limit?: number;
  } = {}
): ContextEvent[] {
  const events = eventStore.get(sessionId) || [];
  let filtered = [...events];

  if (options.type) {
    filtered = filtered.filter((e) => e.type === options.type);
  }

  if (options.since !== undefined) {
    const sinceDate = options.since;
    filtered = filtered.filter((e) => e.timestamp >= sinceDate);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

/**
 * Get context snapshots for a session
 *
 * @param sessionId - Session ID
 * @param options - Filter options
 * @returns Array of quality snapshots
 */
export function getContextSnapshots(
  sessionId: string,
  options: {
    since?: Date;
    limit?: number;
  } = {}
): ContextQualitySnapshot[] {
  const snapshots = snapshotStore.get(sessionId) || [];
  let filtered = [...snapshots];

  if (options.since !== undefined) {
    const sinceDate = options.since;
    filtered = filtered.filter((s) => s.timestamp >= sinceDate);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

/**
 * Get aggregated metrics for a session
 *
 * @param sessionId - Session ID
 * @param options - Aggregation options
 * @returns Aggregated metrics
 */
export function getAggregatedMetrics(
  sessionId: string,
  options: {
    since?: Date;
  } = {}
): AggregatedContextMetrics | null {
  const events = getContextEvents(sessionId, { since: options.since });
  const snapshots = getContextSnapshots(sessionId, { since: options.since });

  if (events.length === 0 && snapshots.length === 0) {
    return null;
  }

  const contextBuilds = events.filter((e) => e.type === 'context_built').length;

  // Calculate averages from snapshots
  const totalTokens = snapshots.reduce((sum, s) => sum + s.totalTokens, 0);
  const totalUtilization = snapshots.reduce(
    (sum, s) => sum + s.utilizationPercent,
    0
  );
  const totalExclusionRate = snapshots.reduce((sum, s) => sum + s.exclusionRate, 0);
  const totalRelevance = snapshots.reduce(
    (sum, s) => sum + s.averageRelevanceScore,
    0
  );
  const totalBuildTime = snapshots
    .filter((s) => s.buildDurationMs !== undefined)
    .reduce((sum, s) => sum + (s.buildDurationMs || 0), 0);
  const totalRerankTime = snapshots
    .filter((s) => s.rerankDurationMs !== undefined)
    .reduce((sum, s) => sum + (s.rerankDurationMs || 0), 0);

  const snapshotCount = snapshots.length || 1; // Avoid division by zero
  const buildTimeCount =
    snapshots.filter((s) => s.buildDurationMs !== undefined).length || 1;
  const rerankTimeCount =
    snapshots.filter((s) => s.rerankDurationMs !== undefined).length || 1;

  // Utilization distribution
  const utilizationDist = {
    low: 0,
    optimal: 0,
    high: 0,
    critical: 0
  };

  for (const snapshot of snapshots) {
    const util = snapshot.utilizationPercent;
    if (util < 30) utilizationDist.low++;
    else if (util < 80) utilizationDist.optimal++;
    else if (util < 95) utilizationDist.high++;
    else utilizationDist.critical++;
  }

  // Strategy usage
  const strategyUsage: Record<string, number> = {};
  for (const snapshot of snapshots) {
    strategyUsage[snapshot.strategy] = (strategyUsage[snapshot.strategy] || 0) + 1;
  }

  // Total items excluded
  const totalItemsExcluded = snapshots.reduce(
    (sum, s) => sum + s.itemsExcluded,
    0
  );

  const period = {
    start: events.length > 0 ? events[0].timestamp : new Date(),
    end: events.length > 0 ? events[events.length - 1].timestamp : new Date()
  };

  return {
    sessionId,
    period,
    totalEvents: events.length,
    contextBuilds,
    averageTokens: totalTokens / snapshotCount,
    averageUtilization: totalUtilization / snapshotCount,
    utilizationDistribution: utilizationDist,
    averageExclusionRate: totalExclusionRate / snapshotCount,
    totalItemsExcluded,
    averageRelevanceScore: totalRelevance / snapshotCount,
    strategyUsage: strategyUsage as Record<ContextStrategy, number>,
    averageBuildTimeMs: totalBuildTime / buildTimeCount,
    averageRerankTimeMs: totalRerankTime / rerankTimeCount,
    latestSnapshot: snapshots[snapshots.length - 1]
  };
}

/**
 * Get latest context snapshot for a session
 */
export function getLatestSnapshot(
  sessionId: string
): ContextQualitySnapshot | null {
  const snapshots = snapshotStore.get(sessionId);
  return snapshots && snapshots.length > 0
    ? snapshots[snapshots.length - 1]
    : null;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clear metrics for a session
 */
export function clearSessionMetrics(sessionId: string): void {
  eventStore.delete(sessionId);
  snapshotStore.delete(sessionId);

  contextLogger.debug('Session metrics cleared', { sessionId });
}

/**
 * Clear all metrics
 */
export function clearAllMetrics(): void {
  eventStore.clear();
  snapshotStore.clear();

  contextLogger.debug('All metrics cleared');
}

/**
 * Get all session IDs with metrics
 */
export function getAllSessionIds(): string[] {
  const sessionIds = new Set<string>();

  // Convert Map keys to array first to avoid iterator issues
  const eventStoreKeys = Array.from(eventStore.keys());
  const snapshotStoreKeys = Array.from(snapshotStore.keys());

  for (const sessionId of eventStoreKeys) {
    sessionIds.add(sessionId);
  }

  for (const sessionId of snapshotStoreKeys) {
    sessionIds.add(sessionId);
  }

  return Array.from(sessionIds);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Export metrics for analysis or persistence
 */
export function exportMetrics(
  sessionId: string
): {
  events: ContextEvent[];
  snapshots: ContextQualitySnapshot[];
  aggregated: AggregatedContextMetrics | null;
} {
  return {
    events: getContextEvents(sessionId),
    snapshots: getContextSnapshots(sessionId),
    aggregated: getAggregatedMetrics(sessionId)
  };
}

/**
 * Get metrics summary for all sessions
 */
export function getGlobalMetricsSummary(): {
  totalSessions: number;
  totalEvents: number;
  totalSnapshots: number;
  sessions: Array<{
    sessionId: string;
    eventCount: number;
    snapshotCount: number;
    latestActivity: Date | null;
  }>;
} {
  const sessionIds = getAllSessionIds();
  const sessions = sessionIds.map((sessionId) => {
    const events = eventStore.get(sessionId) || [];
    const snapshots = snapshotStore.get(sessionId) || [];

    const latestEventTime =
      events.length > 0 ? events[events.length - 1].timestamp : null;
    const latestSnapshotTime =
      snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : null;

    let latestActivity: Date | null = null;
    if (latestEventTime && latestSnapshotTime) {
      latestActivity =
        latestEventTime > latestSnapshotTime ? latestEventTime : latestSnapshotTime;
    } else {
      latestActivity = latestEventTime || latestSnapshotTime;
    }

    return {
      sessionId,
      eventCount: events.length,
      snapshotCount: snapshots.length,
      latestActivity
    };
  });

  const totalEvents = sessions.reduce((sum, s) => sum + s.eventCount, 0);
  const totalSnapshots = sessions.reduce((sum, s) => sum + s.snapshotCount, 0);

  return {
    totalSessions: sessionIds.length,
    totalEvents,
    totalSnapshots,
    sessions
  };
}
