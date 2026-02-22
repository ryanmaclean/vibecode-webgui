/**
 * Compliance Audit Logging for VibeCode WebGUI
 *
 * This module provides SOC2/HIPAA-compliant audit logging across the application.
 * It includes tamper-evident storage via HMAC hash chains and supports:
 * - Comprehensive audit event types for user, project, file, AI, and system actions
 * - Hash chain verification for tamper evidence detection
 * - Configurable retention policies per category with compliance minimums
 * - CSV and JSON export for compliance tool integration
 *
 * Usage:
 *   import {
 *     auditService,
 *     logAudit,
 *     AuditAction,
 *     exportAuditLogs,
 *     ExportFormat
 *   } from '@/lib/audit';
 */

// Types and enums
export {
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditOutcome,
  type AuditLogEntry,
  type AuditContext,
  type CreateAuditLogInput,
  type AuditLogFilter,
  type ValidatedAuditContext,
  type ValidatedCreateAuditLogInput,
  type ValidatedAuditLogFilter,
  auditActionSchema,
  auditSeveritySchema,
  auditCategorySchema,
  auditOutcomeSchema,
  auditContextSchema,
  createAuditLogInputSchema,
  auditLogFilterSchema,
  ACTION_CATEGORY_MAP,
  ACTION_SEVERITY_MAP,
  getDefaultCategory,
  getDefaultSeverity,
  formatResourceId,
  parseResourceId,
} from './types';

// Audit service
export {
  auditService,
  createAuditService,
  logAudit,
  logAuditAsync,
  queryAuditLogs,
  verifyAuditIntegrity,
  type AuditServiceConfig,
  type CreateAuditLogResult,
  type QueryAuditLogsResult,
  type VerifyChainOptions,
  type IAuditService,
} from './service';

// Tamper evidence
export {
  computeAuditHash,
  entryToHashData,
  verifyEntryHash,
  verifyHashChain,
  getGenesisHash,
  createHashData,
  generateHmacKey,
  isConfigured,
  getConfigurationStatus,
  type AuditHashData,
  type ChainVerificationResult,
  type EntryVerificationResult,
} from './tamper-evidence';

// Retention policy
export {
  retentionService,
  createRetentionService,
  getRetentionDays,
  getRetentionCutoffDate,
  runRetentionCleanup,
  getRetentionStats,
  estimateRetentionCleanup,
  DEFAULT_RETENTION_DAYS,
  MINIMUM_RETENTION_DAYS,
  categoryRetentionPolicySchema,
  retentionPolicyConfigSchema,
  type CategoryRetentionPolicy,
  type RetentionPolicyConfig,
  type CleanupResult,
  type RetentionStats,
  type CleanupJobStatus,
  type IRetentionPolicyService,
  type CleanupOptions,
  type CleanupEstimate,
} from './retention';

// Export functionality
export {
  ExportFormat,
  exportAuditLogs,
  exportToCSV,
  exportToJSON,
  streamAuditLogs,
  getExportExtension,
  getExportContentType,
  generateExportFilename,
  parseExportFormat,
  exportFormatSchema,
  exportOptionsSchema,
  type ExportOptions,
  type ExportResult,
  type ExportMetadata,
  type StreamingExportHandler,
  type ValidatedExportOptions,
} from './export';

// Audit middleware
export {
  withAuditLogging,
  withAIAuditLogging,
  withAdminAuditLogging,
  withDataAccessAuditLogging,
  createAuditContextFromRequest,
  logAuditFromRequest,
  composeMiddleware,
  type AuditedRequest,
  type AuditMiddlewareOptions,
  type AIAuditOptions,
  type AdminAuditOptions,
} from './middleware';
