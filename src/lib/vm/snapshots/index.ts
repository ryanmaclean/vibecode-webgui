/**
 * VM Snapshots Module
 *
 * Provides snapshot management for VibeCode VMs.
 *
 * @module lib/vm/snapshots
 */

export { SnapshotManager, getSnapshotManager, resetSnapshotManager } from './snapshot-manager';
export { SnapshotStorage, getSnapshotStorage, resetSnapshotStorage } from './snapshot-storage';

export type {
  SnapshotEventType,
  SnapshotEvent,
  SnapshotEventListener,
} from './snapshot-manager';
