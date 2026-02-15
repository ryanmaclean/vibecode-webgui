/**
 * Workflow Rollback Manager
 * Manages checkpoints and state rollback for workflow executions
 *
 * Features:
 * - Checkpoint creation and storage
 * - State restoration from checkpoints
 * - Checkpoint validation and verification
 * - Efficient checkpoint management
 */

import {
  Checkpoint,
  WorkflowContext,
  WorkflowExecution,
  NodeExecution,
} from './types';

// ============================================================================
// Rollback Manager Options
// ============================================================================

export interface RollbackManagerOptions {
  /** Maximum number of checkpoints to retain per execution */
  maxCheckpoints?: number;

  /** Enable automatic checkpoint compression */
  enableCompression?: boolean;

  /** Checkpoint retention duration in milliseconds */
  retentionDuration?: number;
}

export interface RollbackResult {
  /** Whether rollback was successful */
  success: boolean;

  /** Checkpoint that was restored */
  checkpoint: Checkpoint;

  /** Previous execution state (before rollback) */
  previousState: WorkflowExecutionState;

  /** Number of nodes affected by rollback */
  nodesAffected: number;

  /** Rollback timestamp */
  timestamp: Date;
}

export interface WorkflowExecutionState {
  /** Execution context snapshot */
  context: WorkflowContext;

  /** Node execution states */
  nodeStates: Map<string, NodeExecution>;

  /** Completed node IDs */
  completedNodes: string[];
}

// ============================================================================
// Checkpoint Validation
// ============================================================================

/**
 * Validate checkpoint structure and content
 */
function validateCheckpoint(checkpoint: Checkpoint): void {
  if (!checkpoint.id) {
    throw new Error('Checkpoint must have an ID');
  }

  if (!checkpoint.timestamp) {
    throw new Error('Checkpoint must have a timestamp');
  }

  if (!Array.isArray(checkpoint.completedNodes)) {
    throw new Error('Checkpoint must have completedNodes array');
  }

  if (!checkpoint.context) {
    throw new Error('Checkpoint must have a context');
  }

  // Validate context structure
  if (!checkpoint.context.input || typeof checkpoint.context.input !== 'object') {
    throw new Error('Checkpoint context must have valid input object');
  }

  if (!checkpoint.context.nodes || typeof checkpoint.context.nodes !== 'object') {
    throw new Error('Checkpoint context must have valid nodes object');
  }

  if (!checkpoint.context.globals || typeof checkpoint.context.globals !== 'object') {
    throw new Error('Checkpoint context must have valid globals object');
  }

  if (!checkpoint.context.loops || typeof checkpoint.context.loops !== 'object') {
    throw new Error('Checkpoint context must have valid loops object');
  }
}

/**
 * Deep clone workflow context to prevent mutations
 */
function cloneContext(context: WorkflowContext): WorkflowContext {
  return {
    input: JSON.parse(JSON.stringify(context.input)),
    nodes: JSON.parse(JSON.stringify(context.nodes)),
    globals: JSON.parse(JSON.stringify(context.globals)),
    loops: JSON.parse(JSON.stringify(context.loops)),
  };
}

/**
 * Deep clone node execution state
 */
function cloneNodeExecution(nodeExec: NodeExecution): NodeExecution {
  return {
    nodeId: nodeExec.nodeId,
    status: nodeExec.status,
    startedAt: nodeExec.startedAt ? new Date(nodeExec.startedAt) : undefined,
    completedAt: nodeExec.completedAt ? new Date(nodeExec.completedAt) : undefined,
    duration: nodeExec.duration,
    input: nodeExec.input ? JSON.parse(JSON.stringify(nodeExec.input)) : undefined,
    output: nodeExec.output ? JSON.parse(JSON.stringify(nodeExec.output)) : undefined,
    error: nodeExec.error ? { ...nodeExec.error } : undefined,
    retryCount: nodeExec.retryCount,
    logs: [...nodeExec.logs],
  };
}

// ============================================================================
// Rollback Manager
// ============================================================================

export class RollbackManager {
  private checkpoints = new Map<string, Checkpoint[]>();
  private options: Required<RollbackManagerOptions>;

  constructor(options: RollbackManagerOptions = {}) {
    this.options = {
      maxCheckpoints: options.maxCheckpoints || 50,
      enableCompression: options.enableCompression ?? false,
      retentionDuration: options.retentionDuration || 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  /**
   * Create a checkpoint for the current execution state
   */
  createCheckpoint(
    executionId: string,
    execution: WorkflowExecution,
    metadata?: Record<string, unknown>
  ): Checkpoint {
    // Generate checkpoint ID
    const checkpointId = this.generateCheckpointId(executionId);

    // Extract completed nodes
    const completedNodes: string[] = [];
    for (const [nodeId, nodeExec] of execution.nodes.entries()) {
      if (nodeExec.status === 'completed') {
        completedNodes.push(nodeId);
      }
    }

    // Create checkpoint with cloned context
    const checkpoint: Checkpoint = {
      id: checkpointId,
      timestamp: new Date(),
      completedNodes,
      context: cloneContext(execution.context),
      metadata: metadata ? { ...metadata } : undefined,
    };

    // Validate checkpoint
    validateCheckpoint(checkpoint);

    // Store checkpoint
    this.storeCheckpoint(executionId, checkpoint);

    return checkpoint;
  }

  /**
   * Store checkpoint and manage retention
   */
  private storeCheckpoint(executionId: string, checkpoint: Checkpoint): void {
    let checkpoints = this.checkpoints.get(executionId);

    if (!checkpoints) {
      checkpoints = [];
      this.checkpoints.set(executionId, checkpoints);
    }

    // Add new checkpoint
    checkpoints.push(checkpoint);

    // Sort by timestamp (newest first)
    checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Enforce max checkpoints limit
    if (checkpoints.length > this.options.maxCheckpoints) {
      checkpoints.splice(this.options.maxCheckpoints);
    }

    // Clean up expired checkpoints
    this.cleanupExpiredCheckpoints(executionId);
  }

  /**
   * Rollback execution to a specific checkpoint
   */
  rollback(
    executionId: string,
    checkpointId: string,
    execution: WorkflowExecution
  ): RollbackResult {
    const checkpoint = this.getCheckpoint(executionId, checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Validate checkpoint before rollback
    validateCheckpoint(checkpoint);

    // Capture current state before rollback
    const previousState = this.captureExecutionState(execution);

    // Restore context from checkpoint
    execution.context = cloneContext(checkpoint.context);

    // Reset node executions to checkpoint state
    const nodesAffected = this.restoreNodeStates(execution, checkpoint);

    return {
      success: true,
      checkpoint,
      previousState,
      nodesAffected,
      timestamp: new Date(),
    };
  }

  /**
   * Capture current execution state
   */
  private captureExecutionState(execution: WorkflowExecution): WorkflowExecutionState {
    const completedNodes: string[] = [];
    const nodeStates = new Map<string, NodeExecution>();

    for (const [nodeId, nodeExec] of execution.nodes.entries()) {
      nodeStates.set(nodeId, cloneNodeExecution(nodeExec));
      if (nodeExec.status === 'completed') {
        completedNodes.push(nodeId);
      }
    }

    return {
      context: cloneContext(execution.context),
      nodeStates,
      completedNodes,
    };
  }

  /**
   * Restore node execution states from checkpoint
   */
  private restoreNodeStates(execution: WorkflowExecution, checkpoint: Checkpoint): number {
    let nodesAffected = 0;

    for (const [nodeId, nodeExec] of execution.nodes.entries()) {
      const wasCompleted = checkpoint.completedNodes.includes(nodeId);

      if (wasCompleted && nodeExec.status !== 'completed') {
        // Node was completed in checkpoint but not in current state
        // This shouldn't happen in normal rollback, but handle it
        nodesAffected++;
      } else if (!wasCompleted && nodeExec.status === 'completed') {
        // Node is completed now but wasn't in checkpoint - reset it
        nodeExec.status = 'pending';
        nodeExec.output = undefined;
        nodeExec.completedAt = undefined;
        nodeExec.duration = undefined;
        nodeExec.error = undefined;
        nodesAffected++;
      }
    }

    return nodesAffected;
  }

  /**
   * Get a specific checkpoint
   */
  getCheckpoint(executionId: string, checkpointId: string): Checkpoint | undefined {
    const checkpoints = this.checkpoints.get(executionId);
    if (!checkpoints) return undefined;

    return checkpoints.find(cp => cp.id === checkpointId);
  }

  /**
   * Get all checkpoints for an execution
   */
  getCheckpoints(executionId: string): Checkpoint[] {
    return this.checkpoints.get(executionId) || [];
  }

  /**
   * Get the latest checkpoint for an execution
   */
  getLatestCheckpoint(executionId: string): Checkpoint | undefined {
    const checkpoints = this.checkpoints.get(executionId);
    if (!checkpoints || checkpoints.length === 0) return undefined;

    return checkpoints[0]; // Already sorted by timestamp descending
  }

  /**
   * Delete a specific checkpoint
   */
  deleteCheckpoint(executionId: string, checkpointId: string): boolean {
    const checkpoints = this.checkpoints.get(executionId);
    if (!checkpoints) return false;

    const index = checkpoints.findIndex(cp => cp.id === checkpointId);
    if (index === -1) return false;

    checkpoints.splice(index, 1);
    return true;
  }

  /**
   * Delete all checkpoints for an execution
   */
  deleteAllCheckpoints(executionId: string): number {
    const checkpoints = this.checkpoints.get(executionId);
    if (!checkpoints) return 0;

    const count = checkpoints.length;
    this.checkpoints.delete(executionId);
    return count;
  }

  /**
   * Clean up expired checkpoints based on retention duration
   */
  private cleanupExpiredCheckpoints(executionId: string): void {
    const checkpoints = this.checkpoints.get(executionId);
    if (!checkpoints) return;

    const now = Date.now();
    const retentionThreshold = now - this.options.retentionDuration;

    const validCheckpoints = checkpoints.filter(cp => {
      return cp.timestamp.getTime() >= retentionThreshold;
    });

    if (validCheckpoints.length !== checkpoints.length) {
      this.checkpoints.set(executionId, validCheckpoints);
    }
  }

  /**
   * Clean up all expired checkpoints across all executions
   */
  cleanupAllExpiredCheckpoints(): number {
    let totalCleaned = 0;

    for (const executionId of this.checkpoints.keys()) {
      const beforeCount = this.checkpoints.get(executionId)?.length || 0;
      this.cleanupExpiredCheckpoints(executionId);
      const afterCount = this.checkpoints.get(executionId)?.length || 0;
      totalCleaned += beforeCount - afterCount;
    }

    return totalCleaned;
  }

  /**
   * Get checkpoint statistics for an execution
   */
  getCheckpointStats(executionId: string): {
    total: number;
    oldest?: Date;
    newest?: Date;
    totalSize: number;
  } {
    const checkpoints = this.checkpoints.get(executionId) || [];

    if (checkpoints.length === 0) {
      return { total: 0, totalSize: 0 };
    }

    const timestamps = checkpoints.map(cp => cp.timestamp.getTime());
    const oldest = new Date(Math.min(...timestamps));
    const newest = new Date(Math.max(...timestamps));

    // Estimate total size (rough approximation)
    const totalSize = checkpoints.reduce((sum, cp) => {
      return sum + JSON.stringify(cp).length;
    }, 0);

    return {
      total: checkpoints.length,
      oldest,
      newest,
      totalSize,
    };
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateCheckpointId(executionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `cp-${executionId}-${timestamp}-${random}`;
  }

  /**
   * Verify checkpoint integrity
   */
  verifyCheckpoint(checkpoint: Checkpoint): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      validateCheckpoint(checkpoint);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    }

    // Additional integrity checks
    if (checkpoint.completedNodes.length === 0 &&
        Object.keys(checkpoint.context.nodes).length > 0) {
      errors.push('Checkpoint has node outputs but no completed nodes');
    }

    // Check for duplicate node IDs
    const uniqueNodes = new Set(checkpoint.completedNodes);
    if (uniqueNodes.size !== checkpoint.completedNodes.length) {
      errors.push('Checkpoint has duplicate completed node IDs');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Compare two checkpoints and return differences
   */
  compareCheckpoints(
    checkpoint1: Checkpoint,
    checkpoint2: Checkpoint
  ): {
    addedNodes: string[];
    removedNodes: string[];
    contextChanges: {
      input: boolean;
      nodes: string[];
      globals: string[];
      loops: string[];
    };
  } {
    const nodes1 = new Set(checkpoint1.completedNodes);
    const nodes2 = new Set(checkpoint2.completedNodes);

    const addedNodes = checkpoint2.completedNodes.filter(id => !nodes1.has(id));
    const removedNodes = checkpoint1.completedNodes.filter(id => !nodes2.has(id));

    // Check context changes
    const inputChanged = JSON.stringify(checkpoint1.context.input) !==
                        JSON.stringify(checkpoint2.context.input);

    const nodesChanged = Object.keys(checkpoint1.context.nodes)
      .concat(Object.keys(checkpoint2.context.nodes))
      .filter(id => {
        return JSON.stringify(checkpoint1.context.nodes[id]) !==
               JSON.stringify(checkpoint2.context.nodes[id]);
      });

    const globalsChanged = Object.keys(checkpoint1.context.globals)
      .concat(Object.keys(checkpoint2.context.globals))
      .filter(id => {
        return JSON.stringify(checkpoint1.context.globals[id]) !==
               JSON.stringify(checkpoint2.context.globals[id]);
      });

    const loopsChanged = Object.keys(checkpoint1.context.loops)
      .concat(Object.keys(checkpoint2.context.loops))
      .filter(id => {
        return JSON.stringify(checkpoint1.context.loops[id]) !==
               JSON.stringify(checkpoint2.context.loops[id]);
      });

    return {
      addedNodes,
      removedNodes,
      contextChanges: {
        input: inputChanged,
        nodes: Array.from(new Set(nodesChanged)),
        globals: Array.from(new Set(globalsChanged)),
        loops: Array.from(new Set(loopsChanged)),
      },
    };
  }
}

/**
 * Create rollback manager instance
 */
export function createRollbackManager(options?: RollbackManagerOptions): RollbackManager {
  return new RollbackManager(options);
}
