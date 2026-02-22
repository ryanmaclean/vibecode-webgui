/**
 * Audit Log Retention Policy Service
 *
 * Provides configurable log retention and cleanup for compliance requirements.
 * Supports SOC2/HIPAA compliance with flexible retention policies per category.
 *
 * Architecture:
 * - Configuration-driven retention policies
 * - Scheduled cleanup with batch processing
 * - Metrics integration for monitoring
 * - Safe deletion with audit trail preservation
 *
 * Compliance Notes:
 * - SOC2: Minimum 90-day retention for audit logs
 * - HIPAA: Minimum 6-year retention for PHI access logs
 * - Custom policies can extend but not reduce minimum retention
 */

import { prisma } from '@/lib/prisma';
import { createServiceLogger, type ServiceLogger } from '@/lib/logging/service-logger';
import { metrics } from '@/lib/server-monitoring';
import { AuditCategory, AuditSeverity, AuditAction } from './types';
import { auditService } from './service';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default retention periods in days
 * These represent minimum compliance requirements
 */
export const DEFAULT_RETENTION_DAYS = {
  /** Default retention for all logs (SOC2 minimum) */
  DEFAULT: 90,
  /** Authentication logs (SOC2) */
  AUTH: 365,
  /** Admin actions (critical operations) */
  ADMIN: 730, // 2 years
  /** System logs */
  SYSTEM: 180,
  /** Data access logs (HIPAA consideration) */
  DATA_ACCESS: 2190, // 6 years for HIPAA
  /** AI operation logs */
  AI_OPERATIONS: 365,
  /** API logs */
  API: 90,
  /** General logs */
  GENERAL: 90,
} as const;

/**
 * Minimum retention periods that cannot be reduced
 * These ensure compliance requirements are always met
 */
export const MINIMUM_RETENTION_DAYS = {
  /** Absolute minimum for any log */
  ABSOLUTE: 30,
  /** SOC2 minimum */
  SOC2: 90,
  /** HIPAA minimum for PHI */
  HIPAA: 2190, // 6 years
  /** Critical actions minimum */
  CRITICAL: 365,
} as const;

// Check if we're in build mode
const isBuilding =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.argv.includes('build') ||
  process.env.BUILDING === 'true';

// ============================================================================
// Types
// ============================================================================

/**
 * Retention policy configuration for a specific category
 */
export interface CategoryRetentionPolicy {
  /** Category this policy applies to */
  category: AuditCategory;
  /** Retention period in days */
  retentionDays: number;
  /** Whether this category is subject to HIPAA requirements */
  hipaaCompliant?: boolean;
  /** Optional override for critical severity logs */
  criticalRetentionDays?: number;
}

/**
 * Full retention policy configuration
 */
export interface RetentionPolicyConfig {
  /** Default retention days for unspecified categories */
  defaultRetentionDays: number;
  /** Category-specific retention policies */
  categoryPolicies: CategoryRetentionPolicy[];
  /** Whether to enforce HIPAA compliance minimums */
  enforceHipaaCompliance: boolean;
  /** Whether to enforce SOC2 compliance minimums */
  enforceSoc2Compliance: boolean;
  /** Maximum batch size for cleanup operations */
  cleanupBatchSize: number;
  /** Delay between batches in milliseconds */
  batchDelayMs: number;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Whether the cleanup completed successfully */
  success: boolean;
  /** Total logs deleted */
  deletedCount: number;
  /** Logs deleted by category */
  deletedByCategory: Record<string, number>;
  /** Time range of deleted logs */
  deletedTimeRange?: {
    oldest: Date;
    newest: Date;
  };
  /** Duration of cleanup in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Whether cleanup was stopped early */
  stoppedEarly?: boolean;
}

/**
 * Retention statistics for monitoring
 */
export interface RetentionStats {
  /** Total audit logs in database */
  totalLogs: number;
  /** Logs by category with counts */
  logsByCategory: Record<string, number>;
  /** Logs pending deletion (past retention) */
  pendingDeletion: number;
  /** Oldest log timestamp */
  oldestLog?: Date;
  /** Newest log timestamp */
  newestLog?: Date;
  /** Storage estimate in bytes (approximate) */
  estimatedStorageBytes?: number;
}

/**
 * Cleanup job status
 */
export interface CleanupJobStatus {
  /** Whether a cleanup is currently running */
  isRunning: boolean;
  /** Last cleanup timestamp */
  lastCleanupAt?: Date;
  /** Last cleanup result */
  lastResult?: CleanupResult;
  /** Next scheduled cleanup (if applicable) */
  nextScheduledAt?: Date;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const categoryRetentionPolicySchema = z.object({
  category: z.nativeEnum(AuditCategory),
  retentionDays: z.number().int().min(1),
  hipaaCompliant: z.boolean().optional(),
  criticalRetentionDays: z.number().int().min(1).optional(),
});

export const retentionPolicyConfigSchema = z.object({
  defaultRetentionDays: z.number().int().min(MINIMUM_RETENTION_DAYS.ABSOLUTE),
  categoryPolicies: z.array(categoryRetentionPolicySchema),
  enforceHipaaCompliance: z.boolean(),
  enforceSoc2Compliance: z.boolean(),
  cleanupBatchSize: z.number().int().min(1).max(10000).default(1000),
  batchDelayMs: z.number().int().min(0).max(60000).default(100),
});

// ============================================================================
// Service Logger
// ============================================================================

const logger: ServiceLogger = createServiceLogger({
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  component: 'audit-retention',
});

// ============================================================================
// Retention Policy Service
// ============================================================================

/**
 * Interface for the retention policy service
 */
export interface IRetentionPolicyService {
  /** Get the current retention policy configuration */
  getPolicy(): RetentionPolicyConfig;

  /** Update the retention policy configuration */
  setPolicy(config: Partial<RetentionPolicyConfig>): void;

  /** Get the effective retention days for a category and severity */
  getEffectiveRetentionDays(category: AuditCategory, severity?: AuditSeverity): number;

  /** Get the cutoff date for a category (logs older than this should be deleted) */
  getCutoffDate(category: AuditCategory, severity?: AuditSeverity): Date;

  /** Run cleanup operation to delete logs past retention */
  runCleanup(options?: CleanupOptions): Promise<CleanupResult>;

  /** Get retention statistics */
  getStats(): Promise<RetentionStats>;

  /** Get cleanup job status */
  getJobStatus(): CleanupJobStatus;

  /** Estimate cleanup impact without performing deletion */
  estimateCleanup(): Promise<CleanupEstimate>;
}

/**
 * Options for cleanup operation
 */
export interface CleanupOptions {
  /** Only clean up specific categories */
  categories?: AuditCategory[];
  /** Dry run - calculate what would be deleted without deleting */
  dryRun?: boolean;
  /** Maximum logs to delete (safety limit) */
  maxDeletes?: number;
  /** Custom cutoff date override (for testing) */
  cutoffDateOverride?: Date;
}

/**
 * Estimate of what cleanup would delete
 */
export interface CleanupEstimate {
  /** Total logs that would be deleted */
  totalToDelete: number;
  /** Logs to delete by category */
  byCategory: Record<string, number>;
  /** Oldest log that would be deleted */
  oldestToDelete?: Date;
  /** Newest log that would be deleted */
  newestToDelete?: Date;
}

/**
 * Retention Policy Service implementation
 */
class RetentionPolicyService implements IRetentionPolicyService {
  private policy: RetentionPolicyConfig;
  private isCleanupRunning = false;
  private lastCleanupAt?: Date;
  private lastCleanupResult?: CleanupResult;

  constructor(initialPolicy?: Partial<RetentionPolicyConfig>) {
    // Initialize with default policy
    this.policy = {
      defaultRetentionDays: DEFAULT_RETENTION_DAYS.DEFAULT,
      categoryPolicies: [
        { category: AuditCategory.AUTH, retentionDays: DEFAULT_RETENTION_DAYS.AUTH },
        { category: AuditCategory.ADMIN, retentionDays: DEFAULT_RETENTION_DAYS.ADMIN, criticalRetentionDays: DEFAULT_RETENTION_DAYS.ADMIN },
        { category: AuditCategory.SYSTEM, retentionDays: DEFAULT_RETENTION_DAYS.SYSTEM },
        { category: AuditCategory.DATA_ACCESS, retentionDays: DEFAULT_RETENTION_DAYS.DATA_ACCESS, hipaaCompliant: true },
        { category: AuditCategory.AI_OPERATIONS, retentionDays: DEFAULT_RETENTION_DAYS.AI_OPERATIONS },
        { category: AuditCategory.API, retentionDays: DEFAULT_RETENTION_DAYS.API },
        { category: AuditCategory.GENERAL, retentionDays: DEFAULT_RETENTION_DAYS.GENERAL },
      ],
      enforceHipaaCompliance: true,
      enforceSoc2Compliance: true,
      cleanupBatchSize: 1000,
      batchDelayMs: 100,
      ...initialPolicy,
    };

    // Load policy from environment if available
    this.loadPolicyFromEnv();
  }

  /**
   * Load retention policy overrides from environment variables
   */
  private loadPolicyFromEnv(): void {
    const envRetentionDays = process.env.AUDIT_DEFAULT_RETENTION_DAYS;
    if (envRetentionDays) {
      const days = parseInt(envRetentionDays, 10);
      if (!isNaN(days) && days >= MINIMUM_RETENTION_DAYS.ABSOLUTE) {
        this.policy.defaultRetentionDays = days;
      }
    }

    const envHipaaCompliance = process.env.AUDIT_ENFORCE_HIPAA;
    if (envHipaaCompliance !== undefined) {
      this.policy.enforceHipaaCompliance = envHipaaCompliance === 'true';
    }

    const envSoc2Compliance = process.env.AUDIT_ENFORCE_SOC2;
    if (envSoc2Compliance !== undefined) {
      this.policy.enforceSoc2Compliance = envSoc2Compliance === 'true';
    }

    const envBatchSize = process.env.AUDIT_CLEANUP_BATCH_SIZE;
    if (envBatchSize) {
      const batchSize = parseInt(envBatchSize, 10);
      if (!isNaN(batchSize) && batchSize >= 1 && batchSize <= 10000) {
        this.policy.cleanupBatchSize = batchSize;
      }
    }
  }

  /**
   * Get the current retention policy configuration
   */
  getPolicy(): RetentionPolicyConfig {
    return { ...this.policy };
  }

  /**
   * Update the retention policy configuration
   */
  setPolicy(config: Partial<RetentionPolicyConfig>): void {
    // Validate the new config
    const newPolicy = { ...this.policy, ...config };

    // Enforce minimum retention periods
    if (newPolicy.defaultRetentionDays < MINIMUM_RETENTION_DAYS.ABSOLUTE) {
      newPolicy.defaultRetentionDays = MINIMUM_RETENTION_DAYS.ABSOLUTE;
    }

    // Validate category policies
    if (config.categoryPolicies) {
      newPolicy.categoryPolicies = config.categoryPolicies.map((cp) => {
        let effectiveRetention = cp.retentionDays;

        // Enforce SOC2 minimum
        if (newPolicy.enforceSoc2Compliance && effectiveRetention < MINIMUM_RETENTION_DAYS.SOC2) {
          effectiveRetention = MINIMUM_RETENTION_DAYS.SOC2;
        }

        // Enforce HIPAA minimum for compliant categories
        if (newPolicy.enforceHipaaCompliance && cp.hipaaCompliant && effectiveRetention < MINIMUM_RETENTION_DAYS.HIPAA) {
          effectiveRetention = MINIMUM_RETENTION_DAYS.HIPAA;
        }

        return {
          ...cp,
          retentionDays: effectiveRetention,
        };
      });
    }

    this.policy = newPolicy;

    logger.info('Retention policy updated', {
      defaultRetentionDays: newPolicy.defaultRetentionDays,
      categoryCount: newPolicy.categoryPolicies.length,
      hipaaEnforced: newPolicy.enforceHipaaCompliance,
      soc2Enforced: newPolicy.enforceSoc2Compliance,
    });

    metrics.increment('audit.retention.policy_updated');
  }

  /**
   * Get the effective retention days for a category and severity
   */
  getEffectiveRetentionDays(category: AuditCategory, severity?: AuditSeverity): number {
    const categoryPolicy = this.policy.categoryPolicies.find((cp) => cp.category === category);

    let retentionDays = categoryPolicy?.retentionDays ?? this.policy.defaultRetentionDays;

    // Use critical retention override if applicable
    if (severity === AuditSeverity.CRITICAL && categoryPolicy?.criticalRetentionDays) {
      retentionDays = Math.max(retentionDays, categoryPolicy.criticalRetentionDays);
    }

    // Enforce compliance minimums
    if (this.policy.enforceSoc2Compliance) {
      retentionDays = Math.max(retentionDays, MINIMUM_RETENTION_DAYS.SOC2);
    }

    if (this.policy.enforceHipaaCompliance && categoryPolicy?.hipaaCompliant) {
      retentionDays = Math.max(retentionDays, MINIMUM_RETENTION_DAYS.HIPAA);
    }

    if (severity === AuditSeverity.CRITICAL) {
      retentionDays = Math.max(retentionDays, MINIMUM_RETENTION_DAYS.CRITICAL);
    }

    return retentionDays;
  }

  /**
   * Get the cutoff date for a category (logs older than this should be deleted)
   */
  getCutoffDate(category: AuditCategory, severity?: AuditSeverity): Date {
    const retentionDays = this.getEffectiveRetentionDays(category, severity);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    cutoff.setHours(0, 0, 0, 0); // Start of day
    return cutoff;
  }

  /**
   * Run cleanup operation to delete logs past retention
   */
  async runCleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    if (isBuilding) {
      return {
        success: true,
        deletedCount: 0,
        deletedByCategory: {},
        durationMs: 0,
      };
    }

    if (this.isCleanupRunning) {
      return {
        success: false,
        deletedCount: 0,
        deletedByCategory: {},
        durationMs: 0,
        error: 'Cleanup already in progress',
      };
    }

    this.isCleanupRunning = true;
    const startTime = Date.now();
    const deletedByCategory: Record<string, number> = {};
    let totalDeleted = 0;
    let oldestDeleted: Date | undefined;
    let newestDeleted: Date | undefined;
    let stoppedEarly = false;

    try {
      const categoriesToClean = options.categories ?? Object.values(AuditCategory);

      // Log cleanup start
      logger.info('Starting audit log cleanup', {
        categories: categoriesToClean,
        dryRun: options.dryRun ?? false,
        maxDeletes: options.maxDeletes,
      });

      // Audit the cleanup operation itself (unless dry run)
      if (!options.dryRun) {
        auditService.logAsync({
          action: AuditAction.SYSTEM_MAINTENANCE,
          resource: 'audit:retention_cleanup',
          metadata: {
            categories: categoriesToClean,
            maxDeletes: options.maxDeletes,
          },
        });
      }

      for (const category of categoriesToClean) {
        // Check if we've hit the max deletes limit
        if (options.maxDeletes && totalDeleted >= options.maxDeletes) {
          stoppedEarly = true;
          break;
        }

        const cutoffDate = options.cutoffDateOverride ?? this.getCutoffDate(category);

        // For critical logs, we need to apply the critical cutoff separately
        const criticalCutoffDate = options.cutoffDateOverride ?? this.getCutoffDate(category, AuditSeverity.CRITICAL);

        // Build the where clause for non-critical logs
        const nonCriticalWhere = {
          category,
          timestamp: { lt: cutoffDate },
          severity: { not: AuditSeverity.CRITICAL },
        };

        // Build the where clause for critical logs
        const criticalWhere = {
          category,
          timestamp: { lt: criticalCutoffDate },
          severity: AuditSeverity.CRITICAL,
        };

        if (options.dryRun) {
          // Just count what would be deleted
          const nonCriticalCount = await prisma.auditLog.count({ where: nonCriticalWhere });
          const criticalCount = await prisma.auditLog.count({ where: criticalWhere });
          deletedByCategory[category] = nonCriticalCount + criticalCount;
          totalDeleted += nonCriticalCount + criticalCount;
        } else {
          // Delete in batches to avoid overwhelming the database
          let batchDeletedCount = 0;
          let remainingDeletes = options.maxDeletes ? options.maxDeletes - totalDeleted : Infinity;

          // Delete non-critical logs first
          while (remainingDeletes > 0) {
            const batchSize = Math.min(this.policy.cleanupBatchSize, remainingDeletes);

            // Find logs to delete (for tracking time range)
            const logsToDelete = await prisma.auditLog.findMany({
              where: nonCriticalWhere,
              take: batchSize,
              orderBy: { timestamp: 'asc' },
              select: { id: true, timestamp: true },
            });

            if (logsToDelete.length === 0) break;

            // Track time range
            if (!oldestDeleted || logsToDelete[0].timestamp < oldestDeleted) {
              oldestDeleted = logsToDelete[0].timestamp;
            }
            if (!newestDeleted || logsToDelete[logsToDelete.length - 1].timestamp > newestDeleted) {
              newestDeleted = logsToDelete[logsToDelete.length - 1].timestamp;
            }

            // Delete the batch
            const ids = logsToDelete.map((l) => l.id);
            const deleteResult = await prisma.auditLog.deleteMany({
              where: { id: { in: ids } },
            });

            batchDeletedCount += deleteResult.count;
            remainingDeletes -= deleteResult.count;

            // Delay between batches to reduce database load
            if (this.policy.batchDelayMs > 0 && logsToDelete.length === batchSize) {
              await new Promise((resolve) => setTimeout(resolve, this.policy.batchDelayMs));
            }
          }

          // Delete critical logs (with different cutoff)
          remainingDeletes = options.maxDeletes ? options.maxDeletes - totalDeleted - batchDeletedCount : Infinity;

          while (remainingDeletes > 0) {
            const batchSize = Math.min(this.policy.cleanupBatchSize, remainingDeletes);

            const logsToDelete = await prisma.auditLog.findMany({
              where: criticalWhere,
              take: batchSize,
              orderBy: { timestamp: 'asc' },
              select: { id: true, timestamp: true },
            });

            if (logsToDelete.length === 0) break;

            // Track time range
            if (!oldestDeleted || logsToDelete[0].timestamp < oldestDeleted) {
              oldestDeleted = logsToDelete[0].timestamp;
            }
            if (!newestDeleted || logsToDelete[logsToDelete.length - 1].timestamp > newestDeleted) {
              newestDeleted = logsToDelete[logsToDelete.length - 1].timestamp;
            }

            const ids = logsToDelete.map((l) => l.id);
            const deleteResult = await prisma.auditLog.deleteMany({
              where: { id: { in: ids } },
            });

            batchDeletedCount += deleteResult.count;
            remainingDeletes -= deleteResult.count;

            if (this.policy.batchDelayMs > 0 && logsToDelete.length === batchSize) {
              await new Promise((resolve) => setTimeout(resolve, this.policy.batchDelayMs));
            }
          }

          deletedByCategory[category] = batchDeletedCount;
          totalDeleted += batchDeletedCount;
        }

        metrics.increment('audit.retention.cleanup.category', {
          category,
          deleted: String(deletedByCategory[category] ?? 0),
        });
      }

      const durationMs = Date.now() - startTime;

      const result: CleanupResult = {
        success: true,
        deletedCount: totalDeleted,
        deletedByCategory,
        durationMs,
        stoppedEarly,
      };

      if (oldestDeleted && newestDeleted) {
        result.deletedTimeRange = {
          oldest: oldestDeleted,
          newest: newestDeleted,
        };
      }

      // Record metrics
      metrics.histogram('audit.retention.cleanup.duration', durationMs);
      metrics.increment('audit.retention.cleanup.completed', {
        deleted: String(totalDeleted),
        dryRun: String(options.dryRun ?? false),
      });

      logger.info('Audit log cleanup completed', {
        deletedCount: totalDeleted,
        durationMs,
        dryRun: options.dryRun ?? false,
        stoppedEarly,
      });

      // Update last cleanup tracking
      this.lastCleanupAt = new Date();
      this.lastCleanupResult = result;

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      logger.error('Audit log cleanup failed', {
        error: errorMessage,
        deletedCount: totalDeleted,
        durationMs,
      });

      metrics.increment('audit.retention.cleanup.error');

      const result: CleanupResult = {
        success: false,
        deletedCount: totalDeleted,
        deletedByCategory,
        durationMs,
        error: errorMessage,
      };

      this.lastCleanupAt = new Date();
      this.lastCleanupResult = result;

      return result;
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Get retention statistics
   */
  async getStats(): Promise<RetentionStats> {
    if (isBuilding) {
      return {
        totalLogs: 0,
        logsByCategory: {},
        pendingDeletion: 0,
      };
    }

    try {
      // Get total count
      const totalLogs = await prisma.auditLog.count();

      // Get count by category
      const categoryGroups = await prisma.auditLog.groupBy({
        by: ['category'],
        _count: { id: true },
      });

      const logsByCategory: Record<string, number> = {};
      for (const group of categoryGroups) {
        logsByCategory[group.category] = group._count.id;
      }

      // Get pending deletion count (logs past retention for any category)
      let pendingDeletion = 0;
      for (const category of Object.values(AuditCategory)) {
        const cutoffDate = this.getCutoffDate(category);
        const count = await prisma.auditLog.count({
          where: {
            category,
            timestamp: { lt: cutoffDate },
            severity: { not: AuditSeverity.CRITICAL },
          },
        });
        pendingDeletion += count;

        // Also count critical logs past their retention
        const criticalCutoff = this.getCutoffDate(category, AuditSeverity.CRITICAL);
        const criticalCount = await prisma.auditLog.count({
          where: {
            category,
            timestamp: { lt: criticalCutoff },
            severity: AuditSeverity.CRITICAL,
          },
        });
        pendingDeletion += criticalCount;
      }

      // Get time range
      const oldestLog = await prisma.auditLog.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      });

      const newestLog = await prisma.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      return {
        totalLogs,
        logsByCategory,
        pendingDeletion,
        oldestLog: oldestLog?.timestamp,
        newestLog: newestLog?.timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get retention stats', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get cleanup job status
   */
  getJobStatus(): CleanupJobStatus {
    return {
      isRunning: this.isCleanupRunning,
      lastCleanupAt: this.lastCleanupAt,
      lastResult: this.lastCleanupResult,
    };
  }

  /**
   * Estimate cleanup impact without performing deletion
   */
  async estimateCleanup(): Promise<CleanupEstimate> {
    const result = await this.runCleanup({ dryRun: true });
    return {
      totalToDelete: result.deletedCount,
      byCategory: result.deletedByCategory,
      oldestToDelete: result.deletedTimeRange?.oldest,
      newestToDelete: result.deletedTimeRange?.newest,
    };
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

/**
 * Default retention policy service instance
 */
export const retentionService: IRetentionPolicyService = new RetentionPolicyService();

/**
 * Create a new retention policy service with custom configuration
 */
export function createRetentionService(
  config?: Partial<RetentionPolicyConfig>
): IRetentionPolicyService {
  return new RetentionPolicyService(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the effective retention days for a category (convenience function)
 */
export function getRetentionDays(
  category: AuditCategory,
  severity?: AuditSeverity
): number {
  return retentionService.getEffectiveRetentionDays(category, severity);
}

/**
 * Get the retention cutoff date for a category (convenience function)
 */
export function getRetentionCutoffDate(
  category: AuditCategory,
  severity?: AuditSeverity
): Date {
  return retentionService.getCutoffDate(category, severity);
}

/**
 * Run cleanup with default options (convenience function)
 */
export async function runRetentionCleanup(
  options?: CleanupOptions
): Promise<CleanupResult> {
  return retentionService.runCleanup(options);
}

/**
 * Get retention statistics (convenience function)
 */
export async function getRetentionStats(): Promise<RetentionStats> {
  return retentionService.getStats();
}

/**
 * Estimate what would be cleaned up (convenience function)
 */
export async function estimateRetentionCleanup(): Promise<CleanupEstimate> {
  return retentionService.estimateCleanup();
}
