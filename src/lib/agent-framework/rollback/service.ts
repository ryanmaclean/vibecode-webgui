// Rollback Service - Manages operation snapshots and restore functionality
// Provides snapshot creation, restoration, and listing for agent operations

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { prisma } from '../../prisma';
import type { OperationSnapshot } from '@prisma/client';

// Event types
export enum RollbackEvent {
  SnapshotCreated = 'snapshot_created',
  SnapshotRestored = 'snapshot_restored',
  SnapshotExpired = 'snapshot_expired',
  RollbackFailed = 'rollback_failed',
}

export interface RollbackServiceOptions {
  /** Default retention duration for snapshots in milliseconds */
  defaultRetention?: number;

  /** Maximum number of snapshots to store per confirmation */
  maxSnapshotsPerConfirmation?: number;

  /** Whether to auto-cleanup expired snapshots */
  autoCleanupExpired?: boolean;
}

/**
 * Snapshot creation options
 */
export interface SnapshotOptions {
  /** Operation type (e.g., "file.write", "file.delete") */
  operationType: string;

  /** File path for file operations */
  filePath?: string;

  /** Content before operation (for rollback) */
  originalContent?: string;

  /** Content after operation (for verification) */
  modifiedContent?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Snapshot restoration result
 */
export interface RestoreResult {
  /** Whether restoration was successful */
  success: boolean;

  /** The restored snapshot */
  snapshot: OperationSnapshot;

  /** Timestamp when restoration occurred */
  restoredAt: Date;

  /** User ID who triggered the rollback */
  restoredBy: number;

  /** Error message if restoration failed */
  error?: string;
}

/**
 * Event emitted when a snapshot is created
 */
export interface SnapshotCreatedEvent {
  type: 'snapshot_created';
  snapshot: OperationSnapshot;
  timestamp: string;
}

/**
 * Event emitted when a snapshot is restored
 */
export interface SnapshotRestoredEvent {
  type: 'snapshot_restored';
  snapshot: OperationSnapshot;
  restoredBy: number;
  timestamp: string;
}

/**
 * Event emitted when a snapshot expires
 */
export interface SnapshotExpiredEvent {
  type: 'snapshot_expired';
  snapshotId: string;
  timestamp: string;
}

/**
 * Event emitted when rollback fails
 */
export interface RollbackFailedEvent {
  type: 'rollback_failed';
  snapshotId: string;
  error: string;
  timestamp: string;
}

/**
 * Rollback Service for managing operation snapshots and restore
 *
 * Handles creating snapshots before operations, restoring from snapshots,
 * and managing snapshot lifecycle.
 */
export class RollbackService extends EventEmitter {
  private defaultRetention: number;
  private maxSnapshotsPerConfirmation: number;
  private autoCleanupExpired: boolean;

  constructor(options: RollbackServiceOptions = {}) {
    super();

    this.defaultRetention = options.defaultRetention ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.maxSnapshotsPerConfirmation = options.maxSnapshotsPerConfirmation ?? 100;
    this.autoCleanupExpired = options.autoCleanupExpired ?? true;
  }

  /**
   * Create a snapshot for an operation
   *
   * Stores the state before an operation is executed, allowing for rollback.
   *
   * @param confirmationId - ID of the confirmation request
   * @param options - Snapshot creation options
   * @returns The created snapshot
   */
  async createSnapshot(
    confirmationId: string,
    options: SnapshotOptions
  ): Promise<OperationSnapshot> {
    // Check if we've reached max snapshots for this confirmation
    const existingCount = await prisma.operationSnapshot.count({
      where: { confirmation_id: confirmationId },
    });

    if (existingCount >= this.maxSnapshotsPerConfirmation) {
      throw new Error(
        `Maximum snapshots per confirmation (${this.maxSnapshotsPerConfirmation}) reached. ` +
        'Please clean up old snapshots first.'
      );
    }

    const now = new Date();

    // Create snapshot in database
    const snapshot = await prisma.operationSnapshot.create({
      data: {
        id: randomUUID(),
        confirmation_id: confirmationId,
        operation_type: options.operationType,
        file_path: options.filePath,
        original_content: options.originalContent,
        modified_content: options.modifiedContent,
        rollback_status: 'available',
        metadata: options.metadata as Record<string, unknown> | undefined,
        created_at: now,
      },
    });

    // Emit snapshot created event
    const event: SnapshotCreatedEvent = {
      type: 'snapshot_created',
      snapshot,
      timestamp: now.toISOString(),
    };

    this.emit(RollbackEvent.SnapshotCreated, event);

    // Optionally cleanup expired snapshots
    if (this.autoCleanupExpired) {
      // Don't await - run cleanup in background
      this.cleanupExpiredSnapshots().catch((error) => {
        // Log error but don't fail snapshot creation
        console.error('Failed to cleanup expired snapshots:', error);
      });
    }

    return snapshot;
  }

  /**
   * Restore from a snapshot
   *
   * Marks the snapshot as rolled back and returns the original content
   * for restoration.
   *
   * @param snapshotId - ID of the snapshot to restore
   * @param userId - ID of the user triggering the rollback
   * @returns Restoration result with snapshot data
   */
  async restoreSnapshot(
    snapshotId: string,
    userId: number
  ): Promise<RestoreResult> {
    // Retrieve the snapshot
    const snapshot = await prisma.operationSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    // Check if snapshot is available for rollback
    if (snapshot.rollback_status !== 'available') {
      throw new Error(
        `Snapshot ${snapshotId} is not available for rollback (status: ${snapshot.rollback_status})`
      );
    }

    const now = new Date();

    try {
      // Update snapshot status
      const updatedSnapshot = await prisma.operationSnapshot.update({
        where: { id: snapshotId },
        data: {
          rollback_status: 'rolled_back',
          rolled_back_at: now,
          rolled_back_by: userId,
        },
      });

      // Emit snapshot restored event
      const event: SnapshotRestoredEvent = {
        type: 'snapshot_restored',
        snapshot: updatedSnapshot,
        restoredBy: userId,
        timestamp: now.toISOString(),
      };

      this.emit(RollbackEvent.SnapshotRestored, event);

      return {
        success: true,
        snapshot: updatedSnapshot,
        restoredAt: now,
        restoredBy: userId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit rollback failed event
      const failedEvent: RollbackFailedEvent = {
        type: 'rollback_failed',
        snapshotId,
        error: errorMessage,
        timestamp: now.toISOString(),
      };

      this.emit(RollbackEvent.RollbackFailed, failedEvent);

      return {
        success: false,
        snapshot,
        restoredAt: now,
        restoredBy: userId,
        error: errorMessage,
      };
    }
  }

  /**
   * List snapshots for a confirmation request
   *
   * @param confirmationId - ID of the confirmation request
   * @param options - Query options
   * @returns List of snapshots
   */
  async listSnapshots(
    confirmationId: string,
    options: {
      status?: 'available' | 'rolled_back' | 'expired';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    snapshots: OperationSnapshot[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Build where clause
    const where: {
      confirmation_id: string;
      rollback_status?: string;
    } = {
      confirmation_id: confirmationId,
    };

    if (options.status) {
      where.rollback_status = options.status;
    }

    // Get total count
    const total = await prisma.operationSnapshot.count({ where });

    // Get snapshots
    const snapshots = await prisma.operationSnapshot.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return {
      snapshots,
      total,
      hasMore: offset + snapshots.length < total,
    };
  }

  /**
   * Get a specific snapshot by ID
   *
   * @param snapshotId - ID of the snapshot
   * @returns The snapshot or null if not found
   */
  async getSnapshot(snapshotId: string): Promise<OperationSnapshot | null> {
    return prisma.operationSnapshot.findUnique({
      where: { id: snapshotId },
    });
  }

  /**
   * Mark expired snapshots
   *
   * Updates snapshots older than the retention period to 'expired' status.
   *
   * @returns Number of snapshots marked as expired
   */
  async cleanupExpiredSnapshots(): Promise<number> {
    const expirationThreshold = new Date(Date.now() - this.defaultRetention);

    const result = await prisma.operationSnapshot.updateMany({
      where: {
        created_at: { lt: expirationThreshold },
        rollback_status: 'available',
      },
      data: {
        rollback_status: 'expired',
      },
    });

    // Emit events for expired snapshots
    if (result.count > 0) {
      const now = new Date().toISOString();

      // Note: We can't emit individual events without fetching the snapshots
      // For performance, we just log the count
      this.emit(RollbackEvent.SnapshotExpired, {
        type: 'snapshot_expired',
        count: result.count,
        timestamp: now,
      });
    }

    return result.count;
  }

  /**
   * Delete a snapshot permanently
   *
   * @param snapshotId - ID of the snapshot to delete
   * @returns Whether deletion was successful
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    try {
      await prisma.operationSnapshot.delete({
        where: { id: snapshotId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all snapshots for a confirmation
   *
   * @param confirmationId - ID of the confirmation request
   * @returns Number of snapshots deleted
   */
  async deleteAllSnapshots(confirmationId: string): Promise<number> {
    const result = await prisma.operationSnapshot.deleteMany({
      where: { confirmation_id: confirmationId },
    });

    return result.count;
  }

  /**
   * Get snapshot statistics for a confirmation
   *
   * @param confirmationId - ID of the confirmation request
   * @returns Statistics about snapshots
   */
  async getSnapshotStats(confirmationId: string): Promise<{
    total: number;
    available: number;
    rolledBack: number;
    expired: number;
    totalSize: number;
  }> {
    const snapshots = await prisma.operationSnapshot.findMany({
      where: { confirmation_id: confirmationId },
    });

    const stats = {
      total: snapshots.length,
      available: 0,
      rolledBack: 0,
      expired: 0,
      totalSize: 0,
    };

    for (const snapshot of snapshots) {
      switch (snapshot.rollback_status) {
        case 'available':
          stats.available++;
          break;
        case 'rolled_back':
          stats.rolledBack++;
          break;
        case 'expired':
          stats.expired++;
          break;
      }

      // Estimate size based on content length
      const contentSize =
        (snapshot.original_content?.length ?? 0) +
        (snapshot.modified_content?.length ?? 0);
      stats.totalSize += contentSize;
    }

    return stats;
  }

  /**
   * Check if a confirmation has available snapshots for rollback
   *
   * @param confirmationId - ID of the confirmation request
   * @returns Whether rollback is possible
   */
  async canRollback(confirmationId: string): Promise<boolean> {
    const count = await prisma.operationSnapshot.count({
      where: {
        confirmation_id: confirmationId,
        rollback_status: 'available',
      },
    });

    return count > 0;
  }
}

/**
 * Create rollback service instance
 */
export function createRollbackService(options?: RollbackServiceOptions): RollbackService {
  return new RollbackService(options);
}
