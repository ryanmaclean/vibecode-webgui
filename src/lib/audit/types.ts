/**
 * Audit Event Types for Compliance Logging
 *
 * Provides type definitions for audit logging supporting SOC2/HIPAA compliance.
 * These types align with the Prisma AuditLog model for database storage.
 */

import { z } from 'zod';

/**
 * Audit action categories representing high-level operation types.
 * Actions follow the pattern: category.operation (e.g., "user.login", "file.create")
 */
export enum AuditAction {
  // Authentication actions
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_LOGIN_FAILED = 'user.login_failed',
  USER_PASSWORD_CHANGE = 'user.password_change',
  USER_PASSWORD_RESET = 'user.password_reset',
  USER_MFA_ENABLED = 'user.mfa_enabled',
  USER_MFA_DISABLED = 'user.mfa_disabled',
  USER_SESSION_EXPIRED = 'user.session_expired',

  // User management actions
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_DEACTIVATED = 'user.deactivated',
  USER_ACTIVATED = 'user.activated',
  USER_ROLE_CHANGED = 'user.role_changed',

  // Project actions
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',
  PROJECT_ARCHIVED = 'project.archived',
  PROJECT_RESTORED = 'project.restored',
  PROJECT_MEMBER_ADDED = 'project.member_added',
  PROJECT_MEMBER_REMOVED = 'project.member_removed',

  // File actions
  FILE_CREATED = 'file.created',
  FILE_UPDATED = 'file.updated',
  FILE_DELETED = 'file.deleted',
  FILE_RESTORED = 'file.restored',
  FILE_ACCESSED = 'file.accessed',
  FILE_DOWNLOADED = 'file.downloaded',

  // AI operations
  AI_CHAT_REQUEST = 'ai.chat_request',
  AI_CHAT_RESPONSE = 'ai.chat_response',
  AI_CODE_GENERATION = 'ai.code_generation',
  AI_CODE_REVIEW = 'ai.code_review',
  AI_SUGGESTION_ACCEPTED = 'ai.suggestion_accepted',
  AI_SUGGESTION_REJECTED = 'ai.suggestion_rejected',
  AI_MODEL_CHANGED = 'ai.model_changed',

  // Admin actions
  ADMIN_SETTINGS_CHANGED = 'admin.settings_changed',
  ADMIN_BACKUP_CREATED = 'admin.backup_created',
  ADMIN_BACKUP_RESTORED = 'admin.backup_restored',
  ADMIN_EXPORT_REQUESTED = 'admin.export_requested',
  ADMIN_AUDIT_LOG_VIEWED = 'admin.audit_log_viewed',
  ADMIN_RETENTION_POLICY_CHANGED = 'admin.retention_policy_changed',

  // System actions
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_MAINTENANCE = 'system.maintenance',

  // API actions
  API_KEY_CREATED = 'api.key_created',
  API_KEY_REVOKED = 'api.key_revoked',
  API_REQUEST = 'api.request',
  API_RATE_LIMITED = 'api.rate_limited',
}

/**
 * Audit severity levels for compliance reporting and alerting
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Audit categories for organizing and filtering audit logs
 */
export enum AuditCategory {
  AUTH = 'auth',
  DATA_ACCESS = 'data_access',
  ADMIN = 'admin',
  SYSTEM = 'system',
  AI_OPERATIONS = 'ai_operations',
  API = 'api',
  GENERAL = 'general',
}

/**
 * Audit outcome indicating whether the action succeeded or failed
 */
export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  ERROR = 'error',
}

/**
 * Audit log entry representing a single audit event.
 * Matches the Prisma AuditLog model for database storage.
 */
export interface AuditLogEntry {
  /** Unique identifier (UUID) */
  id: string;
  /** Timestamp of when the event occurred */
  timestamp: Date;
  /** User ID who performed the action (null for system/anonymous actions) */
  userId: number | null;
  /** The action that was performed */
  action: AuditAction | string;
  /** Resource type and identifier (e.g., "project:123", "file:456") */
  resource: string;
  /** Client IP address */
  ipAddress: string | null;
  /** Client user agent string */
  userAgent: string | null;
  /** Additional context (request params, before/after states, etc.) */
  metadata: Record<string, unknown> | null;
  /** SHA-256 hash for tamper evidence */
  hash: string;
  /** Previous log hash for chain integrity */
  previousHash: string | null;
  /** Event severity level */
  severity: AuditSeverity;
  /** Event category */
  category: AuditCategory;
  /** Action outcome */
  outcome: AuditOutcome;
  /** Session ID for correlation */
  sessionId: string | null;
}

/**
 * Context for creating an audit log entry.
 * Contains request-scoped information needed for audit logging.
 */
export interface AuditContext {
  /** User ID who performed the action */
  userId?: number | null;
  /** Client IP address */
  ipAddress?: string | null;
  /** Client user agent string */
  userAgent?: string | null;
  /** Session ID for correlation */
  sessionId?: string | null;
  /** Request ID for tracing */
  requestId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
}

/**
 * Input for creating a new audit log entry
 */
export interface CreateAuditLogInput {
  /** The action that was performed */
  action: AuditAction | string;
  /** Resource type and identifier */
  resource: string;
  /** Audit context (user, IP, etc.) */
  context?: AuditContext;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Event severity (defaults to INFO) */
  severity?: AuditSeverity;
  /** Event category (defaults to GENERAL) */
  category?: AuditCategory;
  /** Action outcome (defaults to SUCCESS) */
  outcome?: AuditOutcome;
}

/**
 * Filter options for querying audit logs
 */
export interface AuditLogFilter {
  /** Filter by user ID */
  userId?: number;
  /** Filter by action(s) */
  actions?: (AuditAction | string)[];
  /** Filter by resource pattern (supports wildcards) */
  resource?: string;
  /** Filter by category */
  category?: AuditCategory;
  /** Filter by severity */
  severity?: AuditSeverity;
  /** Filter by outcome */
  outcome?: AuditOutcome;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by start timestamp */
  startTime?: Date;
  /** Filter by end timestamp */
  endTime?: Date;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Zod schema for validating audit actions
 */
export const auditActionSchema = z.nativeEnum(AuditAction).or(z.string().min(1).max(100));

/**
 * Zod schema for validating audit severity
 */
export const auditSeveritySchema = z.nativeEnum(AuditSeverity);

/**
 * Zod schema for validating audit category
 */
export const auditCategorySchema = z.nativeEnum(AuditCategory);

/**
 * Zod schema for validating audit outcome
 */
export const auditOutcomeSchema = z.nativeEnum(AuditOutcome);

/**
 * Zod schema for validating audit context
 */
export const auditContextSchema = z.object({
  userId: z.number().int().nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(), // IPv6 max length
  userAgent: z.string().max(500).nullable().optional(),
  sessionId: z.string().max(100).nullable().optional(),
  requestId: z.string().max(100).optional(),
  traceId: z.string().max(100).optional(),
});

/**
 * Zod schema for validating create audit log input
 */
export const createAuditLogInputSchema = z.object({
  action: auditActionSchema,
  resource: z.string().min(1).max(500),
  context: auditContextSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  severity: auditSeveritySchema.optional().default(AuditSeverity.INFO),
  category: auditCategorySchema.optional().default(AuditCategory.GENERAL),
  outcome: auditOutcomeSchema.optional().default(AuditOutcome.SUCCESS),
});

/**
 * Zod schema for validating audit log filter
 */
export const auditLogFilterSchema = z.object({
  userId: z.number().int().optional(),
  actions: z.array(auditActionSchema).optional(),
  resource: z.string().max(500).optional(),
  category: auditCategorySchema.optional(),
  severity: auditSeveritySchema.optional(),
  outcome: auditOutcomeSchema.optional(),
  sessionId: z.string().max(100).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

// Type inference from Zod schemas
export type ValidatedAuditContext = z.infer<typeof auditContextSchema>;
export type ValidatedCreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;
export type ValidatedAuditLogFilter = z.infer<typeof auditLogFilterSchema>;

/**
 * Map audit actions to their default categories
 */
export const ACTION_CATEGORY_MAP: Record<AuditAction, AuditCategory> = {
  // Auth actions
  [AuditAction.USER_LOGIN]: AuditCategory.AUTH,
  [AuditAction.USER_LOGOUT]: AuditCategory.AUTH,
  [AuditAction.USER_LOGIN_FAILED]: AuditCategory.AUTH,
  [AuditAction.USER_PASSWORD_CHANGE]: AuditCategory.AUTH,
  [AuditAction.USER_PASSWORD_RESET]: AuditCategory.AUTH,
  [AuditAction.USER_MFA_ENABLED]: AuditCategory.AUTH,
  [AuditAction.USER_MFA_DISABLED]: AuditCategory.AUTH,
  [AuditAction.USER_SESSION_EXPIRED]: AuditCategory.AUTH,

  // User management actions
  [AuditAction.USER_CREATED]: AuditCategory.ADMIN,
  [AuditAction.USER_UPDATED]: AuditCategory.ADMIN,
  [AuditAction.USER_DELETED]: AuditCategory.ADMIN,
  [AuditAction.USER_DEACTIVATED]: AuditCategory.ADMIN,
  [AuditAction.USER_ACTIVATED]: AuditCategory.ADMIN,
  [AuditAction.USER_ROLE_CHANGED]: AuditCategory.ADMIN,

  // Project actions
  [AuditAction.PROJECT_CREATED]: AuditCategory.DATA_ACCESS,
  [AuditAction.PROJECT_UPDATED]: AuditCategory.DATA_ACCESS,
  [AuditAction.PROJECT_DELETED]: AuditCategory.DATA_ACCESS,
  [AuditAction.PROJECT_ARCHIVED]: AuditCategory.DATA_ACCESS,
  [AuditAction.PROJECT_RESTORED]: AuditCategory.DATA_ACCESS,
  [AuditAction.PROJECT_MEMBER_ADDED]: AuditCategory.DATA_ACCESS,
  [AuditAction.PROJECT_MEMBER_REMOVED]: AuditCategory.DATA_ACCESS,

  // File actions
  [AuditAction.FILE_CREATED]: AuditCategory.DATA_ACCESS,
  [AuditAction.FILE_UPDATED]: AuditCategory.DATA_ACCESS,
  [AuditAction.FILE_DELETED]: AuditCategory.DATA_ACCESS,
  [AuditAction.FILE_RESTORED]: AuditCategory.DATA_ACCESS,
  [AuditAction.FILE_ACCESSED]: AuditCategory.DATA_ACCESS,
  [AuditAction.FILE_DOWNLOADED]: AuditCategory.DATA_ACCESS,

  // AI operations
  [AuditAction.AI_CHAT_REQUEST]: AuditCategory.AI_OPERATIONS,
  [AuditAction.AI_CHAT_RESPONSE]: AuditCategory.AI_OPERATIONS,
  [AuditAction.AI_CODE_GENERATION]: AuditCategory.AI_OPERATIONS,
  [AuditAction.AI_CODE_REVIEW]: AuditCategory.AI_OPERATIONS,
  [AuditAction.AI_SUGGESTION_ACCEPTED]: AuditCategory.AI_OPERATIONS,
  [AuditAction.AI_SUGGESTION_REJECTED]: AuditCategory.AI_OPERATIONS,
  [AuditAction.AI_MODEL_CHANGED]: AuditCategory.AI_OPERATIONS,

  // Admin actions
  [AuditAction.ADMIN_SETTINGS_CHANGED]: AuditCategory.ADMIN,
  [AuditAction.ADMIN_BACKUP_CREATED]: AuditCategory.ADMIN,
  [AuditAction.ADMIN_BACKUP_RESTORED]: AuditCategory.ADMIN,
  [AuditAction.ADMIN_EXPORT_REQUESTED]: AuditCategory.ADMIN,
  [AuditAction.ADMIN_AUDIT_LOG_VIEWED]: AuditCategory.ADMIN,
  [AuditAction.ADMIN_RETENTION_POLICY_CHANGED]: AuditCategory.ADMIN,

  // System actions
  [AuditAction.SYSTEM_STARTUP]: AuditCategory.SYSTEM,
  [AuditAction.SYSTEM_SHUTDOWN]: AuditCategory.SYSTEM,
  [AuditAction.SYSTEM_ERROR]: AuditCategory.SYSTEM,
  [AuditAction.SYSTEM_MAINTENANCE]: AuditCategory.SYSTEM,

  // API actions
  [AuditAction.API_KEY_CREATED]: AuditCategory.API,
  [AuditAction.API_KEY_REVOKED]: AuditCategory.API,
  [AuditAction.API_REQUEST]: AuditCategory.API,
  [AuditAction.API_RATE_LIMITED]: AuditCategory.API,
};

/**
 * Map audit actions to their default severity levels
 */
export const ACTION_SEVERITY_MAP: Record<AuditAction, AuditSeverity> = {
  // Auth actions - login failures are warnings
  [AuditAction.USER_LOGIN]: AuditSeverity.INFO,
  [AuditAction.USER_LOGOUT]: AuditSeverity.INFO,
  [AuditAction.USER_LOGIN_FAILED]: AuditSeverity.WARNING,
  [AuditAction.USER_PASSWORD_CHANGE]: AuditSeverity.INFO,
  [AuditAction.USER_PASSWORD_RESET]: AuditSeverity.WARNING,
  [AuditAction.USER_MFA_ENABLED]: AuditSeverity.INFO,
  [AuditAction.USER_MFA_DISABLED]: AuditSeverity.WARNING,
  [AuditAction.USER_SESSION_EXPIRED]: AuditSeverity.INFO,

  // User management - deletions are critical
  [AuditAction.USER_CREATED]: AuditSeverity.INFO,
  [AuditAction.USER_UPDATED]: AuditSeverity.INFO,
  [AuditAction.USER_DELETED]: AuditSeverity.CRITICAL,
  [AuditAction.USER_DEACTIVATED]: AuditSeverity.WARNING,
  [AuditAction.USER_ACTIVATED]: AuditSeverity.INFO,
  [AuditAction.USER_ROLE_CHANGED]: AuditSeverity.WARNING,

  // Project actions - deletions are critical
  [AuditAction.PROJECT_CREATED]: AuditSeverity.INFO,
  [AuditAction.PROJECT_UPDATED]: AuditSeverity.INFO,
  [AuditAction.PROJECT_DELETED]: AuditSeverity.CRITICAL,
  [AuditAction.PROJECT_ARCHIVED]: AuditSeverity.INFO,
  [AuditAction.PROJECT_RESTORED]: AuditSeverity.INFO,
  [AuditAction.PROJECT_MEMBER_ADDED]: AuditSeverity.INFO,
  [AuditAction.PROJECT_MEMBER_REMOVED]: AuditSeverity.INFO,

  // File actions - deletions are critical
  [AuditAction.FILE_CREATED]: AuditSeverity.INFO,
  [AuditAction.FILE_UPDATED]: AuditSeverity.INFO,
  [AuditAction.FILE_DELETED]: AuditSeverity.CRITICAL,
  [AuditAction.FILE_RESTORED]: AuditSeverity.INFO,
  [AuditAction.FILE_ACCESSED]: AuditSeverity.INFO,
  [AuditAction.FILE_DOWNLOADED]: AuditSeverity.INFO,

  // AI operations
  [AuditAction.AI_CHAT_REQUEST]: AuditSeverity.INFO,
  [AuditAction.AI_CHAT_RESPONSE]: AuditSeverity.INFO,
  [AuditAction.AI_CODE_GENERATION]: AuditSeverity.INFO,
  [AuditAction.AI_CODE_REVIEW]: AuditSeverity.INFO,
  [AuditAction.AI_SUGGESTION_ACCEPTED]: AuditSeverity.INFO,
  [AuditAction.AI_SUGGESTION_REJECTED]: AuditSeverity.INFO,
  [AuditAction.AI_MODEL_CHANGED]: AuditSeverity.INFO,

  // Admin actions - most are critical
  [AuditAction.ADMIN_SETTINGS_CHANGED]: AuditSeverity.CRITICAL,
  [AuditAction.ADMIN_BACKUP_CREATED]: AuditSeverity.INFO,
  [AuditAction.ADMIN_BACKUP_RESTORED]: AuditSeverity.CRITICAL,
  [AuditAction.ADMIN_EXPORT_REQUESTED]: AuditSeverity.INFO,
  [AuditAction.ADMIN_AUDIT_LOG_VIEWED]: AuditSeverity.INFO,
  [AuditAction.ADMIN_RETENTION_POLICY_CHANGED]: AuditSeverity.CRITICAL,

  // System actions - errors are critical
  [AuditAction.SYSTEM_STARTUP]: AuditSeverity.INFO,
  [AuditAction.SYSTEM_SHUTDOWN]: AuditSeverity.WARNING,
  [AuditAction.SYSTEM_ERROR]: AuditSeverity.CRITICAL,
  [AuditAction.SYSTEM_MAINTENANCE]: AuditSeverity.INFO,

  // API actions - rate limiting is warning
  [AuditAction.API_KEY_CREATED]: AuditSeverity.INFO,
  [AuditAction.API_KEY_REVOKED]: AuditSeverity.WARNING,
  [AuditAction.API_REQUEST]: AuditSeverity.INFO,
  [AuditAction.API_RATE_LIMITED]: AuditSeverity.WARNING,
};

/**
 * Get the default category for an audit action
 */
export function getDefaultCategory(action: AuditAction): AuditCategory {
  return ACTION_CATEGORY_MAP[action] ?? AuditCategory.GENERAL;
}

/**
 * Get the default severity for an audit action
 */
export function getDefaultSeverity(action: AuditAction): AuditSeverity {
  return ACTION_SEVERITY_MAP[action] ?? AuditSeverity.INFO;
}

/**
 * Format a resource identifier
 * @param type Resource type (e.g., "project", "file", "user")
 * @param id Resource identifier
 * @returns Formatted resource string (e.g., "project:123")
 */
export function formatResourceId(type: string, id: string | number): string {
  return `${type}:${id}`;
}

/**
 * Parse a resource identifier
 * @param resource Resource string (e.g., "project:123")
 * @returns Parsed resource type and id, or null if invalid
 */
export function parseResourceId(resource: string): { type: string; id: string } | null {
  const colonIndex = resource.indexOf(':');
  if (colonIndex === -1 || colonIndex === 0 || colonIndex === resource.length - 1) {
    return null;
  }
  return {
    type: resource.substring(0, colonIndex),
    id: resource.substring(colonIndex + 1),
  };
}
