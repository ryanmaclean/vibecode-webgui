/**
 * Database Schema Types for VibeCode Cross-Service Contracts
 *
 * Provides TypeScript type definitions for database entities across PostgreSQL,
 * MongoDB, and Redis. These types align with the Prisma schema and provide
 * type-safe contracts for database operations in all services.
 *
 * @module types/shared/database-schemas
 */

// ============================================================================
// PostgreSQL Schema Types (Prisma Models)
// ============================================================================

// ----- User and Authentication -----

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string; // 'user' | 'admin'
  avatar: string | null;
  github_id: string | null;
  google_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: number;
  session_token: string;
  user_id: number;
  expires: Date;
  created_at: Date;
}

export interface SessionContext {
  id: number;
  content: string;
  metadata: Record<string, unknown> | null;
  session_id: string | null;
  user_id: number;
  workspace_id: number | null;
  embedding: unknown | null; // vector(1536)
  created_at: Date;
  updated_at: Date;
}

// ----- Workspace and Project -----

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  status: string; // 'active' | 'archived' | 'deleting'
  workspace_id: string;
  url: string | null;
  dbm_last_sample_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  user_id: number;
  workspace_id: number | null;
  language: string | null; // typescript, javascript, python, etc.
  framework: string | null; // react, vue, express, fastapi, etc.
  template: string | null;
  ai_prompt: string | null;
  status: string; // 'active' | 'archived' | 'generating'
  created_at: Date;
  updated_at: Date;
}

// ----- Files and RAG System -----

export interface File {
  id: number;
  name: string;
  path: string;
  content: string | null;
  size: number | null;
  mime_type: string | null;
  language: string | null;
  lines: number | null;
  checksum: string | null;
  user_id: number;
  workspace_id: number | null;
  project_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface RAGChunk {
  id: number;
  content: string;
  metadata: Record<string, unknown> | null;
  file_id: number | null;
  user_id: number;
  workspace_id: number | null;
  project_id: number | null;
  chunk_index: number | null;
  token_count: number | null;
  start_line: number | null;
  end_line: number | null;
  tokens: number | null;
  chunk_id: string | null;
  embedding: unknown | null; // vector(1536)
  created_at: Date;
  updated_at: Date;
}

export interface CodebaseIndex {
  id: number;
  file_path: string;
  file_hash: string;
  user_id: number;
  workspace_id: number | null;
  project_id: number | null;
  language: string | null;
  chunk_count: number;
  indexed_at: Date;
  last_modified_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RAGIngestJob {
  id: string;
  uploadId: number | null;
  blobName: string;
  storageContainer: string;
  originalFileName: string;
  size: number;
  status: string; // 'queued' | 'processing' | 'completed' | 'failed'
  queueName: string | null;
  userIdentifier: string | null;
  workspaceIdentifier: string | null;
  projectIdentifier: string | null;
  chunkCount: number;
  error: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Upload {
  id: number;
  original_name: string;
  stored_name: string;
  path: string;
  size: number;
  mime_type: string;
  user_id: number;
  workspace_id: number | null;
  status: string; // 'uploaded' | 'processing' | 'processed' | 'error'
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

// ----- AI Integration -----

export interface AIRequest {
  id: number;
  user_id: number;
  project_id: number | null;
  request_type: string; // 'generate_project' | 'chat' | 'completion', etc.
  prompt: string;
  model: string; // 'anthropic/claude-3.5-sonnet', etc.
  provider: string; // 'openrouter' | 'anthropic' | 'openai'
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  duration_ms: number | null;
  status: string; // 'pending' | 'completed' | 'error' | 'cancelled'
  response: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface AISuggestion {
  id: number;
  model_id: string;
  suggestion: string;
  language: string | null;
  user_id: number;
  workspace_id: number | null;
  project_id: number | null;
  context: Record<string, unknown> | null;
  timestamp: Date;
  outcome: string; // 'pending' | 'accepted' | 'rejected'
  final_code: string | null;
  edit_distance: number | null;
  similarity: number | null;
  time_to_accept: number | null;
  time_to_reject: number | null;
  rejection_reason: string | null;
  rating: number | null;
  rating_comment: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AIQualityMetric {
  id: number;
  model_id: string;
  period: string; // 'day' | 'week' | 'month'
  start_date: Date;
  end_date: Date;
  total_suggestions: number;
  accepted_suggestions: number;
  rejected_suggestions: number;
  acceptance_rate: number | null;
  avg_edit_distance: number | null;
  avg_similarity: number | null;
  avg_time_to_accept: number | null;
  avg_rating: number | null;
  trend_slope: number | null;
  health_status: string; // 'healthy' | 'warning' | 'critical'
  created_at: Date;
  updated_at: Date;
}

export interface AIQualityAlert {
  id: number;
  model_id: string;
  alert_type: string; // 'acceptance_rate_drop' | 'edit_distance_increase' | 'rating_decline' | 'slow_acceptance'
  severity: string; // 'warning' | 'critical'
  message: string;
  threshold: number;
  current_value: number;
  previous_value: number;
  detected_at: Date;
  resolved_at: Date | null;
  resolved: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

// ----- Monitoring and Analytics -----

export interface Event {
  id: number;
  user_id: number | null;
  event_type: string; // 'page_view' | 'api_call' | 'error', etc.
  event_name: string;
  properties: Record<string, unknown> | null;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface SystemMetric {
  id: number;
  metric_name: string; // 'cpu_usage' | 'memory_usage' | 'disk_usage', etc.
  value: number;
  unit: string | null; // 'percentage' | 'bytes' | 'ms', etc.
  tags: Record<string, unknown> | null;
  created_at: Date;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
  type: string; // 'string' | 'number' | 'boolean' | 'json'
  description: string | null;
  updated_at: Date;
}

// ----- Chat and Conversations -----

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
  TOOL = 'TOOL',
}

export interface Conversation {
  id: string;
  title: string | null;
  user_id: number;
  workspace_id: number | null;
  session_id: string | null;
  model: string | null;
  status: ConversationStatus;
  message_count: number;
  total_tokens: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tokens: number | null;
  model: string | null;
  provider: string | null;
  duration_ms: number | null;
  files: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChatSession {
  id: string;
  session_id: string;
  user_id: number;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: Date;
  created_at: Date;
}

// ----- Experimentation Platform -----

export enum ExperimentStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ExperimentStatus;
  config: Record<string, unknown>; // Variants, traffic allocation, targeting rules
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  userId: string;
  variantKey: string;
  assignedAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface ExperimentMetric {
  id: string;
  experimentId: string;
  assignmentId: string;
  metricName: string;
  metricValue: number;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

// ----- Agent Memory Architecture -----

export interface AgentMemory {
  id: string;
  agentId: string;
  projectId: string | null;
  workspaceId: string | null;
  beadId: string | null;
  tier: string; // 'long_term' | 'episodic' | 'working'
  content: string;
  contentType: string;
  embedding: unknown | null; // vector(1536)
  source: string | null;
  confidence: number;
  validatedAt: Date | null;
  validatedBy: string | null;
  usageCount: number;
  lastUsedAt: Date | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  accessedAt: Date;
}

export interface AgentBelief {
  id: string;
  agentId: string;
  memoryId: string | null;
  statement: string;
  evidence: string[];
  confidence: number;
  confidenceHistory: unknown[]; // JSON array
  status: string; // 'pending' | 'validated' | 'rejected'
  validatedAt: Date | null;
  validatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMemoryAccessLog {
  id: string;
  memoryId: string;
  agentId: string;
  accessType: string;
  context: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AgentSessionHandoff {
  id: string;
  agentId: string;
  sessionId: string;
  workingMemorySnapshot: string[];
  ephemeralSummary: string | null;
  activeBeadId: string | null;
  status: string; // 'active' | 'completed' | 'expired'
  resumedAt: Date | null;
  resumedBySession: string | null;
  createdAt: Date;
  expiresAt: Date;
}

// ----- Compliance and Audit -----

export interface AuditLog {
  id: string;
  timestamp: Date;
  user_id: number | null;
  action: string; // 'user.login' | 'file.create' | 'project.delete', etc.
  resource: string; // 'project:123' | 'file:456'
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  hash: string;
  previous_hash: string | null;
  severity: string; // 'info' | 'warning' | 'critical'
  category: string; // 'auth' | 'data_access' | 'admin' | 'system'
  outcome: string; // 'success' | 'failure' | 'error'
  session_id: string | null;
}

export interface ConfirmationRequest {
  id: string;
  request_id: string;
  agent_id: string;
  action_type: string; // 'file.delete' | 'database.drop' | 'deploy.production'
  file_path: string | null;
  status: string; // 'pending' | 'approved' | 'rejected' | 'expired'
  risk_level: string; // 'low' | 'medium' | 'high' | 'critical'
  metadata: Record<string, unknown> | null;
  created_at: Date;
  expires_at: Date;
  approved_at: Date | null;
  approved_by: number | null;
}

export interface OperationSnapshot {
  id: string;
  confirmation_id: string;
  operation_type: string; // 'file.write' | 'file.delete' | 'database.update'
  file_path: string | null;
  original_content: string | null;
  modified_content: string | null;
  rollback_status: string; // 'available' | 'rolled_back' | 'expired'
  rolled_back_at: Date | null;
  rolled_back_by: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

// ----- Plugin System -----

export interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string | null;
  status: string; // 'installed' | 'enabled' | 'disabled'
  manifest: Record<string, unknown>;
  installed_at: Date;
  updated_at: Date;
}

export interface PluginRepository {
  id: number;
  name: string;
  display_name: string;
  description: string;
  author_id: number;
  repository_url: string | null;
  homepage_url: string | null;
  icon_url: string | null;
  category: string; // 'integration' | 'ai-model' | 'theme' | 'extension'
  tags: Record<string, unknown> | null;
  downloads_count: number;
  average_rating: number | null;
  status: string; // 'published' | 'unpublished' | 'deprecated'
  featured: boolean;
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PluginVersion {
  id: number;
  plugin_id: number;
  version: string;
  changelog: string | null;
  package_url: string;
  package_checksum: string;
  compatible_versions: Record<string, unknown> | null;
  downloads_count: number;
  status: string; // 'active' | 'deprecated' | 'yanked'
  published_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PluginRating {
  id: number;
  plugin_id: number;
  user_id: number;
  rating: number; // 1-5 stars
  title: string | null;
  review: string | null;
  helpful_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface PluginDownload {
  id: number;
  plugin_id: number;
  version_id: number | null;
  user_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// ----- Secret Management -----

export interface SecretMetadata {
  id: number;
  key_name: string;
  created_at: Date;
  expires_at: Date | null;
  last_rotated_at: Date | null;
  rotation_policy: string | null; // 'api_keys_90d' | 'auth_tokens_30d'
  status: string; // 'active' | 'expired' | 'rotating' | 'revoked'
  metadata: Record<string, unknown> | null;
}

export interface SecretRotationHistory {
  id: number;
  secret_id: number;
  rotated_at: Date;
  rotated_by: string | null; // User identifier or 'system'
  previous_expires_at: Date | null;
  new_expires_at: Date | null;
  reason: string | null; // 'scheduled' | 'manual' | 'compromised'
  metadata: Record<string, unknown> | null;
}

// ============================================================================
// MongoDB Document Schema Types
// ============================================================================

/**
 * MongoDB flexible document structure for unstructured data storage
 */
export interface MongoDocument {
  _id: string;
  [key: string]: unknown;
}

/**
 * MongoDB session storage document
 */
export interface MongoSessionDocument extends MongoDocument {
  _id: string;
  sessionId: string;
  userId: number;
  data: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB cache document for flexible caching
 */
export interface MongoCacheDocument extends MongoDocument {
  _id: string;
  key: string;
  value: unknown;
  ttl: number; // Time-to-live in seconds
  expiresAt: Date;
  createdAt: Date;
}

/**
 * MongoDB audit event document for event streaming
 */
export interface MongoAuditEvent extends MongoDocument {
  _id: string;
  eventType: string;
  timestamp: Date;
  userId: number | null;
  action: string;
  resource: string;
  metadata: Record<string, unknown>;
  severity: string;
  category: string;
}

/**
 * MongoDB RAG embedding document for vector search
 */
export interface MongoRAGEmbedding extends MongoDocument {
  _id: string;
  chunkId: string;
  content: string;
  embedding: number[]; // Vector embedding array
  metadata: {
    fileId?: number;
    projectId?: number;
    workspaceId?: number;
    chunkIndex?: number;
    tokenCount?: number;
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB conversation history document
 */
export interface MongoConversationHistory extends MongoDocument {
  _id: string;
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
  summary: string | null;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Redis Cache Schema Types
// ============================================================================

/**
 * Redis key patterns for type-safe cache operations
 */
export type RedisKeyPattern =
  | `session:${string}` // User sessions
  | `cache:${string}` // General cache
  | `rate-limit:${string}` // Rate limiting
  | `lock:${string}` // Distributed locks
  | `queue:${string}` // Job queues
  | `pubsub:${string}`; // Pub/sub channels

/**
 * Redis session data structure
 */
export interface RedisSession {
  sessionId: string;
  userId: number;
  expiresAt: number; // Unix timestamp
  data: Record<string, unknown>;
}

/**
 * Redis cache entry structure
 */
export interface RedisCacheEntry<T = unknown> {
  key: string;
  value: T;
  ttl: number; // Time-to-live in seconds
  createdAt: number; // Unix timestamp
}

/**
 * Redis rate limit data structure
 */
export interface RedisRateLimit {
  key: string;
  count: number;
  resetAt: number; // Unix timestamp
  limit: number;
}

/**
 * Redis distributed lock structure
 */
export interface RedisLock {
  key: string;
  lockId: string;
  acquiredAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  owner: string;
}

/**
 * Redis job queue item structure
 */
export interface RedisJobQueueItem<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: number; // Unix timestamp
  processedAt: number | null; // Unix timestamp
  error: string | null;
}

/**
 * Redis pub/sub message structure
 */
export interface RedisPubSubMessage<T = unknown> {
  channel: string;
  eventType: string;
  payload: T;
  timestamp: number; // Unix timestamp
  messageId: string;
}

/**
 * Redis workspace state cache
 */
export interface RedisWorkspaceState {
  workspaceId: string;
  status: 'active' | 'inactive' | 'suspended';
  containerStatus: string | null;
  lastActivity: number; // Unix timestamp
  activeUsers: number;
  metadata: Record<string, unknown>;
}

/**
 * Redis AI request cache for deduplication
 */
export interface RedisAIRequestCache {
  requestHash: string;
  model: string;
  provider: string;
  prompt: string;
  response: Record<string, unknown>;
  tokens: {
    input: number;
    output: number;
  };
  cachedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
}

// ============================================================================
// Database Query Types
// ============================================================================

/**
 * Generic database query filter
 */
export interface DatabaseFilter<T = unknown> {
  field: keyof T;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'regex';
  value: unknown;
}

/**
 * Database query options
 */
export interface DatabaseQueryOptions<T = unknown> {
  filters?: DatabaseFilter<T>[];
  sort?: {
    field: keyof T;
    order: 'asc' | 'desc';
  }[];
  limit?: number;
  offset?: number;
  select?: (keyof T)[];
}

/**
 * Database transaction options
 */
export interface DatabaseTransactionOptions {
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  timeout?: number; // Milliseconds
  retries?: number;
}

/**
 * Database connection configuration
 */
export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

/**
 * Database migration metadata
 */
export interface DatabaseMigration {
  id: string;
  name: string;
  version: string;
  appliedAt: Date;
  checksum: string;
  executionTime: number; // Milliseconds
  status: 'pending' | 'applied' | 'failed' | 'rolled_back';
}
