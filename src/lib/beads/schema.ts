/**
 * Bead Sync Schema - Issue #907
 * Cross-rig bead synchronization data structures
 */

export interface BeadRecord {
  id: string;
  contentHash: string;
  version: number;
  createdAt: Date;
  syncedAt: Date | null;
  rigId: string;
  status: 'pending' | 'synced' | 'conflict' | 'failed';
}

export interface SyncProtocol {
  sourceRig: string;
  targetRig: string;
  beadIds: string[];
  timestamp: Date;
  checksum: string;
}

export interface ConflictResolution {
  beadId: string;
  localVersion: number;
  remoteVersion: number;
  resolution: 'local' | 'remote' | 'merge';
  resolvedAt: Date;
}

export type SyncStatus = 'idle' | 'syncing' | 'error';
