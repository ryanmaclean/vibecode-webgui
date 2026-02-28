/**
 * Audit Service
 *
 * Core service for compliance audit logging with tamper-evident storage.
 * Provides log creation, querying, and hash chain verification.
 *
 * Architecture:
 * 1. Configuration & initialization
 * 2. Log creation with hash chain management
 * 3. Query operations with filtering
 * 4. Hash verification for integrity checks
 *
 * Compliance:
 * - SOC2: Complete audit trail with timestamps and user attribution
 * - HIPAA: Tamper-evident log storage via HMAC hash chain
 */

import { prisma } from '@/lib/prisma';
import { createServiceLogger, type ServiceLogger } from '@/lib/logging/service-logger';
import {
  type AuditLogEntry,
  type AuditLogFilter,
  type CreateAuditLogInput,
  type AuditContext,
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditOutcome,
  getDefaultCategory,
  getDefaultSeverity,
  createAuditLogInputSchema,
  auditLogFilterSchema,
} from './types';
import {
  computeAuditHash,
  createHashData,
  verifyEntryHash,
  verifyHashChain,
  getGenesisHash,
  type ChainVerificationResult,
  type EntryVerificationResult,
} from './tamper-evidence';
import { Prisma } from '@prisma/client';
import type { AuditLog as PrismaAuditLog } from '@prisma/client';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Audit service configuration
 */
export interface AuditServiceConfig {
  /** Whether to enable async (non-blocking) logging */
  asyncLogging?: boolean;
  /** Maximum retry attempts for failed log writes */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
  /** Whether to log service operations */
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<AuditServiceConfig> = {
  asyncLogging: false,
  maxRetries: 3,
  retryDelayMs: 100,
  debug: process.env.NODE_ENV === 'development',
};

// Check if we're in build mode - disable database operations during build
const isBuilding =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.argv.includes('build') ||
  process.env.BUILDING === 'true';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of creating an audit log entry
 */
export interface CreateAuditLogResult {
  /** Whether the log was created successfully */
  success: boolean;
  /** Created log entry (if successful) */
  entry?: AuditLogEntry;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Result of querying audit logs
 */
export interface QueryAuditLogsResult {
  /** Audit log entries matching the filter */
  entries: AuditLogEntry[];
  /** Total count of matching entries (for pagination) */
  totalCount: number;
  /** Whether there are more entries */
  hasMore: boolean;
}

/**
 * Verification options for hash chain verification
 */
export interface VerifyChainOptions {
  /** Start timestamp for verification range */
  startTime?: Date;
  /** End timestamp for verification range */
  endTime?: Date;
  /** Maximum entries to verify per batch */
  batchSize?: number;
  /** Whether to stop on first error */
  stopOnFirstError?: boolean;
}

// ============================================================================
// Service Logger
// ============================================================================

const logger: ServiceLogger = createServiceLogger({
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  component: 'audit-service',
});

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get the hash of the most recent audit log entry for chain continuity
 */
async function getLastAuditLogHash(): Promise<string | null> {
  if (isBuilding) {
    return null;
  }

  const lastEntry = await prisma.auditLog.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { hash: true },
  });

  return lastEntry?.hash ?? null;
}

/**
 * Transform a Prisma AuditLog record to an AuditLogEntry
 */
function transformPrismaRecord(record: PrismaAuditLog): AuditLogEntry {
  return {
    id: record.id,
    timestamp: record.timestamp,
    userId: record.user_id,
    action: record.action,
    resource: record.resource,
    ipAddress: record.ip_address,
    userAgent: record.user_agent,
    metadata: record.metadata as Record<string, unknown> | null,
    hash: record.hash,
    previousHash: record.previous_hash,
    severity: record.severity as AuditSeverity,
    category: record.category as AuditCategory,
    outcome: record.outcome as AuditOutcome,
    sessionId: record.session_id,
  };
}

/**
 * Build Prisma where clause from filter
 */
function buildWhereClause(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filter.userId !== undefined) {
    where.user_id = filter.userId;
  }

  if (filter.actions && filter.actions.length > 0) {
    where.action = { in: filter.actions };
  }

  if (filter.resource) {
    // Support wildcard matching (e.g., "project:*")
    if (filter.resource.includes('*')) {
      where.resource = {
        startsWith: filter.resource.replace('*', ''),
      };
    } else {
      where.resource = filter.resource;
    }
  }

  if (filter.category) {
    where.category = filter.category;
  }

  if (filter.severity) {
    where.severity = filter.severity;
  }

  if (filter.outcome) {
    where.outcome = filter.outcome;
  }

  if (filter.sessionId) {
    where.session_id = filter.sessionId;
  }

  // Time range filtering
  if (filter.startTime || filter.endTime) {
    where.timestamp = {};
    if (filter.startTime) {
      where.timestamp.gte = filter.startTime;
    }
    if (filter.endTime) {
      where.timestamp.lte = filter.endTime;
    }
  }

  return where;
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  delayMs: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Audit Service Class
// ============================================================================

/**
 * Audit Service interface
 */
export interface IAuditService {
  /** Create a new audit log entry */
  log(input: CreateAuditLogInput): Promise<CreateAuditLogResult>;

  /** Create an audit log entry without waiting (fire-and-forget) */
  logAsync(input: CreateAuditLogInput): void;

  /** Query audit logs with filtering and pagination */
  query(filter: AuditLogFilter): Promise<QueryAuditLogsResult>;

  /** Get a single audit log entry by ID */
  getById(id: string): Promise<AuditLogEntry | null>;

  /** Verify the hash of a single audit log entry */
  verifyEntry(id: string): Promise<EntryVerificationResult | null>;

  /** Verify the hash chain for a range of entries */
  verifyChain(options?: VerifyChainOptions): Promise<ChainVerificationResult>;

  /** Get the count of audit logs matching a filter */
  count(filter?: AuditLogFilter): Promise<number>;
}

/**
 * Audit Service implementation
 */
class AuditService implements IAuditService {
  private config: Required<AuditServiceConfig>;

  constructor(config: AuditServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new audit log entry with hash chain integrity
   */
  async log(input: CreateAuditLogInput): Promise<CreateAuditLogResult> {
    if (isBuilding) {
      return { success: true };
    }

    try {
      // Validate input
      const validated = createAuditLogInputSchema.parse(input);
      const timestamp = new Date();

      // Determine category and severity from action if not provided
      const action = validated.action;
      const category =
        validated.category ??
        (Object.values(AuditAction).includes(action as AuditAction)
          ? getDefaultCategory(action as AuditAction)
          : AuditCategory.GENERAL);
      const severity =
        validated.severity ??
        (Object.values(AuditAction).includes(action as AuditAction)
          ? getDefaultSeverity(action as AuditAction)
          : AuditSeverity.INFO);
      const outcome = validated.outcome ?? AuditOutcome.SUCCESS;

      // Get the previous hash for chain continuity
      const previousHash = await withRetry(
        () => getLastAuditLogHash(),
        this.config.maxRetries,
        this.config.retryDelayMs
      );

      // Use genesis hash if this is the first entry
      const effectivePreviousHash = previousHash ?? getGenesisHash();

      // Create hash data and compute hash
      const hashData = createHashData({
        timestamp,
        action: validated.action,
        resource: validated.resource,
        context: validated.context,
        metadata: validated.metadata ?? null,
        severity,
        category,
        outcome,
        previousHash: effectivePreviousHash,
      });

      const hash = computeAuditHash(hashData);

      // Create the database record
      const record = await withRetry(
        () =>
          prisma.auditLog.create({
            data: {
              timestamp,
              user_id: validated.context?.userId ?? null,
              action: validated.action,
              resource: validated.resource,
              ip_address: validated.context?.ipAddress ?? null,
              user_agent: validated.context?.userAgent ?? null,
              metadata: validated.metadata
                ? (validated.metadata as Prisma.InputJsonValue)
                : Prisma.DbNull,
              hash,
              previous_hash: effectivePreviousHash,
              severity,
              category,
              outcome,
              session_id: validated.context?.sessionId ?? null,
            },
          }),
        this.config.maxRetries,
        this.config.retryDelayMs
      );

      const entry = transformPrismaRecord(record);

      if (this.config.debug) {
        logger.debug('Audit log created', {
          id: entry.id,
          action: entry.action,
          resource: entry.resource,
        });
      }

      return { success: true, entry };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to create audit log', {
        error: errorMessage,
        action: input.action,
        resource: input.resource,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create an audit log entry asynchronously (fire-and-forget)
   * Errors are logged but not thrown
   */
  logAsync(input: CreateAuditLogInput): void {
    if (isBuilding) {
      return;
    }

    // Fire and forget - errors are logged internally
    this.log(input).catch((error) => {
      logger.error('Async audit log failed', {
        error: error instanceof Error ? error.message : String(error),
        action: input.action,
      });
    });
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async query(filter: AuditLogFilter): Promise<QueryAuditLogsResult> {
    if (isBuilding) {
      return { entries: [], totalCount: 0, hasMore: false };
    }

    try {
      // Validate filter
      const validated = auditLogFilterSchema.parse(filter);
      const where = buildWhereClause(validated);

      // Get total count for pagination
      const totalCount = await prisma.auditLog.count({ where });

      // Get paginated results
      const records = await prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: validated.limit,
        skip: validated.offset,
      });

      const entries = records.map(transformPrismaRecord);
      const hasMore = (validated.offset ?? 0) + entries.length < totalCount;

      return { entries, totalCount, hasMore };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to query audit logs', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get a single audit log entry by ID
   */
  async getById(id: string): Promise<AuditLogEntry | null> {
    if (isBuilding) {
      return null;
    }

    try {
      const record = await prisma.auditLog.findUnique({
        where: { id },
      });

      return record ? transformPrismaRecord(record) : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get audit log by ID', { error: errorMessage, id });
      throw error;
    }
  }

  /**
   * Verify the hash of a single audit log entry
   */
  async verifyEntry(id: string): Promise<EntryVerificationResult | null> {
    if (isBuilding) {
      return null;
    }

    try {
      const entry = await this.getById(id);

      if (!entry) {
        return null;
      }

      return verifyEntryHash(entry);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to verify audit log entry', { error: errorMessage, id });
      throw error;
    }
  }

  /**
   * Verify the hash chain for a range of entries
   */
  async verifyChain(options: VerifyChainOptions = {}): Promise<ChainVerificationResult> {
    if (isBuilding) {
      return {
        valid: true,
        entriesVerified: 0,
        firstInvalidIndex: null,
        invalidReason: null,
        invalidEntryId: null,
      };
    }

    const { startTime, endTime, batchSize = 1000, stopOnFirstError = true } = options;

    try {
      // Build where clause for time range
      const where: Prisma.AuditLogWhereInput = {};
      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) where.timestamp.gte = startTime;
        if (endTime) where.timestamp.lte = endTime;
      }

      // Get count for progress tracking
      const totalCount = await prisma.auditLog.count({ where });

      if (totalCount === 0) {
        return {
          valid: true,
          entriesVerified: 0,
          firstInvalidIndex: null,
          invalidReason: null,
          invalidEntryId: null,
        };
      }

      // Get the expected previous hash for the first entry in range
      let expectedPreviousHash: string | null = null;
      if (startTime) {
        const precedingEntry = await prisma.auditLog.findFirst({
          where: { timestamp: { lt: startTime } },
          orderBy: { timestamp: 'desc' },
          select: { hash: true },
        });
        expectedPreviousHash = precedingEntry?.hash ?? getGenesisHash();
      }

      // Process entries in batches
      let offset = 0;
      let totalVerified = 0;

      while (offset < totalCount) {
        const records = await prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'asc' },
          take: batchSize,
          skip: offset,
        });

        if (records.length === 0) break;

        const entries = records.map(transformPrismaRecord);
        const result = verifyHashChain(entries, expectedPreviousHash);

        if (!result.valid) {
          if (stopOnFirstError) {
            return {
              ...result,
              entriesVerified: totalVerified + result.entriesVerified,
              firstInvalidIndex:
                result.firstInvalidIndex !== null
                  ? totalVerified + result.firstInvalidIndex
                  : null,
            };
          }
        }

        totalVerified += entries.length;
        expectedPreviousHash = entries[entries.length - 1].hash;
        offset += batchSize;
      }

      return {
        valid: true,
        entriesVerified: totalVerified,
        firstInvalidIndex: null,
        invalidReason: null,
        invalidEntryId: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to verify hash chain', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get the count of audit logs matching a filter
   */
  async count(filter: AuditLogFilter = {}): Promise<number> {
    if (isBuilding) {
      return 0;
    }

    try {
      const validated = auditLogFilterSchema.parse(filter);
      const where = buildWhereClause(validated);
      return await prisma.auditLog.count({ where });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to count audit logs', { error: errorMessage });
      throw error;
    }
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

/**
 * Default audit service instance
 */
export const auditService: IAuditService = new AuditService();

/**
 * Create a new audit service with custom configuration
 */
export function createAuditService(config?: AuditServiceConfig): IAuditService {
  return new AuditService(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Log an audit event (convenience function)
 */
export async function logAudit(
  action: AuditAction | string,
  resource: string,
  context?: AuditContext,
  metadata?: Record<string, unknown>,
  options?: {
    severity?: AuditSeverity;
    category?: AuditCategory;
    outcome?: AuditOutcome;
  }
): Promise<CreateAuditLogResult> {
  return auditService.log({
    action,
    resource,
    context,
    metadata,
    severity: options?.severity,
    category: options?.category,
    outcome: options?.outcome,
  });
}

/**
 * Log an audit event asynchronously (fire-and-forget convenience function)
 */
export function logAuditAsync(
  action: AuditAction | string,
  resource: string,
  context?: AuditContext,
  metadata?: Record<string, unknown>,
  options?: {
    severity?: AuditSeverity;
    category?: AuditCategory;
    outcome?: AuditOutcome;
  }
): void {
  auditService.logAsync({
    action,
    resource,
    context,
    metadata,
    severity: options?.severity,
    category: options?.category,
    outcome: options?.outcome,
  });
}

/**
 * Query audit logs (convenience function)
 */
export async function queryAuditLogs(
  filter: AuditLogFilter
): Promise<QueryAuditLogsResult> {
  return auditService.query(filter);
}

/**
 * Verify audit log integrity (convenience function)
 */
export async function verifyAuditIntegrity(
  options?: VerifyChainOptions
): Promise<ChainVerificationResult> {
  return auditService.verifyChain(options);
}
