/**
 * Shared Type Definitions - Barrel Export
 *
 * Central export file for all VibeCode cross-service type definitions.
 * Import shared types with: import { TypeName } from '@/types/shared'
 *
 * Note: Some types have similar names across domains (e.g., Session in API vs Database).
 * When ambiguity exists, we provide aliased exports:
 * - API types: ApiSession, ApiProject, ApiWorkspace, ApiHealthStatus, ApiServiceHealth
 * - Database types: DbSession, DbProject, DbWorkspace, DbMessageRole
 * - AI types: AiMessageRole
 * - Monitoring types: MonitoringHealthStatus, MonitoringServiceHealth
 *
 * For unambiguous imports, use direct module imports:
 * - import { Session } from '@/types/shared/api-contracts'
 * - import { Session } from '@/types/shared/database-schemas'
 *
 * @module types/shared
 */

// ============================================================================
// Common Base Types
// ============================================================================
export * from './common';

// ============================================================================
// Agent Communication Types (no conflicts)
// ============================================================================
export * from './agent-communication';

// ============================================================================
// API Contract Types (with aliases for conflicting types)
// ============================================================================
export type {
  HealthStatus as ApiHealthStatus,
  ServiceHealth as ApiServiceHealth,
  Project as ApiProject,
  Session as ApiSession,
  SessionStatus as ApiSessionStatus,
  Workspace as ApiWorkspace,
} from './api-contracts';

// Re-export all other API contract types
export type {
  HealthCheckResponse,
  ReadinessResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  CsrfTokenResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  ProjectStatus,
  ProjectVisibility,
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  GetProjectResponse,
  DeleteProjectResponse,
  ListProjectsRequest,
  ListProjectsResponse,
  WorkspaceStatus,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  GetWorkspaceResponse,
  UpdateWorkspaceRequest,
  UpdateWorkspaceResponse,
  ListWorkspacesRequest,
  ListWorkspacesResponse,
  FileType,
  FileMetadata,
  ListFilesRequest,
  ListFilesResponse,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  DeleteFileRequest,
  DeleteFileResponse,
  FileSyncRequest,
  FileSyncResponse,
  ContainerStatus,
  ContainerResources,
  Container,
  CreateContainerRequest,
  CreateContainerResponse,
  GetContainerResponse,
  ListContainersRequest,
  ListContainersResponse,
  ContainerActionRequest,
  ContainerActionResponse,
  SessionType,
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  AsyncOperationResponse,
  BatchOperationRequest,
  BatchOperationResponse,
} from './api-contracts';

// ============================================================================
// AI Provider Types (with alias for conflicting MessageRole)
// ============================================================================
export type {
  MessageRole as AiMessageRole,
} from './ai-providers';

// Re-export all other AI provider types
export type {
  AIProviderId,
  AIProviderConfig,
  ProviderHealthStatus,
  CircuitBreakerState,
  ProviderHealth,
  ChatMessage,
  MessageContent,
  TextContent,
  ImageContent,
  ToolCall,
  FunctionCall,
  ToolDefinition,
  ChatCompletionRequest,
  TokenUsage,
  FinishReason,
  ChatCompletionChoice,
  ChatCompletionResponse,
  ChatCompletionDelta,
  ChatCompletionStreamChoice,
  ChatCompletionStreamChunk,
  EmbeddingsRequest,
  Embedding,
  EmbeddingsResponse,
  ModelCapabilities,
  ModelPricing,
  ModelInfo,
  AIOperationCost,
  AIProviderRegistry,
  AIErrorCode,
  AIProviderError,
  AIOperationMetrics,
} from './ai-providers';

// ============================================================================
// Database Schema Types (with aliases for conflicting types)
// ============================================================================
export type {
  Session as DbSession,
  Project as DbProject,
  Workspace as DbWorkspace,
  MessageRole as DbMessageRole,
} from './database-schemas';

// Re-export all other database schema types
export type {
  User,
  SessionContext,
  File,
  RAGChunk,
  CodebaseIndex,
  RAGIngestJob,
  Upload,
  AIRequest,
  AISuggestion,
  AIQualityMetric,
  AIQualityAlert,
  Event,
  SystemMetric,
  Setting,
  Conversation,
  Message,
  ChatSession,
  Experiment,
  ExperimentAssignment,
  ExperimentMetric,
  AgentMemory,
  AgentBelief,
  AgentMemoryAccessLog,
  AgentSessionHandoff,
  AuditLog,
  ConfirmationRequest,
  OperationSnapshot,
  Plugin,
  PluginRepository,
  PluginVersion,
  PluginRating,
  PluginDownload,
  SecretMetadata,
  SecretRotationHistory,
  ConversationStatus,
  ExperimentStatus,
  MongoSessionDocument,
  MongoCacheDocument,
  MongoAuditEvent,
  MongoRAGEmbedding,
  MongoConversationHistory,
  RedisSession,
  RedisCacheEntry,
  RedisRateLimit,
  RedisLock,
  RedisJobQueueItem,
  RedisPubSubMessage,
  RedisWorkspaceState,
  RedisAIRequestCache,
  RedisKeyPattern,
  DatabaseFilter,
  DatabaseQueryOptions,
  DatabaseTransactionOptions,
  DatabaseConnectionConfig,
  DatabaseMigration,
} from './database-schemas';

// ============================================================================
// Monitoring & Telemetry Types (with aliases for conflicting types)
// ============================================================================
export type {
  HealthStatus as MonitoringHealthStatus,
  ServiceHealth as MonitoringServiceHealth,
  DependencyHealth as MonitoringDependencyHealth,
} from './monitoring';

// Re-export all other monitoring types
export type {
  LogLevel,
  LogEntry,
  ErrorContext,
  MetricType,
  MetricDataPoint,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  TimerMetric,
  DistributionMetric,
  MetricAggregation,
  SpanKind,
  SpanStatus,
  Span,
  SpanEvent,
  SpanLink,
  Trace,
  EventSeverity,
  EventSource,
  MonitoringEvent,
  ComponentHealth,
  HttpRequestMetrics,
  DatabaseQueryMetrics,
  AIRequestMetrics,
  SystemMetrics,
  CpuMetrics,
  MemoryMetrics,
  DiskMetrics,
  NetworkMetrics,
  ProcessMetrics,
  AlertSeverity,
  AlertStatus,
  MonitoringAlert,
  AlertNotification,
  MonitoringCost,
  DatadogCost,
  SamplingStrategy,
  TelemetryConfig,
  TelemetryBatch,
  ExportResult,
} from './monitoring';

// Re-export LOG_SEVERITY constant from monitoring
export { LOG_SEVERITY } from './monitoring';
