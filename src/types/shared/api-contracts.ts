/**
 * API Contract Type Definitions for REST Endpoints
 *
 * Standardized request/response types for REST API endpoints across all services.
 * These contracts ensure type-safe communication between frontend, backend, and
 * desktop applications.
 *
 * @module types/shared/api-contracts
 */

import type {
  BaseRequest,
  BaseResponse,
  PaginatedRequest,
  PaginatedResponse,
  EntityId,
  Timestamp,
  OperationStatus,
} from './common';

// ============================================================================
// Health Check Contracts
// ============================================================================

/**
 * Health check status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Service health check result
 */
export interface ServiceHealth {
  /** Service name */
  name: string;

  /** Health status */
  status: HealthStatus;

  /** Response latency in milliseconds */
  latencyMs?: number;

  /** Last check timestamp (ISO 8601) */
  lastChecked: Timestamp;

  /** Error message if unhealthy */
  error?: string;

  /** Additional service details */
  details?: Record<string, unknown>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse extends BaseResponse<{
  /** Overall system health */
  status: HealthStatus;

  /** Timestamp of the check */
  timestamp: Timestamp;

  /** Total check duration */
  totalCheckTimeMs: number;

  /** Individual service health results */
  services: ServiceHealth[];

  /** Health summary */
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}> {}

/**
 * Simple readiness check response
 */
export interface ReadinessResponse extends BaseResponse<{
  /** Whether system is ready to accept requests */
  ready: boolean;

  /** Timestamp of the check */
  timestamp: Timestamp;
}> {}

// ============================================================================
// Authentication Contracts
// ============================================================================

/**
 * Login request
 */
export interface LoginRequest extends BaseRequest {
  /** User email or username */
  email: string;

  /** User password */
  password: string;

  /** MFA code if enabled */
  mfaCode?: string;

  /** Whether to remember the session */
  rememberMe?: boolean;
}

/**
 * Login response
 */
export interface LoginResponse extends BaseResponse<{
  /** Authentication token */
  token: string;

  /** Token expiration timestamp (ISO 8601) */
  expiresAt: Timestamp;

  /** Refresh token */
  refreshToken?: string;

  /** User information */
  user: {
    id: EntityId;
    email: string;
    name: string;
    role: string;
  };

  /** Whether MFA is required */
  requiresMfa?: boolean;
}> {}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest extends BaseRequest {
  /** Refresh token */
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse extends BaseResponse<{
  /** New access token */
  token: string;

  /** Token expiration timestamp (ISO 8601) */
  expiresAt: Timestamp;

  /** New refresh token (if rotated) */
  refreshToken?: string;
}> {}

/**
 * CSRF token response
 */
export interface CsrfTokenResponse extends BaseResponse<{
  /** CSRF token */
  csrfToken: string;

  /** Token expiration timestamp (milliseconds since epoch) */
  expires: number;
}> {}

/**
 * MFA setup response
 */
export interface MfaSetupResponse extends BaseResponse<{
  /** QR code data URL */
  qrCode: string;

  /** Secret key for manual entry */
  secret: string;

  /** Backup codes */
  backupCodes: string[];
}> {}

/**
 * MFA verification request
 */
export interface MfaVerifyRequest extends BaseRequest {
  /** MFA code from authenticator */
  code: string;

  /** Optional backup code */
  backupCode?: string;
}

/**
 * MFA verification response
 */
export interface MfaVerifyResponse extends BaseResponse<{
  /** Whether verification was successful */
  verified: boolean;

  /** Remaining backup codes count */
  remainingBackupCodes?: number;
}> {}

// ============================================================================
// Project Management Contracts
// ============================================================================

/**
 * Project status
 */
export type ProjectStatus = 'active' | 'archived' | 'template' | 'deleted';

/**
 * Project visibility
 */
export type ProjectVisibility = 'private' | 'internal' | 'public';

/**
 * Project entity
 */
export interface Project {
  /** Project ID */
  id: EntityId;

  /** Project name */
  name: string;

  /** Project description */
  description?: string;

  /** Project status */
  status: ProjectStatus;

  /** Project visibility */
  visibility: ProjectVisibility;

  /** Owner user ID */
  ownerId: EntityId;

  /** Workspace ID */
  workspaceId?: EntityId;

  /** Project tags */
  tags?: string[];

  /** Project metadata */
  metadata?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;

  /** Deletion timestamp (soft delete) */
  deletedAt?: Timestamp | null;
}

/**
 * Create project request
 */
export interface CreateProjectRequest extends BaseRequest {
  /** Project name */
  name: string;

  /** Project description */
  description?: string;

  /** Project visibility */
  visibility?: ProjectVisibility;

  /** Template ID to create from */
  templateId?: EntityId;

  /** Project tags */
  tags?: string[];

  /** Project metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create project response
 */
export interface CreateProjectResponse extends BaseResponse<Project> {}

/**
 * Update project request
 */
export interface UpdateProjectRequest extends BaseRequest {
  /** Project name */
  name?: string;

  /** Project description */
  description?: string;

  /** Project status */
  status?: ProjectStatus;

  /** Project visibility */
  visibility?: ProjectVisibility;

  /** Project tags */
  tags?: string[];

  /** Project metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update project response
 */
export interface UpdateProjectResponse extends BaseResponse<Project> {}

/**
 * Get project response
 */
export interface GetProjectResponse extends BaseResponse<Project> {}

/**
 * Delete project response
 */
export interface DeleteProjectResponse extends BaseResponse<{
  /** Deleted project ID */
  id: EntityId;

  /** Whether deletion was successful */
  deleted: boolean;
}> {}

/**
 * List projects request
 */
export interface ListProjectsRequest extends PaginatedRequest {
  /** Filter by status */
  status?: ProjectStatus;

  /** Filter by visibility */
  visibility?: ProjectVisibility;

  /** Filter by owner ID */
  ownerId?: EntityId;

  /** Filter by workspace ID */
  workspaceId?: EntityId;

  /** Search query */
  search?: string;

  /** Filter by tags */
  tags?: string[];
}

/**
 * List projects response
 */
export interface ListProjectsResponse extends PaginatedResponse<Project> {}

// ============================================================================
// Workspace Management Contracts
// ============================================================================

/**
 * Workspace status
 */
export type WorkspaceStatus = 'active' | 'suspended' | 'archived' | 'deleted';

/**
 * Workspace entity
 */
export interface Workspace {
  /** Workspace ID */
  id: EntityId;

  /** Workspace name */
  name: string;

  /** Workspace description */
  description?: string;

  /** Workspace status */
  status: WorkspaceStatus;

  /** Owner user ID */
  ownerId: EntityId;

  /** Workspace path */
  path: string;

  /** Container ID if running */
  containerId?: string;

  /** Workspace settings */
  settings?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;

  /** Deletion timestamp */
  deletedAt?: Timestamp | null;
}

/**
 * Create workspace request
 */
export interface CreateWorkspaceRequest extends BaseRequest {
  /** Workspace name */
  name: string;

  /** Workspace description */
  description?: string;

  /** Project ID to associate with */
  projectId?: EntityId;

  /** Template ID to create from */
  templateId?: EntityId;

  /** Workspace settings */
  settings?: Record<string, unknown>;
}

/**
 * Create workspace response
 */
export interface CreateWorkspaceResponse extends BaseResponse<Workspace> {}

/**
 * Get workspace response
 */
export interface GetWorkspaceResponse extends BaseResponse<Workspace> {}

/**
 * Update workspace request
 */
export interface UpdateWorkspaceRequest extends BaseRequest {
  /** Workspace name */
  name?: string;

  /** Workspace description */
  description?: string;

  /** Workspace status */
  status?: WorkspaceStatus;

  /** Workspace settings */
  settings?: Record<string, unknown>;
}

/**
 * Update workspace response
 */
export interface UpdateWorkspaceResponse extends BaseResponse<Workspace> {}

/**
 * List workspaces request
 */
export interface ListWorkspacesRequest extends PaginatedRequest {
  /** Filter by status */
  status?: WorkspaceStatus;

  /** Filter by owner ID */
  ownerId?: EntityId;

  /** Filter by project ID */
  projectId?: EntityId;

  /** Search query */
  search?: string;
}

/**
 * List workspaces response
 */
export interface ListWorkspacesResponse extends PaginatedResponse<Workspace> {}

// ============================================================================
// File Operations Contracts
// ============================================================================

/**
 * File type
 */
export type FileType = 'file' | 'directory' | 'symlink';

/**
 * File metadata
 */
export interface FileMetadata {
  /** File path (relative to workspace) */
  path: string;

  /** File name */
  name: string;

  /** File type */
  type: FileType;

  /** File size in bytes */
  size: number;

  /** MIME type */
  mimeType?: string;

  /** File permissions (Unix-style) */
  permissions?: string;

  /** Last modified timestamp */
  modifiedAt: Timestamp;

  /** Creation timestamp */
  createdAt?: Timestamp;

  /** Whether file is hidden */
  hidden?: boolean;
}

/**
 * List files request
 */
export interface ListFilesRequest extends BaseRequest {
  /** Directory path to list (relative to workspace) */
  path?: string;

  /** Whether to list recursively */
  recursive?: boolean;

  /** Include hidden files */
  includeHidden?: boolean;

  /** File pattern to match (glob) */
  pattern?: string;
}

/**
 * List files response
 */
export interface ListFilesResponse extends BaseResponse<{
  /** Base path */
  basePath: string;

  /** File entries */
  files: FileMetadata[];

  /** Total count */
  totalCount: number;
}> {}

/**
 * Read file request
 */
export interface ReadFileRequest extends BaseRequest {
  /** File path (relative to workspace) */
  path: string;

  /** Encoding (default: utf-8) */
  encoding?: string;

  /** Start byte offset (for partial reads) */
  offset?: number;

  /** Number of bytes to read */
  length?: number;
}

/**
 * Read file response
 */
export interface ReadFileResponse extends BaseResponse<{
  /** File content */
  content: string;

  /** File metadata */
  metadata: FileMetadata;

  /** Content encoding */
  encoding: string;
}> {}

/**
 * Write file request
 */
export interface WriteFileRequest extends BaseRequest {
  /** File path (relative to workspace) */
  path: string;

  /** File content */
  content: string;

  /** Content encoding */
  encoding?: string;

  /** Whether to create parent directories */
  createDirectories?: boolean;

  /** File permissions */
  permissions?: string;
}

/**
 * Write file response
 */
export interface WriteFileResponse extends BaseResponse<{
  /** File metadata */
  metadata: FileMetadata;

  /** Number of bytes written */
  bytesWritten: number;
}> {}

/**
 * Delete file request
 */
export interface DeleteFileRequest extends BaseRequest {
  /** File path (relative to workspace) */
  path: string;

  /** Whether to delete recursively (for directories) */
  recursive?: boolean;
}

/**
 * Delete file response
 */
export interface DeleteFileResponse extends BaseResponse<{
  /** Deleted path */
  path: string;

  /** Whether deletion was successful */
  deleted: boolean;
}> {}

/**
 * File sync request
 */
export interface FileSyncRequest extends BaseRequest {
  /** Files to sync */
  files: Array<{
    path: string;
    content?: string;
    operation: 'create' | 'update' | 'delete';
  }>;
}

/**
 * File sync response
 */
export interface FileSyncResponse extends BaseResponse<{
  /** Successfully synced files */
  synced: string[];

  /** Failed files */
  failed: Array<{
    path: string;
    error: string;
  }>;

  /** Sync summary */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}> {}

// ============================================================================
// Container Operations Contracts
// ============================================================================

/**
 * Container status
 */
export type ContainerStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'exited'
  | 'dead';

/**
 * Container resource limits
 */
export interface ContainerResources {
  /** CPU limit (cores) */
  cpuLimit?: number;

  /** Memory limit (MB) */
  memoryLimit?: number;

  /** Disk limit (GB) */
  diskLimit?: number;
}

/**
 * Container entity
 */
export interface Container {
  /** Container ID */
  id: EntityId;

  /** Container name */
  name: string;

  /** Container image */
  image: string;

  /** Container status */
  status: ContainerStatus;

  /** Associated workspace ID */
  workspaceId?: EntityId;

  /** Port mappings */
  ports?: Record<string, number>;

  /** Environment variables */
  env?: Record<string, string>;

  /** Resource limits */
  resources?: ContainerResources;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Start timestamp */
  startedAt?: Timestamp;

  /** Stop timestamp */
  stoppedAt?: Timestamp;
}

/**
 * Create container request
 */
export interface CreateContainerRequest extends BaseRequest {
  /** Container name */
  name: string;

  /** Container image */
  image: string;

  /** Workspace ID to associate */
  workspaceId?: EntityId;

  /** Port mappings */
  ports?: Record<string, number>;

  /** Environment variables */
  env?: Record<string, string>;

  /** Resource limits */
  resources?: ContainerResources;

  /** Whether to start immediately */
  autoStart?: boolean;
}

/**
 * Create container response
 */
export interface CreateContainerResponse extends BaseResponse<Container> {}

/**
 * Get container response
 */
export interface GetContainerResponse extends BaseResponse<Container> {}

/**
 * List containers request
 */
export interface ListContainersRequest extends PaginatedRequest {
  /** Filter by status */
  status?: ContainerStatus;

  /** Filter by workspace ID */
  workspaceId?: EntityId;

  /** Include stopped containers */
  includeExited?: boolean;
}

/**
 * List containers response
 */
export interface ListContainersResponse extends PaginatedResponse<Container> {}

/**
 * Container action request
 */
export interface ContainerActionRequest extends BaseRequest {
  /** Action to perform */
  action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove';

  /** Force action (for remove) */
  force?: boolean;

  /** Timeout in seconds */
  timeout?: number;
}

/**
 * Container action response
 */
export interface ContainerActionResponse extends BaseResponse<{
  /** Container ID */
  id: EntityId;

  /** Action performed */
  action: string;

  /** New status */
  status: ContainerStatus;
}> {}

// ============================================================================
// Session Management Contracts
// ============================================================================

/**
 * Session type
 */
export type SessionType = 'terminal' | 'ide' | 'agent' | 'code-server';

/**
 * Session status
 */
export type SessionStatus = 'active' | 'idle' | 'disconnected' | 'expired' | 'closed';

/**
 * Session entity
 */
export interface Session {
  /** Session ID */
  id: EntityId;

  /** Session type */
  type: SessionType;

  /** Session status */
  status: SessionStatus;

  /** Associated user ID */
  userId: EntityId;

  /** Associated workspace ID */
  workspaceId?: EntityId;

  /** Session metadata */
  metadata?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Timestamp;

  /** Last activity timestamp */
  lastActivityAt: Timestamp;

  /** Expiration timestamp */
  expiresAt?: Timestamp;
}

/**
 * Create session request
 */
export interface CreateSessionRequest extends BaseRequest {
  /** Session type */
  type: SessionType;

  /** Workspace ID to associate */
  workspaceId?: EntityId;

  /** Session TTL in seconds */
  ttl?: number;

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create session response
 */
export interface CreateSessionResponse extends BaseResponse<Session & {
  /** WebSocket URL for session */
  wsUrl?: string;

  /** HTTP URL for session */
  httpUrl?: string;

  /** Access token for session */
  token?: string;
}> {}

/**
 * Get session response
 */
export interface GetSessionResponse extends BaseResponse<Session> {}

/**
 * List sessions request
 */
export interface ListSessionsRequest extends PaginatedRequest {
  /** Filter by type */
  type?: SessionType;

  /** Filter by status */
  status?: SessionStatus;

  /** Filter by user ID */
  userId?: EntityId;

  /** Filter by workspace ID */
  workspaceId?: EntityId;
}

/**
 * List sessions response
 */
export interface ListSessionsResponse extends PaginatedResponse<Session> {}

// ============================================================================
// Operation Status Contracts
// ============================================================================

/**
 * Async operation result
 */
export interface AsyncOperationResponse extends BaseResponse<{
  /** Operation ID for tracking */
  operationId: EntityId;

  /** Operation status */
  status: OperationStatus;

  /** Progress percentage (0-100) */
  progress?: number;

  /** Status message */
  message?: string;

  /** Result data (if completed) */
  result?: unknown;

  /** Polling URL to check status */
  statusUrl?: string;
}> {}

/**
 * Batch operation request
 */
export interface BatchOperationRequest extends BaseRequest {
  /** Operations to perform */
  operations: Array<{
    id: string;
    type: string;
    params: Record<string, unknown>;
  }>;

  /** Whether to stop on first error */
  stopOnError?: boolean;
}

/**
 * Batch operation response
 */
export interface BatchOperationResponse extends BaseResponse<{
  /** Operation results */
  results: Array<{
    id: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;

  /** Batch summary */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}> {}
