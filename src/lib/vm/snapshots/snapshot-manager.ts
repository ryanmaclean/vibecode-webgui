/**
 * Snapshot Manager Service
 *
 * Core service for creating, restoring, and managing VM snapshots.
 * Coordinates between VM providers and snapshot storage.
 *
 * @module lib/vm/snapshots/snapshot-manager
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/logger';
import { SnapshotStorage, getSnapshotStorage } from './snapshot-storage';
import type {
  SnapshotInfo,
  SnapshotState,
  SnapshotOptions,
  SnapshotMetadata,
  SnapshotResult,
  RestoreResult,
  SnapshotSizeEstimate,
  SnapshotListResponse,
  ServiceInfo,
  PortInfo,
  VMSnapshotConfig,
  HostInfo,
  DEFAULT_SNAPSHOT_OPTIONS,
} from '@/types/vm-snapshot';
import type { VM, VMConfig, VMStatus } from '../types';

const execFile = promisify(execFileCallback);

/**
 * Event types for snapshot operations
 */
export type SnapshotEventType =
  | 'snapshot:creating'
  | 'snapshot:created'
  | 'snapshot:failed'
  | 'snapshot:restoring'
  | 'snapshot:restored'
  | 'snapshot:restore-failed'
  | 'snapshot:deleted'
  | 'snapshot:exported'
  | 'snapshot:imported';

/**
 * Snapshot event payload
 */
export interface SnapshotEvent {
  type: SnapshotEventType;
  snapshotId?: string;
  vmId: string;
  error?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Snapshot event listener
 */
export type SnapshotEventListener = (event: SnapshotEvent) => void;

/**
 * VM Provider interface for snapshot operations
 */
interface VMProviderSnapshot {
  /** Pause the VM (required before snapshot) */
  pause?(vmId: string): Promise<void>;
  /** Resume the VM (after snapshot) */
  resume?(vmId: string): Promise<void>;
  /** Save VM state (if supported) */
  saveState?(vmId: string, statePath: string): Promise<boolean>;
  /** Restore VM state (if supported) */
  restoreState?(vmId: string, statePath: string): Promise<boolean>;
  /** Get VM config */
  getConfig?(vmId: string): Promise<VMConfig | null>;
  /** Get VM status */
  status(vmId: string): Promise<VMStatus>;
  /** Stop VM */
  stop(vmId: string): Promise<void>;
  /** Start VM */
  start(vmId: string): Promise<void>;
}

/**
 * SnapshotManager handles all snapshot lifecycle operations
 */
export class SnapshotManager {
  private storage: SnapshotStorage;
  private vmBaseDir: string;
  private listeners: Set<SnapshotEventListener> = new Set();
  private activeOperations: Map<string, Promise<unknown>> = new Map();

  constructor(storage?: SnapshotStorage) {
    this.storage = storage || getSnapshotStorage();
    this.vmBaseDir = path.join(os.homedir(), '.vfkit', 'vms');
  }

  /**
   * Initialize the snapshot manager
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    logger.info('Snapshot manager initialized');
  }

  /**
   * Add event listener
   */
  addEventListener(listener: SnapshotEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SnapshotEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: SnapshotEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Snapshot event listener error', { event, error });
      }
    }
  }

  /**
   * Create a snapshot of a VM
   */
  async createSnapshot(
    vmId: string,
    name: string,
    description?: string,
    options?: Partial<SnapshotOptions>,
    provider?: VMProviderSnapshot
  ): Promise<SnapshotResult> {
    const startTime = Date.now();
    const snapshotId = randomUUID();

    // Merge with default options
    const opts: SnapshotOptions = {
      includeDisk: true,
      includeMemory: true,
      compress: true,
      compressionAlgorithm: 'zstd',
      compressionLevel: 3,
      verifyIntegrity: true,
      pauseVM: true,
      ...options,
    };

    logger.info('Creating snapshot', { snapshotId, vmId, name, options: opts });

    this.emit({
      type: 'snapshot:creating',
      snapshotId,
      vmId,
      progress: 0,
    });

    try {
      // Check if VM exists
      const vmDir = path.join(this.vmBaseDir, vmId);
      try {
        await fs.access(vmDir);
      } catch {
        throw new Error(`VM not found: ${vmId}`);
      }

      // Pause VM if requested and provider supports it
      if (opts.pauseVM && provider?.pause) {
        logger.debug('Pausing VM before snapshot', { vmId });
        await provider.pause(vmId);
      }

      try {
        // Create snapshot directory
        const snapshotDir = await this.storage.createSnapshotDirectory(snapshotId);

        // Collect metadata
        const metadata = await this.collectMetadata(vmId, provider);

        // Create initial snapshot info
        let snapshotInfo: SnapshotInfo = {
          id: snapshotId,
          name,
          description,
          createdAt: new Date(),
          size: 0,
          state: 'creating',
          vmId,
          vmName: vmId,
          includesDisk: opts.includeDisk,
          includesMemory: opts.includeMemory,
          compressed: opts.compress,
          compressionAlgorithm: opts.compress ? opts.compressionAlgorithm : undefined,
          metadata,
          path: snapshotDir,
        };

        // Add to index early (as creating)
        await this.storage.addToIndex(snapshotInfo);

        this.emit({
          type: 'snapshot:creating',
          snapshotId,
          vmId,
          progress: 10,
        });

        // Save disk image
        if (opts.includeDisk) {
          await this.saveDiskImage(vmId, snapshotDir, opts);
          this.emit({
            type: 'snapshot:creating',
            snapshotId,
            vmId,
            progress: 50,
          });
        }

        // Save memory state
        if (opts.includeMemory) {
          const stateSaved = await this.saveMemoryState(vmId, snapshotDir, provider);
          if (!stateSaved) {
            logger.warn('Could not save memory state, snapshot will be disk-only');
            snapshotInfo.includesMemory = false;
          }
          this.emit({
            type: 'snapshot:creating',
            snapshotId,
            vmId,
            progress: 80,
          });
        }

        // Save metadata
        await this.storage.saveMetadata(snapshotId, metadata);

        // Calculate final size
        const size = await this.storage.calculateDirectorySize(snapshotDir);

        // Calculate checksum if requested
        let checksum: string | undefined;
        if (opts.verifyIntegrity) {
          const diskPath = path.join(snapshotDir, 'disk.img' + (opts.compress ? '.zst' : ''));
          try {
            checksum = await this.storage.calculateChecksum(diskPath);
          } catch {
            // Disk file might not exist or have different extension
          }
        }

        // Update snapshot info
        snapshotInfo = {
          ...snapshotInfo,
          size,
          state: 'ready',
          checksum,
        };

        // Save snapshot info file (for export/import)
        await fs.writeFile(
          path.join(snapshotDir, 'snapshot-info.json'),
          JSON.stringify(snapshotInfo, null, 2)
        );

        // Update in index
        await this.storage.updateInIndex(snapshotId, snapshotInfo);

        this.emit({
          type: 'snapshot:created',
          snapshotId,
          vmId,
          progress: 100,
        });

        logger.info('Snapshot created successfully', {
          snapshotId,
          vmId,
          name,
          size,
          duration: Date.now() - startTime,
        });

        return {
          success: true,
          snapshot: snapshotInfo,
          duration: Date.now() - startTime,
        };
      } finally {
        // Resume VM if it was paused
        if (opts.pauseVM && provider?.resume) {
          logger.debug('Resuming VM after snapshot', { vmId });
          await provider.resume(vmId);
        }
      }
    } catch (error) {
      logger.error('Failed to create snapshot', { snapshotId, vmId, error });

      // Update snapshot state to error
      try {
        await this.storage.updateInIndex(snapshotId, {
          state: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch {
        // Ignore if can't update
      }

      this.emit({
        type: 'snapshot:failed',
        snapshotId,
        vmId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Save disk image to snapshot
   */
  private async saveDiskImage(
    vmId: string,
    snapshotDir: string,
    options: SnapshotOptions
  ): Promise<void> {
    const sourcePath = path.join(this.vmBaseDir, vmId, 'disk', 'root.img');
    const destPath = path.join(snapshotDir, 'disk.img');

    // Copy disk image
    await fs.copyFile(sourcePath, destPath);

    // Compress if requested
    if (options.compress) {
      const result = await this.storage.compressFile(
        destPath,
        options.compressionAlgorithm || 'zstd',
        options.compressionLevel || 3
      );

      if (result.success) {
        // Remove uncompressed version
        await fs.unlink(destPath);
      } else {
        logger.warn('Compression failed, keeping uncompressed disk', { error: result.error });
      }
    }
  }

  /**
   * Save memory state to snapshot
   */
  private async saveMemoryState(
    vmId: string,
    snapshotDir: string,
    provider?: VMProviderSnapshot
  ): Promise<boolean> {
    const statePath = path.join(snapshotDir, 'memory.state');

    // Try provider's save state if available
    if (provider?.saveState) {
      try {
        const success = await provider.saveState(vmId, statePath);
        if (success) {
          logger.debug('Memory state saved via provider', { vmId });
          return true;
        }
      } catch (error) {
        logger.warn('Provider save state failed', { vmId, error });
      }
    }

    // Try vfkit save-state command
    try {
      const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');
      const pid = await fs.readFile(pidPath, 'utf-8');

      // vfkit doesn't have a direct save-state command, but we can try to use
      // the REST API if available, or fall back to disk-only snapshot
      // For now, we'll indicate memory save is not supported

      logger.debug('Memory state save not available for this VM provider');
      return false;
    } catch (error) {
      logger.debug('Could not save memory state', { vmId, error });
      return false;
    }
  }

  /**
   * Collect metadata from running VM
   */
  private async collectMetadata(vmId: string, provider?: VMProviderSnapshot): Promise<SnapshotMetadata> {
    const vmDir = path.join(this.vmBaseDir, vmId);

    // Get VM config
    let vmConfig: VMSnapshotConfig = {
      cpus: 4,
      memory: 4 * 1024 * 1024 * 1024,
      diskSize: 20 * 1024 * 1024 * 1024,
      arch: 'arm64',
      provider: 'vfkit',
      image: 'alpine-3.22',
    };

    try {
      const configPath = path.join(vmDir, 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config: VMConfig = JSON.parse(configData);

      vmConfig = {
        cpus: config.cpus,
        memory: this.parseSizeToBytes(config.memory),
        diskSize: this.parseSizeToBytes(config.disk),
        arch: config.arch === 'x86_64' ? 'x86_64' : 'arm64',
        provider: 'vfkit',
        image: config.image,
      };
    } catch {
      logger.debug('Could not load VM config, using defaults');
    }

    // Get host info
    const hostInfo: HostInfo = {
      os: process.platform as 'darwin' | 'linux' | 'win32',
      osVersion: os.release(),
      arch: process.arch === 'x64' ? 'x86_64' : 'arm64',
      hostname: os.hostname(),
    };

    // Try to get service info (would require SSH or other mechanism)
    const services: ServiceInfo[] = [];
    const ports: PortInfo[] = [];

    // Get environment (sanitized - no secrets)
    const environment: Record<string, string> = {
      NODE_ENV: process.env.NODE_ENV || 'development',
    };

    return {
      services,
      ports,
      environment,
      vmConfig,
      hostInfo,
      vibecodeVersion: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * Restore a VM from snapshot
   */
  async restoreSnapshot(
    snapshotId: string,
    targetVmId?: string,
    provider?: VMProviderSnapshot
  ): Promise<RestoreResult> {
    const startTime = Date.now();

    logger.info('Restoring snapshot', { snapshotId, targetVmId });

    const snapshot = await this.storage.getSnapshot(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        error: `Snapshot not found: ${snapshotId}`,
        duration: Date.now() - startTime,
      };
    }

    const vmId = targetVmId || snapshot.vmId;

    this.emit({
      type: 'snapshot:restoring',
      snapshotId,
      vmId,
      progress: 0,
    });

    try {
      const vmDir = path.join(this.vmBaseDir, vmId);

      // Stop VM if running
      if (provider) {
        const status = await provider.status(vmId);
        if (status === 'running') {
          logger.debug('Stopping VM before restore', { vmId });
          await provider.stop(vmId);
        }
      }

      // Restore disk image
      if (snapshot.includesDisk) {
        await this.restoreDiskImage(snapshot, vmDir);
        this.emit({
          type: 'snapshot:restoring',
          snapshotId,
          vmId,
          progress: 60,
        });
      }

      // Restore memory state
      const warnings: string[] = [];
      if (snapshot.includesMemory) {
        const stateRestored = await this.restoreMemoryState(snapshot, vmDir, provider);
        if (!stateRestored) {
          warnings.push('Memory state could not be restored. VM will boot from saved disk state.');
        }
      }

      // Start VM
      if (provider) {
        await provider.start(vmId);
      }

      this.emit({
        type: 'snapshot:restored',
        snapshotId,
        vmId,
        progress: 100,
      });

      logger.info('Snapshot restored successfully', {
        snapshotId,
        vmId,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        duration: Date.now() - startTime,
        restoredServices: snapshot.metadata.services.map((s) => s.name),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('Failed to restore snapshot', { snapshotId, vmId, error });

      this.emit({
        type: 'snapshot:restore-failed',
        snapshotId,
        vmId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Restore disk image from snapshot
   */
  private async restoreDiskImage(snapshot: SnapshotInfo, vmDir: string): Promise<void> {
    const diskDir = path.join(vmDir, 'disk');
    await fs.mkdir(diskDir, { recursive: true });

    const destPath = path.join(diskDir, 'root.img');

    // Find source file (compressed or not)
    let sourcePath = path.join(snapshot.path, 'disk.img');

    if (snapshot.compressed && snapshot.compressionAlgorithm) {
      const ext = snapshot.compressionAlgorithm === 'zstd' ? 'zst' :
                  snapshot.compressionAlgorithm === 'gzip' ? 'gz' : 'lz4';
      const compressedPath = `${sourcePath}.${ext}`;

      try {
        await fs.access(compressedPath);
        // Decompress first
        const result = await this.storage.decompressFile(compressedPath);
        if (!result.success) {
          throw new Error(`Decompression failed: ${result.error}`);
        }
        sourcePath = result.outputPath;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw e;
        }
        // Try uncompressed version
      }
    }

    // Verify integrity if checksum available
    if (snapshot.checksum) {
      const valid = await this.storage.verifyIntegrity(sourcePath, snapshot.checksum);
      if (!valid) {
        throw new Error('Snapshot integrity check failed');
      }
    }

    // Copy disk image
    await fs.copyFile(sourcePath, destPath);

    logger.debug('Disk image restored', { sourcePath, destPath });
  }

  /**
   * Restore memory state from snapshot
   */
  private async restoreMemoryState(
    snapshot: SnapshotInfo,
    vmDir: string,
    provider?: VMProviderSnapshot
  ): Promise<boolean> {
    const statePath = path.join(snapshot.path, 'memory.state');

    try {
      await fs.access(statePath);
    } catch {
      // No memory state file
      return false;
    }

    // Try provider's restore state if available
    if (provider?.restoreState) {
      try {
        const success = await provider.restoreState(snapshot.vmId, statePath);
        if (success) {
          logger.debug('Memory state restored via provider');
          return true;
        }
      } catch (error) {
        logger.warn('Provider restore state failed', { error });
      }
    }

    return false;
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    logger.info('Deleting snapshot', { snapshotId });

    try {
      const snapshot = await this.storage.getSnapshot(snapshotId);
      if (!snapshot) {
        return { success: false, error: `Snapshot not found: ${snapshotId}` };
      }

      await this.storage.deleteSnapshot(snapshotId);

      this.emit({
        type: 'snapshot:deleted',
        snapshotId,
        vmId: snapshot.vmId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete snapshot', { snapshotId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<SnapshotListResponse> {
    const snapshots = await this.storage.listSnapshots();
    const totalSize = snapshots.reduce((sum, s) => sum + s.size, 0);

    return {
      snapshots,
      total: snapshots.length,
      totalSize,
    };
  }

  /**
   * List snapshots for a specific VM
   */
  async listSnapshotsForVM(vmId: string): Promise<SnapshotInfo[]> {
    return this.storage.getSnapshotsForVM(vmId);
  }

  /**
   * Get a single snapshot
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotInfo | null> {
    return this.storage.getSnapshot(snapshotId);
  }

  /**
   * Estimate snapshot size before creation
   */
  async estimateSnapshotSize(
    vmId: string,
    options?: Partial<SnapshotOptions>
  ): Promise<SnapshotSizeEstimate> {
    const opts: SnapshotOptions = {
      includeDisk: true,
      includeMemory: true,
      compress: true,
      compressionAlgorithm: 'zstd',
      compressionLevel: 3,
      verifyIntegrity: true,
      ...options,
    };

    const vmDir = path.join(this.vmBaseDir, vmId);

    return this.storage.estimateSnapshotSize(
      vmDir,
      opts.includeDisk,
      opts.includeMemory,
      opts.compress,
      opts.compressionAlgorithm
    );
  }

  /**
   * Export a snapshot to a file
   */
  async exportSnapshot(snapshotId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    logger.info('Exporting snapshot', { snapshotId, outputPath });

    const result = await this.storage.exportSnapshot(snapshotId, outputPath);

    if (result.success) {
      const snapshot = await this.storage.getSnapshot(snapshotId);
      this.emit({
        type: 'snapshot:exported',
        snapshotId,
        vmId: snapshot?.vmId || '',
      });
    }

    return result;
  }

  /**
   * Import a snapshot from a file
   */
  async importSnapshot(
    filePath: string,
    overwrite: boolean = false
  ): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
    logger.info('Importing snapshot', { filePath, overwrite });

    const result = await this.storage.importSnapshot(filePath, overwrite);

    if (result.success && result.snapshotId) {
      const snapshot = await this.storage.getSnapshot(result.snapshotId);
      this.emit({
        type: 'snapshot:imported',
        snapshotId: result.snapshotId,
        vmId: snapshot?.vmId || '',
      });
    }

    return result;
  }

  /**
   * Run cleanup of old snapshots
   */
  async cleanup(): Promise<{ removed: string[]; freedSpace: number }> {
    return this.storage.cleanupOldSnapshots();
  }

  /**
   * Create an auto-snapshot before risky operations
   */
  async createAutoSnapshot(vmId: string, operation: string): Promise<SnapshotResult> {
    const name = `auto-${operation}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const description = `Automatic snapshot before ${operation}`;

    return this.createSnapshot(vmId, name, description, {
      includeDisk: true,
      includeMemory: false, // Skip memory for speed
      compress: true,
      compressionLevel: 1, // Fast compression
      verifyIntegrity: false, // Skip for speed
      pauseVM: false, // Don't pause for auto-snapshots
    });
  }

  /**
   * Parse size string to bytes
   */
  private parseSizeToBytes(size: string): number {
    const match = size.match(/^(\d+)(GB|MB|KB)?$/i);
    if (!match) {
      return 0;
    }

    const value = parseInt(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    switch (unit) {
      case 'GB':
        return value * 1024 * 1024 * 1024;
      case 'MB':
        return value * 1024 * 1024;
      case 'KB':
        return value * 1024;
      default:
        return value;
    }
  }
}

/**
 * Singleton instance
 */
let managerInstance: SnapshotManager | null = null;

/**
 * Get the snapshot manager singleton
 */
export function getSnapshotManager(): SnapshotManager {
  if (!managerInstance) {
    managerInstance = new SnapshotManager();
  }
  return managerInstance;
}

/**
 * Reset the manager singleton (for testing)
 */
export function resetSnapshotManager(): void {
  managerInstance = null;
}
