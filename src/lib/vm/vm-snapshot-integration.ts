/**
 * VM Snapshot Integration
 *
 * Integrates snapshot functionality with the VM provider system.
 * Provides a unified interface for snapshotting VMs across different providers.
 *
 * @module lib/vm/vm-snapshot-integration
 */

import { VMProvider, VM, VMStatus, VMConfig } from './types';
import { ProviderFactory } from './provider-factory';
import { SnapshotManager, getSnapshotManager, SnapshotEvent, SnapshotEventListener } from './snapshots';
import { logger } from '@/lib/logger';
import type {
  SnapshotInfo,
  SnapshotOptions,
  SnapshotResult,
  RestoreResult,
  SnapshotListResponse,
} from '@/types/vm-snapshot';

/**
 * Operations that should trigger auto-snapshot
 */
type RiskyOperation =
  | 'upgrade'
  | 'restart'
  | 'config-change'
  | 'package-install'
  | 'kernel-update';

/**
 * VMSnapshotIntegration provides snapshot capabilities for VMs
 */
export class VMSnapshotIntegration {
  private snapshotManager: SnapshotManager;
  private provider: VMProvider | null = null;
  private autoSnapshotEnabled: boolean = true;
  private snapshotHistory: Map<string, string[]> = new Map(); // vmId -> snapshotIds

  constructor(snapshotManager?: SnapshotManager) {
    this.snapshotManager = snapshotManager || getSnapshotManager();
  }

  /**
   * Initialize integration with a specific provider
   */
  async initialize(providerName?: string): Promise<void> {
    await this.snapshotManager.initialize();

    if (providerName) {
      this.provider = await ProviderFactory.getProvider(providerName);
    } else {
      this.provider = await ProviderFactory.detectProvider();
    }

    logger.info('VM Snapshot integration initialized', {
      provider: this.provider.name,
    });
  }

  /**
   * Create a snapshot of a VM
   */
  async createSnapshot(
    vmId: string,
    name: string,
    description?: string,
    options?: Partial<SnapshotOptions>
  ): Promise<SnapshotResult> {
    if (!this.provider) {
      throw new Error('Integration not initialized. Call initialize() first.');
    }

    const result = await this.snapshotManager.createSnapshot(
      vmId,
      name,
      description,
      options,
      this.provider
    );

    // Track in history
    if (result.success && result.snapshot) {
      this.trackSnapshot(vmId, result.snapshot.id);
    }

    return result;
  }

  /**
   * Create an auto-snapshot before a risky operation
   */
  async autoSnapshotBeforeOperation(
    vmId: string,
    operation: RiskyOperation
  ): Promise<SnapshotResult | null> {
    if (!this.autoSnapshotEnabled) {
      logger.debug('Auto-snapshot disabled, skipping', { vmId, operation });
      return null;
    }

    logger.info('Creating auto-snapshot before risky operation', { vmId, operation });

    return this.snapshotManager.createAutoSnapshot(vmId, operation);
  }

  /**
   * Restore a VM from snapshot
   */
  async restoreSnapshot(
    snapshotId: string,
    targetVmId?: string
  ): Promise<RestoreResult> {
    if (!this.provider) {
      throw new Error('Integration not initialized. Call initialize() first.');
    }

    return this.snapshotManager.restoreSnapshot(snapshotId, targetVmId, this.provider);
  }

  /**
   * Get snapshot history for a VM
   */
  async getSnapshotHistory(vmId: string): Promise<SnapshotInfo[]> {
    return this.snapshotManager.listSnapshotsForVM(vmId);
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<SnapshotListResponse> {
    return this.snapshotManager.listSnapshots();
  }

  /**
   * Get a specific snapshot
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotInfo | null> {
    return this.snapshotManager.getSnapshot(snapshotId);
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.snapshotManager.deleteSnapshot(snapshotId);

    // Remove from history
    if (result.success) {
      this.removeFromHistory(snapshotId);
    }

    return result;
  }

  /**
   * Export a snapshot
   */
  async exportSnapshot(snapshotId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    return this.snapshotManager.exportSnapshot(snapshotId, outputPath);
  }

  /**
   * Import a snapshot
   */
  async importSnapshot(
    filePath: string,
    overwrite?: boolean
  ): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
    return this.snapshotManager.importSnapshot(filePath, overwrite);
  }

  /**
   * Estimate snapshot size
   */
  async estimateSnapshotSize(
    vmId: string,
    options?: Partial<SnapshotOptions>
  ): Promise<{ success: boolean; data?: import('@/types/vm-snapshot').SnapshotSizeEstimate; error?: string }> {
    try {
      const estimate = await this.snapshotManager.estimateSnapshotSize(vmId, options);
      return { success: true, data: estimate };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to estimate size',
      };
    }
  }

  /**
   * Clean up old snapshots
   */
  async cleanupSnapshots(): Promise<{ removed: string[]; freedSpace: number }> {
    return this.snapshotManager.cleanup();
  }

  /**
   * Enable or disable auto-snapshots
   */
  setAutoSnapshotEnabled(enabled: boolean): void {
    this.autoSnapshotEnabled = enabled;
    logger.info('Auto-snapshot setting changed', { enabled });
  }

  /**
   * Check if auto-snapshots are enabled
   */
  isAutoSnapshotEnabled(): boolean {
    return this.autoSnapshotEnabled;
  }

  /**
   * Add event listener for snapshot events
   */
  addEventListener(listener: SnapshotEventListener): void {
    this.snapshotManager.addEventListener(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SnapshotEventListener): void {
    this.snapshotManager.removeEventListener(listener);
  }

  /**
   * Get the current provider
   */
  getProvider(): VMProvider | null {
    return this.provider;
  }

  /**
   * Get the snapshot manager
   */
  getSnapshotManager(): SnapshotManager {
    return this.snapshotManager;
  }

  /**
   * Track a snapshot in history
   */
  private trackSnapshot(vmId: string, snapshotId: string): void {
    if (!this.snapshotHistory.has(vmId)) {
      this.snapshotHistory.set(vmId, []);
    }
    this.snapshotHistory.get(vmId)!.push(snapshotId);
  }

  /**
   * Remove a snapshot from history
   */
  private removeFromHistory(snapshotId: string): void {
    for (const [vmId, snapshots] of this.snapshotHistory.entries()) {
      const index = snapshots.indexOf(snapshotId);
      if (index !== -1) {
        snapshots.splice(index, 1);
        if (snapshots.length === 0) {
          this.snapshotHistory.delete(vmId);
        }
        break;
      }
    }
  }
}

/**
 * Singleton instance
 */
let integrationInstance: VMSnapshotIntegration | null = null;

/**
 * Get the VM snapshot integration singleton
 */
export function getVMSnapshotIntegration(): VMSnapshotIntegration {
  if (!integrationInstance) {
    integrationInstance = new VMSnapshotIntegration();
  }
  return integrationInstance;
}

/**
 * Reset the integration singleton (for testing)
 */
export function resetVMSnapshotIntegration(): void {
  integrationInstance = null;
}

/**
 * Helper function to wrap VM operations with auto-snapshot
 */
export async function withAutoSnapshot<T>(
  vmId: string,
  operation: RiskyOperation,
  action: () => Promise<T>
): Promise<T> {
  const integration = getVMSnapshotIntegration();

  // Create auto-snapshot before operation
  const snapshot = await integration.autoSnapshotBeforeOperation(vmId, operation);

  try {
    // Perform the operation
    return await action();
  } catch (error) {
    // Log that we have a snapshot available for recovery
    if (snapshot?.success && snapshot.snapshot) {
      logger.warn('Operation failed, snapshot available for recovery', {
        vmId,
        operation,
        snapshotId: snapshot.snapshot.id,
        snapshotName: snapshot.snapshot.name,
      });
    }
    throw error;
  }
}
