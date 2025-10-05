/**
 * TypeScript type definitions for VibeCode Agent API
 * Generated from OpenAPI 3.0 specification
 *
 * @see /docs/api/AGENT_API_SPECIFICATION.yaml
 */

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Supported AI coding agent types
 */
export type AgentType = 'aider' | 'goose' | 'cline';

/**
 * Supported LLM models
 */
export type ModelType =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'deepseek-chat';

/**
 * Agent execution status
 */
export type AgentStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'error';

/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health check status
 */
export type ComponentHealthStatus = 'pass' | 'warn' | 'fail';

/**
 * Message type for agent communication
 */
export type MessageType = 'user' | 'system';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request to start a new agent
 */
export interface StartAgentRequest {
  /** Type of agent to start */
  agent_type: AgentType;

  /** Absolute path to workspace directory (must start with /home/coder/workspace) */
  workspace: string;

  /** Files for agent to work on (relative to workspace, max 50) */
  files?: string[];

  /** LLM model identifier */
  model: ModelType;

  /** Task description for the agent (10-2000 chars) */
  task: string;

  /** Additional metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Request to send message to agent
 */
export interface AgentMessageRequest {
  /** Message content to send to agent (1-5000 chars) */
  message: string;

  /** Message type (default: user) */
  type?: MessageType;
}

/**
 * Query parameters for listing agents
 */
export interface ListAgentsQuery {
  /** Filter by agent status */
  status?: AgentStatus;

  /** Filter by agent type */
  agent_type?: AgentType;

  /** Page number (1-indexed, default: 1) */
  page?: number;

  /** Items per page (1-100, default: 50) */
  limit?: number;
}

/**
 * Query parameters for stopping agent
 */
export interface StopAgentQuery {
  /** Force immediate termination (SIGKILL) without graceful shutdown */
  force?: boolean;
}

/**
 * Query parameters for streaming events
 */
export interface StreamEventsQuery {
  /** Resume stream from specific sequence number */
  from_sequence?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Basic agent response
 */
export interface AgentResponse {
  /** Unique identifier for the agent (format: {type}-{hex8}) */
  agent_id: string;

  /** Current agent status */
  status: AgentStatus;

  /** Associated terminal session ID */
  terminal_id: string;

  /** Process ID of the agent */
  pid?: number;

  /** Command used to start the agent */
  command?: string;

  /** When the agent was created (ISO 8601) */
  created_at: string;

  /** URL for SSE event stream */
  stream_url?: string;

  /** URL for WebSocket connection */
  ws_url?: string;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  /** CPU usage percentage */
  cpu_percent: number;

  /** Memory usage in megabytes */
  memory_mb: number;

  /** Disk I/O in megabytes */
  disk_io_mb: number;
}

/**
 * Detailed agent status response
 */
export interface AgentStatusResponse extends AgentResponse {
  /** Type of agent */
  agent_type: AgentType;

  /** Workspace directory path */
  workspace: string;

  /** How long the agent has been running (seconds) */
  uptime_seconds: number;

  /** Exit code (null if still running) */
  exit_code: number | null;

  /** Resource consumption metrics */
  resource_usage?: ResourceUsage;

  /** Number of output lines captured */
  output_lines?: number;

  /** Most recent output line */
  last_output?: string;

  /** Timestamp of last output (ISO 8601, nullable) */
  last_output_at: string | null;
}

/**
 * Pagination metadata
 */
export interface Pagination {
  /** Current page number */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of items */
  total: number;

  /** Total number of pages */
  pages: number;
}

/**
 * Agent list summary statistics
 */
export interface AgentListSummary {
  /** Number of running agents */
  active: number;

  /** Number of completed agents */
  completed: number;

  /** Number of failed agents */
  failed: number;

  /** Agent counts by type */
  by_type: Record<AgentType, number>;
}

/**
 * Response for listing agents
 */
export interface AgentListResponse {
  /** Array of agent status objects */
  agents: AgentStatusResponse[];

  /** Pagination metadata */
  pagination: Pagination;

  /** Summary statistics */
  summary?: AgentListSummary;
}

/**
 * Response for stopping agent
 */
export interface StopAgentResponse {
  /** Agent identifier */
  agent_id: string;

  /** Status after stopping */
  status: 'stopped';

  /** Success message */
  message: string;

  /** When the agent was stopped (ISO 8601) */
  stopped_at: string;

  /** Exit code if graceful shutdown */
  exit_code: number | null;

  /** Whether force termination (SIGKILL) was used */
  forced: boolean;
}

/**
 * Response for sending message to agent
 */
export interface SendMessageResponse {
  /** Unique identifier for the message (UUID) */
  message_id: string;

  /** Message delivery status */
  status: 'sent' | 'queued' | 'failed';

  /** When the message was sent (ISO 8601) */
  timestamp: string;
}

/**
 * Component health check result
 */
export interface ComponentHealth {
  /** Component health status */
  status: ComponentHealthStatus;

  /** Response time in milliseconds */
  response_time_ms: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Agent capacity information
 */
export interface AgentCapacity {
  /** Current number of active agents */
  active: number;

  /** Maximum concurrent agents globally */
  max_concurrent: number;

  /** Maximum concurrent agents per user */
  user_limit: number;
}

/**
 * Health check response
 */
export interface HealthResponse {
  /** Overall health status */
  status: HealthStatus;

  /** API version */
  version: string;

  /** Health check timestamp (ISO 8601) */
  timestamp: string;

  /** Individual component health checks */
  checks?: Record<string, ComponentHealth>;

  /** Agent capacity information */
  agents?: AgentCapacity;

  /** Service uptime in seconds */
  uptime_seconds?: number;
}

/**
 * RFC 7807 Problem Details for HTTP APIs
 * Used for standardized error responses
 */
export interface ProblemDetails {
  /** URI reference identifying the problem type */
  type: string;

  /** Short, human-readable summary */
  title: string;

  /** HTTP status code */
  status: number;

  /** Human-readable explanation specific to this occurrence */
  detail?: string;

  /** URI reference identifying the specific occurrence */
  instance?: string;

  /** Distributed tracing ID for debugging */
  trace_id?: string;

  /** Additional problem-specific fields */
  [key: string]: unknown;
}

// ============================================================================
// Server-Sent Events (SSE) Types
// ============================================================================

/**
 * SSE event types
 */
export type SSEEventType =
  | 'output'
  | 'status'
  | 'error'
  | 'complete'
  | 'heartbeat';

/**
 * Base SSE event structure
 */
export interface SSEEvent<T = unknown> {
  /** Event sequence number */
  id: string;

  /** Event type */
  event: SSEEventType;

  /** Event data */
  data: T;
}

/**
 * Agent output event data
 */
export interface OutputEventData {
  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Output line content */
  line: string;
}

/**
 * Status change event data
 */
export interface StatusEventData {
  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** New agent status */
  status: AgentStatus;

  /** Task progress (0.0-1.0) */
  progress?: number;
}

/**
 * Error event data
 */
export interface ErrorEventData {
  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Error message */
  error: string;

  /** Error code */
  code?: string;
}

/**
 * Completion event data
 */
export interface CompleteEventData {
  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Final agent status */
  status: 'completed' | 'failed' | 'stopped';

  /** Exit code */
  exit_code: number;
}

/**
 * Heartbeat event data (keep-alive)
 */
export interface HeartbeatEventData {
  /** Event timestamp (ISO 8601) */
  timestamp: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket message types (client -> server)
 */
export type WSClientMessageType = 'message' | 'ping';

/**
 * WebSocket message types (server -> client)
 */
export type WSServerMessageType =
  | 'output'
  | 'status'
  | 'error'
  | 'complete'
  | 'pong';

/**
 * Base WebSocket message structure
 */
export interface WSMessage<T = unknown> {
  /** Message type */
  type: string;

  /** Message payload */
  [key: string]: T;
}

/**
 * Client message to send to agent
 */
export interface WSClientMessage extends WSMessage<string> {
  type: 'message';
  content: string;
}

/**
 * Client ping message
 */
export interface WSClientPing extends WSMessage {
  type: 'ping';
}

/**
 * Server output message
 */
export interface WSServerOutput extends WSMessage<string> {
  type: 'output';
  content: string;
  timestamp: string;
}

/**
 * Server status update message
 */
export interface WSServerStatus extends WSMessage<AgentStatus> {
  type: 'status';
  status: AgentStatus;
  progress?: number;
}

/**
 * Server error message
 */
export interface WSServerError extends WSMessage<string> {
  type: 'error';
  error: string;
}

/**
 * Server completion message
 */
export interface WSServerComplete extends WSMessage<number> {
  type: 'complete';
  exit_code: number;
}

/**
 * Server pong response
 */
export interface WSServerPong extends WSMessage {
  type: 'pong';
}

/**
 * Union type for all client messages
 */
export type WSClientMessages = WSClientMessage | WSClientPing;

/**
 * Union type for all server messages
 */
export type WSServerMessages =
  | WSServerOutput
  | WSServerStatus
  | WSServerError
  | WSServerComplete
  | WSServerPong;

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  /** Maximum requests per time window */
  'X-RateLimit-Limit': number;

  /** Remaining requests in current window */
  'X-RateLimit-Remaining': number;

  /** Time when rate limit resets (Unix timestamp) */
  'X-RateLimit-Reset': number;

  /** Seconds until rate limit resets (only in 429 responses) */
  'Retry-After'?: number;
}

// ============================================================================
// API Client Types
// ============================================================================

/**
 * API client configuration
 */
export interface AgentAPIConfig {
  /** Base URL for API requests */
  baseUrl?: string;

  /** API key for authentication (optional) */
  apiKey?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Enable automatic retries */
  retries?: boolean;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * API request options
 */
export interface RequestOptions {
  /** Request timeout in milliseconds (overrides config) */
  timeout?: number;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;

  /** Custom headers for this request */
  headers?: Record<string, string>;
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  /** Response data */
  data: T;

  /** HTTP status code */
  status: number;

  /** Response headers */
  headers: Record<string, string>;

  /** Rate limit information (if present) */
  rateLimit?: RateLimitHeaders;
}

/**
 * API error
 */
export class AgentAPIError extends Error {
  /** HTTP status code */
  public status: number;

  /** Problem details (RFC 7807) */
  public problem: ProblemDetails;

  /** Rate limit headers (if 429 response) */
  public rateLimit?: RateLimitHeaders;

  constructor(problem: ProblemDetails, rateLimit?: RateLimitHeaders) {
    super(problem.detail || problem.title);
    this.name = 'AgentAPIError';
    this.status = problem.status;
    this.problem = problem;
    this.rateLimit = rateLimit;
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates agent ID format
 */
export function isValidAgentId(agentId: string): boolean {
  return /^(aider|goose|cline)-[a-f0-9]{8}$/.test(agentId);
}

/**
 * Validates workspace path
 */
export function isValidWorkspacePath(path: string): boolean {
  return /^\/home\/coder\/workspace(\/.*)?$/.test(path);
}

/**
 * Validates task length
 */
export function isValidTask(task: string): boolean {
  return task.length >= 10 && task.length <= 2000;
}

/**
 * Validates message length
 */
export function isValidMessage(message: string): boolean {
  return message.length >= 1 && message.length <= 5000;
}

/**
 * Type guard for agent type
 */
export function isAgentType(value: unknown): value is AgentType {
  return typeof value === 'string' &&
    ['aider', 'goose', 'cline'].includes(value);
}

/**
 * Type guard for agent status
 */
export function isAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === 'string' &&
    ['running', 'completed', 'failed', 'stopped', 'error'].includes(value);
}

/**
 * Type guard for problem details
 */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'title' in value &&
    'status' in value
  );
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<AgentAPIConfig> = {
  baseUrl: '/api',
  apiKey: '',
  timeout: 30000,
  retries: true,
  maxRetries: 3,
  headers: {},
};

/**
 * Default pagination limits
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 50,
  maxLimit: 100,
} as const;

/**
 * Agent constraints
 */
export const AGENT_CONSTRAINTS = {
  maxConcurrentPerUser: 5,
  maxConcurrentGlobal: 20,
  timeoutSeconds: 300,
  maxFiles: 50,
  taskMinLength: 10,
  taskMaxLength: 2000,
  messageMinLength: 1,
  messageMaxLength: 5000,
} as const;

/**
 * Supported agent types list
 */
export const AGENT_TYPES: ReadonlyArray<AgentType> = [
  'aider',
  'goose',
  'cline',
] as const;

/**
 * Supported model types list
 */
export const MODEL_TYPES: ReadonlyArray<ModelType> = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'gpt-4o',
  'gpt-4o-mini',
  'deepseek-chat',
] as const;

/**
 * WebSocket subprotocol version
 */
export const WS_SUBPROTOCOL = 'agent-v1' as const;

/**
 * SSE reconnection defaults
 */
export const SSE_DEFAULTS = {
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
} as const;
