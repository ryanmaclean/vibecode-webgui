/**
 * Snapshot Storage Service
 *
 * Handles persistent storage of VM snapshots with compression,
 * indexing, integrity verification, and cleanup.
 *
 * Storage location: ~/Library/Application Support/VibeCode/snapshots
 *
 * @module lib/vm/snapshots/snapshot-storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/logger';
import type {
  SnapshotInfo,
  SnapshotMetadata,
  SnapshotStorageSettings,
  SnapshotSizeEstimate,
} from '@/types/vm-snapshot';

const execFile = promisify(execFileCallback);

/**
 * Snapshot index structure stored on disk
 */
interface SnapshotIndex {
  version: number;
  snapshots: Record<string, SnapshotInfo>;
  lastUpdated: string;
}

/**
 * Compression utilities result
 */
interface CompressionResult {
  success: boolean;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  error?: string;
}

/**
 * SnapshotStorage class manages all snapshot file operations
 */
export class SnapshotStorage {
  private baseDir: string;
  private indexPath: string;
  private settings: SnapshotStorageSettings;
  private index: SnapshotIndex | null = null;
  private initialized = false;

  constructor(settings?: Partial<SnapshotStorageSettings>) {
    // Expand ~ to home directory
    const defaultBase = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'VibeCode',
      'snapshots'
    );

    this.settings = {
      baseDir: defaultBase,
      maxSnapshots: 20,
      maxTotalSize: 100 * 1024 * 1024 * 1024, // 100GB
      autoCleanup: true,
      retentionDays: 30,
      defaultCompression: 'zstd',
      defaultCompressionLevel: 3,
      ...settings,
    };

    // Expand ~ in baseDir if present
    this.baseDir = this.settings.baseDir.replace(/^~/, os.homedir());
    this.indexPath = path.join(this.baseDir, 'index.json');
  }

  /**
   * Initialize storage directory and index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create base directory
      await fs.mkdir(this.baseDir, { recursive: true });

      // Load or create index
      await this.loadIndex();

      this.initialized = true;
      logger.info('Snapshot storage initialized', { baseDir: this.baseDir });
    } catch (error) {
      logger.error('Failed to initialize snapshot storage', { error });
      throw error;
    }
  }

  /**
   * Load snapshot index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(data);

      // Convert date strings back to Date objects
      if (this.index) {
        for (const snapshot of Object.values(this.index.snapshots)) {
          snapshot.createdAt = new Date(snapshot.createdAt);
        }
      }

      logger.debug('Snapshot index loaded', {
        count: Object.keys(this.index?.snapshots || {}).length,
      });
    } catch (error) {
      // Index doesn't exist, create new one
      this.index = {
        version: 1,
        snapshots: {},
        lastUpdated: new Date().toISOString(),
      };
      await this.saveIndex();
      logger.info('Created new snapshot index');
    }
  }

  /**
   * Save snapshot index to disk
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    this.index.lastUpdated = new Date().toISOString();

    // Write to temp file first, then rename for atomicity
    const tempPath = `${this.indexPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.index, null, 2));
    await fs.rename(tempPath, this.indexPath);

    logger.debug('Snapshot index saved');
  }

  /**
   * Get the storage path for a snapshot
   */
  getSnapshotPath(snapshotId: string): string {
    return path.join(this.baseDir, snapshotId);
  }

  /**
   * Create a new snapshot directory
   */
  async createSnapshotDirectory(snapshotId: string): Promise<string> {
    await this.ensureInitialized();

    const snapshotDir = this.getSnapshotPath(snapshotId);
    await fs.mkdir(snapshotDir, { recursive: true });

    logger.debug('Created snapshot directory', { snapshotDir });
    return snapshotDir;
  }

  /**
   * Store snapshot metadata in index
   */
  async addToIndex(snapshot: SnapshotInfo): Promise<void> {
    await this.ensureInitialized();

    if (!this.index) {
      throw new Error('Snapshot index not initialized');
    }

    this.index.snapshots[snapshot.id] = snapshot;
    await this.saveIndex();

    logger.info('Added snapshot to index', { id: snapshot.id, name: snapshot.name });
  }

  /**
   * Update snapshot in index
   */
  async updateInIndex(snapshotId: string, updates: Partial<SnapshotInfo>): Promise<void> {
    await this.ensureInitialized();

    if (!this.index || !this.index.snapshots[snapshotId]) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    this.index.snapshots[snapshotId] = {
      ...this.index.snapshots[snapshotId],
      ...updates,
    };
    await this.saveIndex();

    logger.debug('Updated snapshot in index', { snapshotId, updates });
  }

  /**
   * Remove snapshot from index
   */
  async removeFromIndex(snapshotId: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.index) {
      throw new Error('Snapshot index not initialized');
    }

    delete this.index.snapshots[snapshotId];
    await this.saveIndex();

    logger.info('Removed snapshot from index', { snapshotId });
  }

  /**
   * Get snapshot info from index
   */
  async getSnapshot(snapshotId: string): Promise<SnapshotInfo | null> {
    await this.ensureInitialized();
    return this.index?.snapshots[snapshotId] || null;
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<SnapshotInfo[]> {
    await this.ensureInitialized();

    if (!this.index) {
      return [];
    }

    return Object.values(this.index.snapshots).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get snapshots for a specific VM
   */
  async getSnapshotsForVM(vmId: string): Promise<SnapshotInfo[]> {
    const all = await this.listSnapshots();
    return all.filter((s) => s.vmId === vmId);
  }

  /**
   * Check if a command exists on the system
   */
  private async commandExists(command: string): Promise<boolean> {
    try {
      await execFile('which', [command]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compress a file using the specified algorithm
   */
  async compressFile(
    inputPath: string,
    algorithm: 'zstd' | 'gzip' | 'lz4' = 'zstd',
    level: number = 3
  ): Promise<CompressionResult> {
    const extension = algorithm === 'zstd' ? 'zst' : algorithm === 'gzip' ? 'gz' : 'lz4';
    const outputPath = `${inputPath}.${extension}`;

    try {
      const inputStats = await fs.stat(inputPath);
      const originalSize = inputStats.size;

      switch (algorithm) {
        case 'zstd':
          if (await this.commandExists('zstd')) {
            await execFile('zstd', [`-${level}`, '-f', '-o', outputPath, inputPath]);
          } else {
            logger.warn('zstd not available, falling back to gzip');
            return this.compressFile(inputPath, 'gzip', level > 9 ? 9 : level);
          }
          break;
        case 'gzip':
          // gzip doesn't support -o, use file operations
          const gzipLevel = Math.min(level, 9);
          await execFile('gzip', [`-${gzipLevel}`, '-c', inputPath], {
            maxBuffer: 1024 * 1024 * 1024 // 1GB buffer
          }).then(async ({ stdout }) => {
            await fs.writeFile(outputPath, stdout);
          });
          break;
        case 'lz4':
          if (await this.commandExists('lz4')) {
            await execFile('lz4', [`-${Math.min(level, 12)}`, '-f', inputPath, outputPath]);
          } else {
            logger.warn('lz4 not available, falling back to gzip');
            return this.compressFile(inputPath, 'gzip', level > 9 ? 9 : level);
          }
          break;
      }

      const outputStats = await fs.stat(outputPath);

      logger.info('File compressed', {
        algorithm,
        level,
        originalSize,
        compressedSize: outputStats.size,
        ratio: (outputStats.size / originalSize).toFixed(2),
      });

      return {
        success: true,
        outputPath,
        originalSize,
        compressedSize: outputStats.size,
      };
    } catch (error) {
      logger.error('Compression failed', { inputPath, algorithm, error });
      return {
        success: false,
        outputPath: '',
        originalSize: 0,
        compressedSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Decompress a file
   */
  async decompressFile(inputPath: string): Promise<{ success: boolean; outputPath: string; error?: string }> {
    try {
      let outputPath: string;

      if (inputPath.endsWith('.zst')) {
        outputPath = inputPath.replace(/\.zst$/, '');
        if (!(await this.commandExists('zstd'))) {
          throw new Error('zstd is required to decompress .zst files');
        }
        await execFile('zstd', ['-d', '-f', '-o', outputPath, inputPath]);
      } else if (inputPath.endsWith('.gz')) {
        outputPath = inputPath.replace(/\.gz$/, '');
        const { stdout } = await execFile('gunzip', ['-c', inputPath], {
          maxBuffer: 1024 * 1024 * 1024 // 1GB buffer
        });
        await fs.writeFile(outputPath, stdout);
      } else if (inputPath.endsWith('.lz4')) {
        outputPath = inputPath.replace(/\.lz4$/, '');
        if (!(await this.commandExists('lz4'))) {
          throw new Error('lz4 is required to decompress .lz4 files');
        }
        await execFile('lz4', ['-d', '-f', inputPath, outputPath]);
      } else {
        // Not compressed, just return the input path
        return { success: true, outputPath: inputPath };
      }

      logger.info('File decompressed', { inputPath, outputPath });

      return { success: true, outputPath };
    } catch (error) {
      logger.error('Decompression failed', { inputPath, error });
      return {
        success: false,
        outputPath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate SHA-256 checksum of a file
   */
  async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Verify file integrity against stored checksum
   */
  async verifyIntegrity(filePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(filePath);
      const valid = actualChecksum === expectedChecksum;

      if (!valid) {
        logger.warn('Checksum mismatch', {
          filePath,
          expected: expectedChecksum,
          actual: actualChecksum,
        });
      }

      return valid;
    } catch (error) {
      logger.error('Integrity check failed', { filePath, error });
      return false;
    }
  }

  /**
   * Calculate size of a directory
   */
  async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(entryPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.error('Failed to calculate directory size', { dirPath, error });
    }

    return totalSize;
  }

  /**
   * Get total size of all snapshots
   */
  async getTotalSnapshotSize(): Promise<number> {
    return this.calculateDirectorySize(this.baseDir);
  }

  /**
   * Get available disk space
   */
  private async getAvailableSpace(): Promise<number> {
    try {
      const { stdout } = await execFile('df', ['-k', this.baseDir]);
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          return parseInt(parts[3]) * 1024;
        }
      }
      return Infinity;
    } catch {
      return Infinity; // Can't check, assume enough
    }
  }

  /**
   * Estimate size for a new snapshot
   */
  async estimateSnapshotSize(
    vmDir: string,
    includeDisk: boolean,
    includeMemory: boolean,
    compress: boolean,
    compressionAlgorithm: 'zstd' | 'gzip' | 'lz4' = 'zstd'
  ): Promise<SnapshotSizeEstimate> {
    let diskSize = 0;
    let memorySize = 0;

    // Estimate disk size
    if (includeDisk) {
      const diskPath = path.join(vmDir, 'disk', 'root.img');
      try {
        const stats = await fs.stat(diskPath);
        diskSize = stats.size;
      } catch {
        // Disk doesn't exist yet
      }
    }

    // Estimate memory size (assume saved state file)
    if (includeMemory) {
      // Estimate based on VM memory allocation
      // This would need to be passed in or read from config
      memorySize = 4 * 1024 * 1024 * 1024; // 4GB default estimate
    }

    const uncompressedSize = diskSize + memorySize;

    // Compression ratio estimates
    const ratios: Record<string, number> = {
      zstd: 0.35, // zstd typically achieves 65%+ compression on VM images
      gzip: 0.45, // gzip is slightly less efficient
      lz4: 0.55, // lz4 prioritizes speed over compression
    };

    const compressionRatio = compress ? ratios[compressionAlgorithm] : 1;
    const compressedSize = Math.floor(uncompressedSize * compressionRatio);

    const availableSpace = await this.getAvailableSpace();

    return {
      diskSize,
      memorySize,
      uncompressedSize,
      compressedSize,
      compressionRatio,
      availableSpace,
      hasEnoughSpace: availableSpace > compressedSize * 1.1, // 10% buffer
    };
  }

  /**
   * Clean up old snapshots based on settings
   */
  async cleanupOldSnapshots(): Promise<{ removed: string[]; freedSpace: number }> {
    if (!this.settings.autoCleanup) {
      return { removed: [], freedSpace: 0 };
    }

    await this.ensureInitialized();

    const removed: string[] = [];
    let freedSpace = 0;

    const snapshots = await this.listSnapshots();

    // Remove snapshots older than retention period
    if (this.settings.retentionDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.settings.retentionDays);

      for (const snapshot of snapshots) {
        if (new Date(snapshot.createdAt) < cutoffDate) {
          try {
            freedSpace += snapshot.size;
            await this.deleteSnapshot(snapshot.id);
            removed.push(snapshot.id);
            logger.info('Removed expired snapshot', {
              id: snapshot.id,
              name: snapshot.name,
              createdAt: snapshot.createdAt,
            });
          } catch (error) {
            logger.error('Failed to remove expired snapshot', { id: snapshot.id, error });
          }
        }
      }
    }

    // Remove excess snapshots beyond max count
    const remainingSnapshots = await this.listSnapshots();
    if (remainingSnapshots.length > this.settings.maxSnapshots) {
      const toRemove = remainingSnapshots.slice(this.settings.maxSnapshots);
      for (const snapshot of toRemove) {
        try {
          freedSpace += snapshot.size;
          await this.deleteSnapshot(snapshot.id);
          removed.push(snapshot.id);
          logger.info('Removed excess snapshot', { id: snapshot.id, name: snapshot.name });
        } catch (error) {
          logger.error('Failed to remove excess snapshot', { id: snapshot.id, error });
        }
      }
    }

    // Check total size limit
    let currentTotal = await this.getTotalSnapshotSize();
    if (currentTotal > this.settings.maxTotalSize) {
      const remaining = await this.listSnapshots();
      // Remove oldest until under limit
      for (let i = remaining.length - 1; i >= 0 && currentTotal > this.settings.maxTotalSize; i--) {
        const snapshot = remaining[i];
        try {
          freedSpace += snapshot.size;
          currentTotal -= snapshot.size;
          await this.deleteSnapshot(snapshot.id);
          removed.push(snapshot.id);
          logger.info('Removed snapshot to free space', { id: snapshot.id, name: snapshot.name });
        } catch (error) {
          logger.error('Failed to remove snapshot for space', { id: snapshot.id, error });
        }
      }
    }

    if (removed.length > 0) {
      logger.info('Cleanup completed', { removed: removed.length, freedSpace });
    }

    return { removed, freedSpace };
  }

  /**
   * Delete a snapshot and its files
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const snapshotDir = this.getSnapshotPath(snapshotId);

    // Remove files
    try {
      await fs.rm(snapshotDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Failed to remove snapshot directory', { snapshotDir, error });
    }

    // Remove from index
    await this.removeFromIndex(snapshotId);

    logger.info('Snapshot deleted', { snapshotId });
  }

  /**
   * Save snapshot metadata file
   */
  async saveMetadata(snapshotId: string, metadata: SnapshotMetadata): Promise<void> {
    const metadataPath = path.join(this.getSnapshotPath(snapshotId), 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    logger.debug('Saved snapshot metadata', { snapshotId });
  }

  /**
   * Load snapshot metadata file
   */
  async loadMetadata(snapshotId: string): Promise<SnapshotMetadata | null> {
    try {
      const metadataPath = path.join(this.getSnapshotPath(snapshotId), 'metadata.json');
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get storage settings
   */
  getSettings(): SnapshotStorageSettings {
    return { ...this.settings };
  }

  /**
   * Update storage settings
   */
  async updateSettings(newSettings: Partial<SnapshotStorageSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    // If baseDir changed, reinitialize
    if (newSettings.baseDir) {
      this.baseDir = newSettings.baseDir.replace(/^~/, os.homedir());
      this.indexPath = path.join(this.baseDir, 'index.json');
      this.initialized = false;
      await this.initialize();
    }
  }

  /**
   * Export a snapshot to a portable archive
   */
  async exportSnapshot(snapshotId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Use tar with execFile for safer execution
      await execFile('tar', ['-czf', outputPath, '-C', this.baseDir, snapshotId]);

      logger.info('Snapshot exported', { snapshotId, outputPath });

      return { success: true };
    } catch (error) {
      logger.error('Failed to export snapshot', { snapshotId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Import a snapshot from an archive
   */
  async importSnapshot(
    archivePath: string,
    overwrite: boolean = false
  ): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
    try {
      await this.ensureInitialized();

      // Extract to temp directory first
      const tempDir = path.join(os.tmpdir(), `snapshot-import-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        await execFile('tar', ['-xzf', archivePath, '-C', tempDir]);

        // Find the snapshot directory
        const entries = await fs.readdir(tempDir);
        if (entries.length !== 1) {
          throw new Error('Invalid snapshot archive structure');
        }

        const snapshotId = entries[0];
        const extractedPath = path.join(tempDir, snapshotId);
        const targetPath = this.getSnapshotPath(snapshotId);

        // Check if exists
        try {
          await fs.access(targetPath);
          if (!overwrite) {
            throw new Error(`Snapshot ${snapshotId} already exists`);
          }
          await fs.rm(targetPath, { recursive: true });
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw e;
          }
        }

        // Move to snapshots directory
        await fs.rename(extractedPath, targetPath);

        // Load metadata and add to index
        const indexInfoPath = path.join(targetPath, 'snapshot-info.json');

        try {
          const infoData = await fs.readFile(indexInfoPath, 'utf-8');
          const snapshotInfo: SnapshotInfo = JSON.parse(infoData);
          snapshotInfo.createdAt = new Date(snapshotInfo.createdAt);
          snapshotInfo.path = targetPath;
          await this.addToIndex(snapshotInfo);
        } catch {
          logger.warn('Could not load snapshot info, creating minimal entry');
        }

        logger.info('Snapshot imported', { snapshotId, archivePath });

        return { success: true, snapshotId };
      } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger.error('Failed to import snapshot', { archivePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Singleton instance
 */
let storageInstance: SnapshotStorage | null = null;

/**
 * Get the snapshot storage singleton
 */
export function getSnapshotStorage(settings?: Partial<SnapshotStorageSettings>): SnapshotStorage {
  if (!storageInstance) {
    storageInstance = new SnapshotStorage(settings);
  }
  return storageInstance;
}

/**
 * Reset the storage singleton (for testing)
 */
export function resetSnapshotStorage(): void {
  storageInstance = null;
}
