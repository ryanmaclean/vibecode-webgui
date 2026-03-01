/**
 * Agent Communication and Workflow Types for Multi-Agent Framework
 *
 * Type-safe definitions for agent-to-agent communication, task delegation,
 * workflow orchestration, and agent metadata. Supports multi-agent coordination
 * across different agent types (Aider, Goose, Cline, Continue, OpenAI Agents).
 *
 * @module types/shared/agent-communication
 */

import type { BaseEntity, Timestamp, OperationStatus, ApiError } from './common';

// ============================================================================
// Agent Types and Status
// ============================================================================

/**
 * Supported agent types in the multi-agent framework
 */
export type AgentType =
  | 'aider'
  | 'goose'
  | 'cline'
  | 'continue'
  | 'openai-assistant'
  | 'custom';

/**
 * Agent execution status
 */
export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'error';

/**
 * Agent capability flags
 */
export interface AgentCapabilities {
  /** Can read files */
  canReadFiles: boolean;

  /** Can write/modify files */
  canWriteFiles: boolean;

  /** Can execute commands */
  canExecuteCommands: boolean;

  /** Can use tools/functions */
  canUseTools: boolean;

  /** Can communicate with other agents */
  canCommunicate: boolean;

  /** Can delegate tasks to other agents */
  canDelegateTask: boolean;

  /** Supports streaming responses */
  supportsStreaming: boolean;

  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;
}

/**
 * Agent metadata and state
 */
export interface AgentMetadata extends BaseEntity {
  /** Agent type */
  type: AgentType;

  /** Agent display name */
  name: string;

  /** Agent description */
  description?: string;

  /** Current status */
  status: AgentStatus;

  /** Agent capabilities */
  capabilities: AgentCapabilities;

  /** Model being used */
  model: string;

  /** Workspace path */
  workspace?: string;

  /** Process ID (if applicable) */
  pid?: number;

  /** Terminal/session ID */
  terminalId?: string;

  /** Agent version */
  version?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** When agent was started */
  startedAt?: Timestamp;

  /** When agent was last active */
  lastActiveAt?: Timestamp;

  /** Uptime in seconds */
  uptimeSeconds?: number;
}

// ============================================================================
// Message Passing Types
// ============================================================================

/**
 * Message types for agent communication
 */
export type MessageType =
  | 'user'           // From user to agent
  | 'agent'          // From agent to user/system
  | 'system'         // System-level messages
  | 'tool'           // Tool/function call results
  | 'task'           // Task assignment
  | 'delegation'     // Task delegation between agents
  | 'notification'   // Status/progress notifications
  | 'error';         // Error messages

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Message status
 */
export type MessageStatus =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'acknowledged'
  | 'failed';

/**
 * Agent message structure
 */
export interface AgentMessage extends BaseEntity {
  /** Message type */
  type: MessageType;

  /** Sender agent ID (null for user messages) */
  senderId: string | null;

  /** Sender agent type (null for user messages) */
  senderType?: AgentType;

  /** Recipient agent ID (null for broadcast) */
  recipientId: string | null;

  /** Recipient agent type */
  recipientType?: AgentType;

  /** Message content */
  content: string;

  /** Message priority */
  priority: MessagePriority;

  /** Message status */
  status: MessageStatus;

  /** Thread ID for conversation grouping */
  threadId?: string;

  /** Parent message ID for replies */
  parentMessageId?: string;

  /** Structured data payload */
  payload?: Record<string, unknown>;

  /** Attachments (file IDs, URLs) */
  attachments?: MessageAttachment[];

  /** When message was read */
  readAt?: Timestamp | null;

  /** When message was acknowledged */
  acknowledgedAt?: Timestamp | null;

  /** Delivery attempt count */
  deliveryAttempts?: number;

  /** Error information if failed */
  error?: ApiError;
}

/**
 * Message attachment structure
 */
export interface MessageAttachment {
  /** Attachment ID */
  id: string;

  /** Attachment type */
  type: 'file' | 'image' | 'url' | 'data';

  /** Attachment name */
  name: string;

  /** File path or URL */
  url?: string;

  /** File ID reference */
  fileId?: string;

  /** MIME type */
  mimeType?: string;

  /** Size in bytes */
  size?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message thread for conversation grouping
 */
export interface MessageThread extends BaseEntity {
  /** Thread subject/title */
  subject: string;

  /** Participating agent IDs */
  participantIds: string[];

  /** Number of messages in thread */
  messageCount: number;

  /** Last message timestamp */
  lastMessageAt: Timestamp;

  /** Thread status */
  status: 'active' | 'archived' | 'closed';

  /** Thread metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Task Delegation Types
// ============================================================================

/**
 * Task status
 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rejected';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Agent task definition
 */
export interface AgentTask extends BaseEntity {
  /** Task title */
  title: string;

  /** Detailed task description */
  description: string;

  /** Task status */
  status: TaskStatus;

  /** Task priority */
  priority: TaskPriority;

  /** Assigned agent ID (null if unassigned) */
  assignedAgentId: string | null;

  /** Assigning agent ID (who delegated the task) */
  assigningAgentId?: string;

  /** Required agent capabilities */
  requiredCapabilities?: Partial<AgentCapabilities>;

  /** Workspace path */
  workspace?: string;

  /** Files involved in the task */
  files?: string[];

  /** Task inputs */
  inputs?: Record<string, unknown>;

  /** Task outputs/results */
  outputs?: Record<string, unknown>;

  /** Task dependencies (task IDs that must complete first) */
  dependencies?: string[];

  /** Child task IDs */
  childTasks?: string[];

  /** Parent task ID */
  parentTaskId?: string;

  /** Workflow ID this task belongs to */
  workflowId?: string;

  /** Task timeout in milliseconds */
  timeout?: number;

  /** When task was assigned */
  assignedAt?: Timestamp | null;

  /** When task was started */
  startedAt?: Timestamp | null;

  /** When task was completed */
  completedAt?: Timestamp | null;

  /** Task progress (0-100) */
  progress?: number;

  /** Error information if failed */
  error?: ApiError;

  /** Task-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task assignment request
 */
export interface TaskAssignmentRequest {
  /** Task to assign */
  task: Omit<AgentTask, keyof BaseEntity | 'status' | 'assignedAt' | 'startedAt' | 'completedAt'>;

  /** Preferred agent ID (optional) */
  preferredAgentId?: string;

  /** Preferred agent type */
  preferredAgentType?: AgentType;

  /** Whether to wait for acceptance */
  waitForAcceptance?: boolean;

  /** Assignment timeout in milliseconds */
  timeout?: number;
}

/**
 * Task assignment response
 */
export interface TaskAssignmentResponse {
  /** Assigned task */
  task: AgentTask;

  /** Whether assignment was accepted */
  accepted: boolean;

  /** Assigned agent metadata */
  agent: AgentMetadata;

  /** Estimated completion time */
  estimatedCompletionAt?: Timestamp;

  /** Assignment message */
  message?: string;
}

/**
 * Task delegation event
 */
export interface TaskDelegationEvent extends BaseEntity {
  /** Task ID */
  taskId: string;

  /** Event type */
  eventType:
    | 'task_created'
    | 'task_assigned'
    | 'task_accepted'
    | 'task_rejected'
    | 'task_started'
    | 'task_progress'
    | 'task_blocked'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled';

  /** Agent ID involved in the event */
  agentId: string;

  /** Event details */
  details?: Record<string, unknown>;

  /** Event timestamp */
  timestamp: Timestamp;
}

// ============================================================================
// Workflow Orchestration Types
// ============================================================================

/**
 * Workflow status
 */
export type WorkflowStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Workflow execution mode
 */
export type WorkflowExecutionMode =
  | 'sequential'  // Execute tasks one at a time
  | 'parallel'    // Execute all tasks concurrently
  | 'dag';        // Execute based on dependency graph

/**
 * Multi-agent workflow definition
 */
export interface AgentWorkflow extends BaseEntity {
  /** Workflow name */
  name: string;

  /** Workflow description */
  description?: string;

  /** Workflow version */
  version: string;

  /** Workflow status */
  status: WorkflowStatus;

  /** Execution mode */
  executionMode: WorkflowExecutionMode;

  /** Workflow tasks */
  tasks: AgentTask[];

  /** Task dependencies (adjacency list) */
  taskDependencies?: Record<string, string[]>;

  /** Participating agents */
  participatingAgents?: string[];

  /** Workflow inputs */
  inputs?: Record<string, unknown>;

  /** Workflow outputs */
  outputs?: Record<string, unknown>;

  /** Workflow configuration */
  config?: WorkflowConfig;

  /** When workflow was started */
  startedAt?: Timestamp | null;

  /** When workflow was completed */
  completedAt?: Timestamp | null;

  /** Overall progress (0-100) */
  progress?: number;

  /** Error information if failed */
  error?: ApiError;

  /** Workflow metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow configuration options
 */
export interface WorkflowConfig {
  /** Maximum parallel tasks */
  maxParallelTasks?: number;

  /** Workflow timeout in milliseconds */
  timeout?: number;

  /** Retry policy */
  retryPolicy?: WorkflowRetryPolicy;

  /** Error handling strategy */
  errorHandling?: 'stop' | 'continue' | 'skip';

  /** Whether to enable checkpointing */
  enableCheckpointing?: boolean;

  /** Checkpoint interval in milliseconds */
  checkpointInterval?: number;

  /** Additional configuration */
  [key: string]: unknown;
}

/**
 * Workflow retry policy
 */
export interface WorkflowRetryPolicy {
  /** Maximum retry attempts */
  maxAttempts: number;

  /** Initial delay in milliseconds */
  initialDelay: number;

  /** Maximum delay in milliseconds */
  maxDelay: number;

  /** Backoff multiplier */
  backoffMultiplier: number;

  /** Retry on specific error codes */
  retryOnErrors?: string[];
}

/**
 * Workflow execution state
 */
export interface WorkflowExecutionState {
  /** Workflow ID */
  workflowId: string;

  /** Current execution status */
  status: WorkflowStatus;

  /** Currently running task IDs */
  runningTasks: string[];

  /** Completed task IDs */
  completedTasks: string[];

  /** Failed task IDs */
  failedTasks: string[];

  /** Pending task IDs */
  pendingTasks: string[];

  /** Current execution context */
  context: Record<string, unknown>;

  /** Execution checkpoints */
  checkpoints?: WorkflowCheckpoint[];

  /** Last checkpoint timestamp */
  lastCheckpointAt?: Timestamp;
}

/**
 * Workflow checkpoint for recovery
 */
export interface WorkflowCheckpoint {
  /** Checkpoint ID */
  id: string;

  /** Checkpoint timestamp */
  timestamp: Timestamp;

  /** Execution state snapshot */
  state: Partial<WorkflowExecutionState>;

  /** Checkpoint metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Coordination Types
// ============================================================================

/**
 * Agent coordination mode
 */
export type CoordinationMode =
  | 'centralized'  // Central coordinator
  | 'distributed'  // Peer-to-peer
  | 'hierarchical'; // Leader-follower

/**
 * Agent coordination group
 */
export interface AgentCoordinationGroup extends BaseEntity {
  /** Group name */
  name: string;

  /** Group description */
  description?: string;

  /** Coordination mode */
  mode: CoordinationMode;

  /** Member agent IDs */
  memberIds: string[];

  /** Coordinator/leader agent ID */
  coordinatorId?: string;

  /** Group status */
  status: 'forming' | 'active' | 'suspended' | 'dissolved';

  /** Shared context/state */
  sharedContext?: Record<string, unknown>;

  /** Group metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent synchronization point
 */
export interface AgentSynchronizationPoint {
  /** Sync point ID */
  id: string;

  /** Sync point name */
  name: string;

  /** Required participant agent IDs */
  requiredParticipants: string[];

  /** Agents that have reached the sync point */
  arrivedAgents: string[];

  /** Whether all participants have arrived */
  isComplete: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Created timestamp */
  createdAt: Timestamp;

  /** Completed timestamp */
  completedAt?: Timestamp | null;
}

// ============================================================================
// Agent Communication Events
// ============================================================================

/**
 * Agent event types
 */
export type AgentEventType =
  | 'agent_started'
  | 'agent_stopped'
  | 'agent_error'
  | 'message_sent'
  | 'message_received'
  | 'task_assigned'
  | 'task_completed'
  | 'workflow_started'
  | 'workflow_completed'
  | 'sync_point_reached';

/**
 * Agent communication event
 */
export interface AgentCommunicationEvent {
  /** Event ID */
  id: string;

  /** Event type */
  type: AgentEventType;

  /** Agent ID that triggered the event */
  agentId: string;

  /** Event timestamp */
  timestamp: Timestamp;

  /** Event payload */
  payload: Record<string, unknown>;

  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent event subscription
 */
export interface AgentEventSubscription {
  /** Subscription ID */
  id: string;

  /** Subscriber agent ID */
  subscriberId: string;

  /** Event types to subscribe to */
  eventTypes: AgentEventType[];

  /** Filter criteria */
  filter?: Record<string, unknown>;

  /** Whether subscription is active */
  active: boolean;

  /** Created timestamp */
  createdAt: Timestamp;
}
