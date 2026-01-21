/**
 * Bead Sync Schema - Issue #907
 * Cross-rig bead synchronization data structures
 */

export interface BeadRecord {
  id: string;
  contentHash: string;
  version: number;
  createdAt: Date;
  syncedAt: Date | null;
  rigId: string;
  status: 'pending' | 'synced' | 'conflict' | 'failed';
}

export interface SyncProtocol {
  sourceRig: string;
  targetRig: string;
  beadIds: string[];
  timestamp: Date;
  checksum: string;
}

export interface ConflictResolution {
  beadId: string;
  localVersion: number;
  remoteVersion: number;
  resolution: 'local' | 'remote' | 'merge';
  resolvedAt: Date;
}

export type SyncStatus = 'idle' | 'syncing' | 'error';

/**
 * Agent State Persistence - Issue #898
 * Bead-based agent state for persistence and recovery
 */

export interface AgentState {
  agentId: string;
  beadId: string;
  checkpoint: AgentCheckpoint;
  memorySnapshot: MemorySnapshot;
  taskQueue: QueuedTask[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCheckpoint {
  id: string;
  agentId: string;
  version: number;
  state: Record<string, unknown>;
  context: AgentContext;
  timestamp: Date;
}

export interface AgentContext {
  conversationId?: string;
  parentTaskId?: string;
  capabilities: string[];
  activeTools: string[];
  metadata: Record<string, unknown>;
}

export interface MemorySnapshot {
  shortTerm: Record<string, unknown>;
  workingMemory: Record<string, unknown>;
  persistentKeys: string[];
  totalSize: number;
}

export interface QueuedTask {
  id: string;
  type: string;
  priority: number;
  payload: unknown;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Create a new agent state bead
 */
export function createAgentState(agentId: string): AgentState {
  return {
    agentId,
    beadId: `bead-${agentId}-${Date.now()}`,
    checkpoint: {
      id: `checkpoint-${Date.now()}`,
      agentId,
      version: 1,
      state: {},
      context: {
        capabilities: [],
        activeTools: [],
        metadata: {},
      },
      timestamp: new Date(),
    },
    memorySnapshot: {
      shortTerm: {},
      workingMemory: {},
      persistentKeys: [],
      totalSize: 0,
    },
    taskQueue: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a checkpoint from current agent state
 */
export function createCheckpoint(
  agentId: string,
  state: Record<string, unknown>,
  context: Partial<AgentContext> = {}
): AgentCheckpoint {
  return {
    id: `checkpoint-${agentId}-${Date.now()}`,
    agentId,
    version: 1,
    state,
    context: {
      capabilities: context.capabilities || [],
      activeTools: context.activeTools || [],
      metadata: context.metadata || {},
      ...context,
    },
    timestamp: new Date(),
  };
}
