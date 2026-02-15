/**
 * Workflow Engine Type Definitions
 * DAG-based workflow orchestration for multi-agent coordination
 */

// ============================================================================
// Re-exports from other modules
// ============================================================================

export type {
  AuditEntry,
  AuditQuery,
  AuditQueryResult,
  AuditStatistics,
  AuditChange,
} from './audit-trail';
export { AuditActionType, AuditSeverity } from './audit-trail';

export type {
  RollbackResult,
  RollbackManagerOptions,
  WorkflowExecutionState,
} from './rollback-manager';

// ============================================================================
// Core Workflow Types
// ============================================================================

export type NodeType =
  | 'agent-task'      // Execute agent task
  | 'condition'       // Conditional branching
  | 'parallel'        // Parallel execution
  | 'merge'           // Merge parallel branches
  | 'loop'            // Iterative execution
  | 'transform'       // Data transformation
  | 'delay'           // Time delay
  | 'webhook'         // External webhook call
  | 'approval-gate';  // Human approval gate

export type NodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Workflow definition (YAML-serializable)
 */
export interface WorkflowDefinition {
  /** Workflow metadata */
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];

  /** Workflow nodes */
  nodes: WorkflowNode[];

  /** Node connections */
  edges: WorkflowEdge[];

  /** Global workflow configuration */
  config?: WorkflowConfig;

  /** Input schema validation */
  inputs?: Record<string, SchemaDefinition>;

  /** Output schema validation */
  outputs?: Record<string, SchemaDefinition>;
}

/**
 * Individual workflow node
 */
export interface WorkflowNode {
  /** Unique node identifier */
  id: string;

  /** Node type */
  type: NodeType;

  /** Display name */
  name: string;

  /** Node description */
  description?: string;

  /** Node-specific configuration */
  config: NodeConfig;

  /** Retry policy */
  retry?: RetryPolicy;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to continue on error */
  continueOnError?: boolean;

  /** Visual position (for editor) */
  position?: { x: number; y: number };
}

/**
 * Connection between nodes
 */
export interface WorkflowEdge {
  /** Edge identifier */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Condition for traversal (for conditional nodes) */
  condition?: string;

  /** Edge label */
  label?: string;
}

// ============================================================================
// Node Configuration Types
// ============================================================================

export type NodeConfig =
  | AgentTaskConfig
  | ConditionConfig
  | ParallelConfig
  | MergeConfig
  | LoopConfig
  | TransformConfig
  | DelayConfig
  | WebhookConfig
  | ApprovalGateConfig;

/**
 * Agent task node configuration
 */
export interface AgentTaskConfig {
  /** Agent type to execute */
  agentType: 'aider' | 'goose' | 'cline' | 'continue';

  /** Task description (supports template variables) */
  task: string;

  /** Model to use */
  model: string;

  /** Workspace path */
  workspace?: string;

  /** Files to work on */
  files?: string[];

  /** Additional agent metadata */
  metadata?: Record<string, unknown>;

  /** Input mapping from workflow context */
  inputs?: Record<string, string>;

  /** Output mapping to workflow context */
  outputs?: Record<string, string>;
}

/**
 * Conditional branching configuration
 */
export interface ConditionConfig {
  /** Expression to evaluate (JavaScript) */
  expression: string;

  /** Branches (edge conditions) */
  branches: {
    /** Branch name */
    name: string;

    /** Condition expression */
    condition: string;

    /** Target node ID */
    target: string;
  }[];
}

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
  /** Maximum concurrent branches */
  maxConcurrency?: number;

  /** Wait for all branches to complete */
  waitForAll?: boolean;

  /** Fail fast if any branch fails */
  failFast?: boolean;
}

/**
 * Merge configuration
 */
export interface MergeConfig {
  /** Merge strategy */
  strategy: 'all' | 'any' | 'first' | 'custom';

  /** Custom merge function (JavaScript) */
  mergeFunction?: string;
}

/**
 * Loop configuration
 */
export interface LoopConfig {
  /** Items to iterate over (template expression) */
  items: string;

  /** Variable name for current item */
  itemVar?: string;

  /** Variable name for current index */
  indexVar?: string;

  /** Maximum iterations */
  maxIterations?: number;

  /** Continue condition (JavaScript expression) */
  continueCondition?: string;
}

/**
 * Data transformation configuration
 */
export interface TransformConfig {
  /** Transformation function (JavaScript) */
  transform: string;

  /** Input variables */
  inputs?: string[];

  /** Output variable name */
  output?: string;
}

/**
 * Delay configuration
 */
export interface DelayConfig {
  /** Delay duration in milliseconds */
  duration: number;

  /** Dynamic duration expression */
  durationExpression?: string;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook URL */
  url: string;

  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /** Request headers */
  headers?: Record<string, string>;

  /** Request body (template) */
  body?: string;

  /** Expected status codes */
  expectedStatus?: number[];
}

/**
 * Approval gate configuration
 */
export interface ApprovalGateConfig {
  /** Approval type */
  approvalType: 'code_change' | 'deployment' | 'data_access' | 'cost_threshold' | 'security_action' | 'external_api' | 'custom';

  /** Approval title */
  title: string;

  /** Approval description */
  description: string;

  /** Required approvers (user IDs or roles) */
  requiredApprovers: string[];

  /** Priority level */
  priority?: 'low' | 'medium' | 'high' | 'critical';

  /** Expiration time in minutes */
  expiresInMinutes?: number;

  /** Escalation chain (user IDs or roles) */
  escalationChain?: string[];

  /** Auto-approve if no response within timeout */
  autoApproveOnTimeout?: boolean;
}

// ============================================================================
// Schema & Validation
// ============================================================================

export interface SchemaDefinition {
  /** Data type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';

  /** Required field */
  required?: boolean;

  /** Default value */
  default?: unknown;

  /** Description */
  description?: string;

  /** Validation rules */
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };

  /** Nested schema for objects/arrays */
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
}

// ============================================================================
// Execution State
// ============================================================================

/**
 * Workflow execution instance
 */
export interface WorkflowExecution {
  /** Unique execution ID */
  id: string;

  /** Workflow definition reference */
  workflowId: string;
  workflowVersion: string;

  /** Execution status */
  status: WorkflowStatus;

  /** Node execution states */
  nodes: Map<string, NodeExecution>;

  /** Workflow context (variables) */
  context: WorkflowContext;

  /** Execution metadata */
  metadata: ExecutionMetadata;

  /** Error information */
  error?: ExecutionError;

  /** Checkpoints for resumption */
  checkpoints: Checkpoint[];
}

/**
 * Individual node execution state
 */
export interface NodeExecution {
  /** Node ID */
  nodeId: string;

  /** Execution status */
  status: NodeStatus;

  /** Start timestamp */
  startedAt?: Date;

  /** Completion timestamp */
  completedAt?: Date;

  /** Execution duration (ms) */
  duration?: number;

  /** Input data */
  input?: unknown;

  /** Output data */
  output?: unknown;

  /** Error information */
  error?: ExecutionError;

  /** Retry attempts */
  retryCount: number;

  /** Execution logs */
  logs: ExecutionLog[];
}

/**
 * Workflow execution context (variable storage)
 */
export interface WorkflowContext {
  /** Input variables */
  input: Record<string, unknown>;

  /** Node outputs */
  nodes: Record<string, unknown>;

  /** Global variables */
  globals: Record<string, unknown>;

  /** Loop iteration contexts */
  loops: Record<string, LoopContext>;
}

export interface LoopContext {
  /** Current item */
  item: unknown;

  /** Current index */
  index: number;

  /** Total iterations */
  total: number;

  /** Iteration outputs */
  results: unknown[];
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  /** Execution start time */
  startedAt: Date;

  /** Execution completion time */
  completedAt?: Date;

  /** Total duration (ms) */
  duration?: number;

  /** Triggered by */
  triggeredBy?: string;

  /** Parent execution ID (for sub-workflows) */
  parentExecutionId?: string;

  /** Execution tags */
  tags?: string[];

  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Error information
 */
export interface ExecutionError {
  /** Error message */
  message: string;

  /** Error code */
  code?: string;

  /** Node that caused the error */
  nodeId?: string;

  /** Stack trace */
  stack?: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  /** Log timestamp */
  timestamp: Date;

  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';

  /** Log message */
  message: string;

  /** Node ID */
  nodeId?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Execution checkpoint (for resumption)
 */
export interface Checkpoint {
  /** Checkpoint ID */
  id: string;

  /** Checkpoint timestamp */
  timestamp: Date;

  /** Completed node IDs */
  completedNodes: string[];

  /** Current context snapshot */
  context: WorkflowContext;

  /** Checkpoint metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Global workflow configuration
 */
export interface WorkflowConfig {
  /** Maximum execution time (ms) */
  timeout?: number;

  /** Enable checkpointing */
  enableCheckpoints?: boolean;

  /** Checkpoint interval (ms) */
  checkpointInterval?: number;

  /** Maximum concurrent nodes */
  maxConcurrency?: number;

  /** Error handling strategy */
  errorHandling?: 'fail-fast' | 'continue' | 'retry';

  /** Global retry policy */
  retryPolicy?: RetryPolicy;

  /** Enable execution tracing */
  enableTracing?: boolean;

  /** Custom configuration */
  custom?: Record<string, unknown>;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  /** Maximum retry attempts */
  maxAttempts: number;

  /** Retry delay (ms) */
  delay: number;

  /** Backoff strategy */
  backoff?: 'constant' | 'linear' | 'exponential';

  /** Maximum backoff delay (ms) */
  maxDelay?: number;

  /** Retry on specific error codes */
  retryOn?: string[];
}

// ============================================================================
// Events
// ============================================================================

export enum WorkflowEventType {
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',
  WORKFLOW_PAUSED = 'workflow.paused',
  WORKFLOW_RESUMED = 'workflow.resumed',

  NODE_STARTED = 'node.started',
  NODE_COMPLETED = 'node.completed',
  NODE_FAILED = 'node.failed',
  NODE_SKIPPED = 'node.skipped',
  NODE_RETRYING = 'node.retrying',

  CHECKPOINT_CREATED = 'checkpoint.created',
}

export interface WorkflowEvent {
  /** Event type */
  type: WorkflowEventType;

  /** Event timestamp */
  timestamp: Date;

  /** Execution ID */
  executionId: string;

  /** Node ID (for node events) */
  nodeId?: string;

  /** Event data */
  data?: unknown;
}

// ============================================================================
// Template System
// ============================================================================

/**
 * Template variable reference
 */
export interface TemplateVariable {
  /** Variable path (e.g., "input.username", "nodes.task1.output") */
  path: string;

  /** Default value if not found */
  default?: unknown;

  /** Transformation function */
  transform?: string;
}

/**
 * Template expression (for dynamic values)
 */
export interface TemplateExpression {
  /** Expression string (JavaScript) */
  expression: string;

  /** Required context variables */
  requires?: string[];
}
