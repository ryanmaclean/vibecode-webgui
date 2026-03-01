/**
 * Shared Common Types for VibeCode Cross-Service Contracts
 *
 * Base type definitions used across all services including frontend,
 * desktop app, and backend services. Provides consistent interfaces
 * for requests, responses, pagination, and error handling.
 *
 * @module types/shared/common
 */

// ============================================================================
// Base Request/Response Types
// ============================================================================

/**
 * Base request interface for all API requests
 */
export interface BaseRequest {
  /** Request correlation ID for tracing (optional) */
  requestId?: string;

  /** Client timestamp (ISO 8601) */
  timestamp?: string;

  /** Client version identifier */
  clientVersion?: string;

  /** Additional metadata for tracking and debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Base response interface for all API responses
 */
export interface BaseResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;

  /** Response data (null if error) */
  data: T | null;

  /** Error information (null if success) */
  error: ApiError | null;

  /** Request correlation ID for tracing */
  requestId?: string;

  /** Server timestamp (ISO 8601) */
  timestamp: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;

  /** Items per page (default varies by endpoint) */
  limit?: number;

  /** Field to sort by */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated request interface
 */
export interface PaginatedRequest extends BaseRequest {
  /** Pagination parameters */
  pagination?: PaginationParams;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  currentPage: number;

  /** Items per page */
  pageSize: number;

  /** Total number of items */
  totalItems: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNextPage: boolean;

  /** Whether there is a previous page */
  hasPreviousPage: boolean;

  /** Next page number (null if no next page) */
  nextPage: number | null;

  /** Previous page number (null if no previous page) */
  previousPage: number | null;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T = unknown> extends BaseResponse<T[]> {
  /** Response data (array of items) */
  data: T[];

  /** Pagination metadata */
  pagination: PaginationMeta;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Error codes for API errors
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'BAD_REQUEST'
  | 'UNPROCESSABLE_ENTITY';

/**
 * API error structure
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: ErrorCode;

  /** Human-readable error message */
  message: string;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Additional error details */
  details?: Record<string, unknown>;

  /** Stack trace (only in development) */
  stack?: string;

  /** Timestamp when error occurred (ISO 8601) */
  timestamp?: string;

  /** Service/component where error originated */
  source?: string;
}

/**
 * Validation error field structure
 */
export interface ValidationErrorField {
  /** Field name that failed validation */
  field: string;

  /** Validation error message */
  message: string;

  /** Expected value or format */
  expected?: string;

  /** Actual value received */
  received?: unknown;

  /** Validation rule that failed */
  rule?: string;
}

/**
 * Validation error structure
 */
export interface ValidationError extends ApiError {
  /** Error code is always VALIDATION_ERROR */
  code: 'VALIDATION_ERROR';

  /** Array of field-level validation errors */
  fields: ValidationErrorField[];
}

// ============================================================================
// Common Utility Types
// ============================================================================

/**
 * Status for async operations
 */
export type OperationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Generic async operation result
 */
export interface OperationResult<T = unknown> {
  /** Operation status */
  status: OperationStatus;

  /** Result data (null if not completed) */
  result: T | null;

  /** Error information (null if no error) */
  error: ApiError | null;

  /** Progress percentage (0-100) */
  progress?: number;

  /** Human-readable status message */
  message?: string;

  /** Operation start time (ISO 8601) */
  startedAt?: string;

  /** Operation completion time (ISO 8601) */
  completedAt?: string | null;
}

/**
 * Generic ID type for entities
 */
export type EntityId = string;

/**
 * Timestamp type (ISO 8601 format)
 */
export type Timestamp = string;

/**
 * Generic entity with common fields
 */
export interface BaseEntity {
  /** Unique identifier */
  id: EntityId;

  /** Creation timestamp (ISO 8601) */
  createdAt: Timestamp;

  /** Last update timestamp (ISO 8601) */
  updatedAt: Timestamp;

  /** Soft delete timestamp (ISO 8601, null if not deleted) */
  deletedAt?: Timestamp | null;
}
