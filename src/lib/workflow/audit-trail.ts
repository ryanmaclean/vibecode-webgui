/**
 * Workflow Audit Trail System
 * Comprehensive logging and tracking of all workflow actions and state changes
 *
 * Features:
 * - Complete audit history for compliance and debugging
 * - Queryable audit logs with filtering and pagination
 * - Integration with workflow events
 * - Structured audit entries with metadata
 */

import {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowExecution,
  NodeExecution,
  WorkflowContext,
} from './types';

// ============================================================================
// Audit Trail Types
// ============================================================================

/**
 * Audit action categories
 */
export enum AuditActionType {
  // Workflow lifecycle
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',
  WORKFLOW_PAUSED = 'workflow.paused',
  WORKFLOW_RESUMED = 'workflow.resumed',

  // Node lifecycle
  NODE_STARTED = 'node.started',
  NODE_COMPLETED = 'node.completed',
  NODE_FAILED = 'node.failed',
  NODE_SKIPPED = 'node.skipped',
  NODE_RETRYING = 'node.retrying',

  // Context changes
  CONTEXT_UPDATED = 'context.updated',
  CONTEXT_VARIABLE_SET = 'context.variable.set',
  CONTEXT_VARIABLE_DELETED = 'context.variable.deleted',

  // Checkpoints
  CHECKPOINT_CREATED = 'checkpoint.created',
  CHECKPOINT_RESTORED = 'checkpoint.restored',

  // Configuration
  CONFIG_UPDATED = 'config.updated',
  AGENT_REGISTERED = 'agent.registered',

  // Custom actions
  CUSTOM = 'custom',
}

/**
 * Audit severity levels
 */
export enum AuditSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Individual audit trail entry
 */
export interface AuditEntry {
  /** Unique entry ID */
  id: string;

  /** Timestamp of the action */
  timestamp: Date;

  /** Action type */
  action: AuditActionType;

  /** Severity level */
  severity: AuditSeverity;

  /** Execution ID (if applicable) */
  executionId?: string;

  /** Workflow ID (if applicable) */
  workflowId?: string;

  /** Node ID (if applicable) */
  nodeId?: string;

  /** User or system that triggered the action */
  actor?: string;

  /** Human-readable description */
  description: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Related entry IDs (for tracing) */
  relatedEntries?: string[];

  /** Duration (ms) for timed actions */
  duration?: number;

  /** Changes made (before/after snapshots) */
  changes?: AuditChange[];
}

/**
 * Audit change record (before/after tracking)
 */
export interface AuditChange {
  /** Field or property that changed */
  field: string;

  /** Value before change */
  before?: unknown;

  /** Value after change */
  after?: unknown;

  /** Change operation */
  operation: 'create' | 'update' | 'delete';
}

/**
 * Query filter for audit entries
 */
export interface AuditQuery {
  /** Filter by execution ID */
  executionId?: string;

  /** Filter by workflow ID */
  workflowId?: string;

  /** Filter by node ID */
  nodeId?: string;

  /** Filter by action types */
  actions?: AuditActionType[];

  /** Filter by severity levels */
  severities?: AuditSeverity[];

  /** Filter by date range */
  startDate?: Date;
  endDate?: Date;

  /** Filter by actor */
  actor?: string;

  /** Search in descriptions */
  searchText?: string;

  /** Pagination */
  limit?: number;
  offset?: number;

  /** Sort order */
  sortBy?: 'timestamp' | 'severity' | 'action';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Audit query result
 */
export interface AuditQueryResult {
  /** Matching entries */
  entries: AuditEntry[];

  /** Total count (before pagination) */
  totalCount: number;

  /** Query metadata */
  metadata: {
    executedAt: Date;
    duration: number;
    query: AuditQuery;
  };
}

/**
 * Audit trail statistics
 */
export interface AuditStatistics {
  /** Total entries */
  totalEntries: number;

  /** Entries by action type */
  byAction: Record<AuditActionType, number>;

  /** Entries by severity */
  bySeverity: Record<AuditSeverity, number>;

  /** Date range */
  dateRange: {
    earliest: Date;
    latest: Date;
  };

  /** Most active workflows */
  topWorkflows: Array<{ workflowId: string; count: number }>;

  /** Most active actors */
  topActors: Array<{ actor: string; count: number }>;
}

// ============================================================================
// Audit Trail Manager
// ============================================================================

/**
 * Manages audit trail entries for workflow execution tracking
 */
export class AuditTrail {
  private entries: AuditEntry[] = [];
  private entryIndex = new Map<string, AuditEntry>();
  private executionIndex = new Map<string, Set<string>>();
  private workflowIndex = new Map<string, Set<string>>();
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Record a new audit entry
   */
  record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const auditEntry: AuditEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      ...entry,
    };

    // Add to main storage
    this.entries.push(auditEntry);
    this.entryIndex.set(auditEntry.id, auditEntry);

    // Update indices for fast querying
    if (auditEntry.executionId) {
      if (!this.executionIndex.has(auditEntry.executionId)) {
        this.executionIndex.set(auditEntry.executionId, new Set());
      }
      this.executionIndex.get(auditEntry.executionId)!.add(auditEntry.id);
    }

    if (auditEntry.workflowId) {
      if (!this.workflowIndex.has(auditEntry.workflowId)) {
        this.workflowIndex.set(auditEntry.workflowId, new Set());
      }
      this.workflowIndex.get(auditEntry.workflowId)!.add(auditEntry.id);
    }

    // Enforce max entries limit (FIFO)
    if (this.entries.length > this.maxEntries) {
      this.pruneOldEntries();
    }

    return auditEntry;
  }

  /**
   * Record workflow event as audit entry
   */
  recordWorkflowEvent(event: WorkflowEvent, workflowId?: string, actor?: string): AuditEntry {
    const actionMap: Record<WorkflowEventType, AuditActionType> = {
      [WorkflowEventType.WORKFLOW_STARTED]: AuditActionType.WORKFLOW_STARTED,
      [WorkflowEventType.WORKFLOW_COMPLETED]: AuditActionType.WORKFLOW_COMPLETED,
      [WorkflowEventType.WORKFLOW_FAILED]: AuditActionType.WORKFLOW_FAILED,
      [WorkflowEventType.WORKFLOW_CANCELLED]: AuditActionType.WORKFLOW_CANCELLED,
      [WorkflowEventType.WORKFLOW_PAUSED]: AuditActionType.WORKFLOW_PAUSED,
      [WorkflowEventType.WORKFLOW_RESUMED]: AuditActionType.WORKFLOW_RESUMED,
      [WorkflowEventType.NODE_STARTED]: AuditActionType.NODE_STARTED,
      [WorkflowEventType.NODE_COMPLETED]: AuditActionType.NODE_COMPLETED,
      [WorkflowEventType.NODE_FAILED]: AuditActionType.NODE_FAILED,
      [WorkflowEventType.NODE_SKIPPED]: AuditActionType.NODE_SKIPPED,
      [WorkflowEventType.NODE_RETRYING]: AuditActionType.NODE_RETRYING,
      [WorkflowEventType.CHECKPOINT_CREATED]: AuditActionType.CHECKPOINT_CREATED,
    };

    const action = actionMap[event.type] || AuditActionType.CUSTOM;
    const severity = this.determineSeverity(event.type);

    return this.record({
      action,
      severity,
      executionId: event.executionId,
      workflowId,
      nodeId: event.nodeId,
      actor,
      description: this.generateDescription(event),
      metadata: typeof event.data === 'object' && event.data !== null ? event.data as Record<string, unknown> : { data: event.data },
    });
  }

  /**
   * Record context change
   */
  recordContextChange(
    executionId: string,
    workflowId: string,
    field: string,
    before: unknown,
    after: unknown,
    actor?: string
  ): AuditEntry {
    return this.record({
      action: AuditActionType.CONTEXT_UPDATED,
      severity: AuditSeverity.DEBUG,
      executionId,
      workflowId,
      actor,
      description: `Context field '${field}' updated`,
      changes: [
        {
          field,
          before,
          after,
          operation: before === undefined ? 'create' : after === undefined ? 'delete' : 'update',
        },
      ],
    });
  }

  /**
   * Query audit entries
   */
  query(filter: AuditQuery = {}): AuditQueryResult {
    const startTime = Date.now();
    let results = [...this.entries];

    // Apply filters
    if (filter.executionId) {
      const entryIds = this.executionIndex.get(filter.executionId);
      if (entryIds) {
        results = results.filter(e => entryIds.has(e.id));
      } else {
        results = [];
      }
    }

    if (filter.workflowId) {
      const entryIds = this.workflowIndex.get(filter.workflowId);
      if (entryIds) {
        results = results.filter(e => entryIds.has(e.id));
      } else {
        results = [];
      }
    }

    if (filter.nodeId) {
      results = results.filter(e => e.nodeId === filter.nodeId);
    }

    if (filter.actions && filter.actions.length > 0) {
      const actionSet = new Set(filter.actions);
      results = results.filter(e => actionSet.has(e.action));
    }

    if (filter.severities && filter.severities.length > 0) {
      const severitySet = new Set(filter.severities);
      results = results.filter(e => severitySet.has(e.severity));
    }

    if (filter.startDate) {
      results = results.filter(e => e.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      results = results.filter(e => e.timestamp <= filter.endDate!);
    }

    if (filter.actor) {
      results = results.filter(e => e.actor === filter.actor);
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      results = results.filter(e => e.description.toLowerCase().includes(searchLower));
    }

    const totalCount = results.length;

    // Sort results
    const sortBy = filter.sortBy || 'timestamp';
    const sortOrder = filter.sortOrder || 'desc';

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'severity':
          const severityOrder = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'action':
          comparison = a.action.localeCompare(b.action);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || results.length;
    results = results.slice(offset, offset + limit);

    return {
      entries: results,
      totalCount,
      metadata: {
        executedAt: new Date(),
        duration: Date.now() - startTime,
        query: filter,
      },
    };
  }

  /**
   * Get audit entry by ID
   */
  getEntry(entryId: string): AuditEntry | undefined {
    return this.entryIndex.get(entryId);
  }

  /**
   * Get all entries for an execution
   */
  getExecutionAudit(executionId: string): AuditEntry[] {
    const entryIds = this.executionIndex.get(executionId);
    if (!entryIds) return [];

    return Array.from(entryIds)
      .map(id => this.entryIndex.get(id))
      .filter((entry): entry is AuditEntry => entry !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get all entries for a workflow
   */
  getWorkflowAudit(workflowId: string): AuditEntry[] {
    const entryIds = this.workflowIndex.get(workflowId);
    if (!entryIds) return [];

    return Array.from(entryIds)
      .map(id => this.entryIndex.get(id))
      .filter((entry): entry is AuditEntry => entry !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get audit statistics
   */
  getStatistics(): AuditStatistics {
    const byAction = {} as Record<AuditActionType, number>;
    const bySeverity = {} as Record<AuditSeverity, number>;
    const workflowCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();

    let earliest = new Date();
    let latest = new Date(0);

    for (const entry of this.entries) {
      // Count by action
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;

      // Count by severity
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;

      // Track workflows
      if (entry.workflowId) {
        workflowCounts.set(entry.workflowId, (workflowCounts.get(entry.workflowId) || 0) + 1);
      }

      // Track actors
      if (entry.actor) {
        actorCounts.set(entry.actor, (actorCounts.get(entry.actor) || 0) + 1);
      }

      // Track date range
      if (entry.timestamp < earliest) earliest = entry.timestamp;
      if (entry.timestamp > latest) latest = entry.timestamp;
    }

    // Get top workflows
    const topWorkflows = Array.from(workflowCounts.entries())
      .map(([workflowId, count]) => ({ workflowId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top actors
    const topActors = Array.from(actorCounts.entries())
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries: this.entries.length,
      byAction,
      bySeverity,
      dateRange: { earliest, latest },
      topWorkflows,
      topActors,
    };
  }

  /**
   * Clear all audit entries
   */
  clear(): void {
    this.entries = [];
    this.entryIndex.clear();
    this.executionIndex.clear();
    this.workflowIndex.clear();
  }

  /**
   * Export audit trail to JSON
   */
  export(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * Import audit trail from JSON
   */
  import(entries: AuditEntry[]): void {
    for (const entry of entries) {
      // Restore entry
      this.entries.push(entry);
      this.entryIndex.set(entry.id, entry);

      // Restore indices
      if (entry.executionId) {
        if (!this.executionIndex.has(entry.executionId)) {
          this.executionIndex.set(entry.executionId, new Set());
        }
        this.executionIndex.get(entry.executionId)!.add(entry.id);
      }

      if (entry.workflowId) {
        if (!this.workflowIndex.has(entry.workflowId)) {
          this.workflowIndex.set(entry.workflowId, new Set());
        }
        this.workflowIndex.get(entry.workflowId)!.add(entry.id);
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate unique entry ID
   */
  private generateEntryId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine severity from event type
   */
  private determineSeverity(eventType: WorkflowEventType): AuditSeverity {
    switch (eventType) {
      case WorkflowEventType.WORKFLOW_FAILED:
      case WorkflowEventType.NODE_FAILED:
        return AuditSeverity.ERROR;

      case WorkflowEventType.WORKFLOW_CANCELLED:
        return AuditSeverity.WARN;

      case WorkflowEventType.NODE_RETRYING:
        return AuditSeverity.WARN;

      case WorkflowEventType.WORKFLOW_COMPLETED:
      case WorkflowEventType.NODE_COMPLETED:
        return AuditSeverity.INFO;

      default:
        return AuditSeverity.DEBUG;
    }
  }

  /**
   * Generate human-readable description from event
   */
  private generateDescription(event: WorkflowEvent): string {
    const descriptions: Record<WorkflowEventType, string> = {
      [WorkflowEventType.WORKFLOW_STARTED]: 'Workflow execution started',
      [WorkflowEventType.WORKFLOW_COMPLETED]: 'Workflow execution completed successfully',
      [WorkflowEventType.WORKFLOW_FAILED]: 'Workflow execution failed',
      [WorkflowEventType.WORKFLOW_CANCELLED]: 'Workflow execution cancelled',
      [WorkflowEventType.WORKFLOW_PAUSED]: 'Workflow execution paused',
      [WorkflowEventType.WORKFLOW_RESUMED]: 'Workflow execution resumed',
      [WorkflowEventType.NODE_STARTED]: `Node execution started${event.nodeId ? `: ${event.nodeId}` : ''}`,
      [WorkflowEventType.NODE_COMPLETED]: `Node execution completed${event.nodeId ? `: ${event.nodeId}` : ''}`,
      [WorkflowEventType.NODE_FAILED]: `Node execution failed${event.nodeId ? `: ${event.nodeId}` : ''}`,
      [WorkflowEventType.NODE_SKIPPED]: `Node execution skipped${event.nodeId ? `: ${event.nodeId}` : ''}`,
      [WorkflowEventType.NODE_RETRYING]: `Node execution retrying${event.nodeId ? `: ${event.nodeId}` : ''}`,
      [WorkflowEventType.CHECKPOINT_CREATED]: 'Checkpoint created',
    };

    return descriptions[event.type] || `Workflow event: ${event.type}`;
  }

  /**
   * Prune old entries when max limit is reached
   */
  private pruneOldEntries(): void {
    const toRemove = this.entries.length - this.maxEntries;
    if (toRemove <= 0) return;

    const removedEntries = this.entries.splice(0, toRemove);

    for (const entry of removedEntries) {
      // Remove from index
      this.entryIndex.delete(entry.id);

      // Remove from execution index
      if (entry.executionId) {
        this.executionIndex.get(entry.executionId)?.delete(entry.id);
      }

      // Remove from workflow index
      if (entry.workflowId) {
        this.workflowIndex.get(entry.workflowId)?.delete(entry.id);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new audit trail instance
 */
export function createAuditTrail(maxEntries?: number): AuditTrail {
  return new AuditTrail(maxEntries);
}

/**
 * Create audit entry for workflow execution snapshot
 */
export function createExecutionSnapshot(
  execution: WorkflowExecution,
  description: string
): Omit<AuditEntry, 'id' | 'timestamp'> {
  return {
    action: AuditActionType.CUSTOM,
    severity: AuditSeverity.INFO,
    executionId: execution.id,
    workflowId: execution.workflowId,
    description,
    metadata: {
      status: execution.status,
      nodeCount: execution.nodes.size,
      completedNodes: Array.from(execution.nodes.values()).filter(n => n.status === 'completed').length,
      failedNodes: Array.from(execution.nodes.values()).filter(n => n.status === 'failed').length,
      duration: execution.metadata.duration,
    },
  };
}
