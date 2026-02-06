/**
 * VM Snapshot Type Definitions
 *
 * Types for saving and restoring VM state in VibeCode.
 * Supports both vfkit save-state and disk image + memory serialization.
 *
 * @module types/vm-snapshot
 */

/**
 * Current state of a snapshot operation
 */
export type SnapshotState = 'creating' | 'ready' | 'restoring' | 'error';

/**
 * Information about a saved snapshot
 */
export interface SnapshotInfo {
  /** Unique snapshot identifier */
  id: string;

  /** User-provided snapshot name */
  name: string;

  /** Optional description of the snapshot */
  description?: string;

  /** When the snapshot was created */
  createdAt: Date;

  /** Total size of the snapshot in bytes */
  size: number;

  /** Current state of the snapshot */
  state: SnapshotState;

  /** ID of the VM this snapshot was created from */
  vmId: string;

  /** VM name at time of snapshot */
  vmName: string;

  /** Whether disk image is included */
  includesDisk: boolean;

  /** Whether memory state is included */
  includesMemory: boolean;

  /** Whether the snapshot is compressed */
  compressed: boolean;

  /** Compression algorithm used (if compressed) */
  compressionAlgorithm?: 'zstd' | 'gzip' | 'lz4';

  /** Snapshot metadata */
  metadata: SnapshotMetadata;

  /** Integrity checksum (SHA-256) */
  checksum?: string;

  /** Path to snapshot files */
  path: string;

  /** Error message if state is 'error' */
  error?: string;
}

/**
 * Options for creating a snapshot
 */
export interface SnapshotOptions {
  /** Include disk image in snapshot (default: true) */
  includeDisk: boolean;

  /** Include memory state in snapshot (default: true) */
  includeMemory: boolean;

  /** Compress the snapshot (default: true) */
  compress: boolean;

  /** Compression algorithm (default: 'zstd') */
  compressionAlgorithm?: 'zstd' | 'gzip' | 'lz4';

  /** Compression level (1-22 for zstd, 1-9 for gzip/lz4) */
  compressionLevel?: number;

  /** Calculate and store checksum (default: true) */
  verifyIntegrity: boolean;

  /** Optional tags for organization */
  tags?: string[];

  /** Whether to pause VM during snapshot (recommended) */
  pauseVM?: boolean;
}

/**
 * Metadata captured at snapshot time
 */
export interface SnapshotMetadata {
  /** Services running at snapshot time */
  services: ServiceInfo[];

  /** Port mappings active at snapshot time */
  ports: PortInfo[];

  /** Environment variables (sanitized - no secrets) */
  environment: Record<string, string>;

  /** VM configuration at snapshot time */
  vmConfig: VMSnapshotConfig;

  /** Host system info */
  hostInfo: HostInfo;

  /** VibeCode version */
  vibecodeVersion: string;

  /** Custom user metadata */
  custom?: Record<string, unknown>;
}

/**
 * Service information captured at snapshot time
 */
export interface ServiceInfo {
  /** Service name */
  name: string;

  /** Service status */
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'unknown';

  /** Process ID if running */
  pid?: number;

  /** Port the service is listening on */
  port?: number;

  /** Service health status */
  healthy?: boolean;
}

/**
 * Port mapping information
 */
export interface PortInfo {
  /** Host port */
  host: number;

  /** Guest (VM) port */
  guest: number;

  /** Protocol */
  protocol: 'tcp' | 'udp';

  /** Service using this port */
  service?: string;
}

/**
 * VM configuration snapshot
 */
export interface VMSnapshotConfig {
  /** Number of CPUs allocated */
  cpus: number;

  /** Memory allocated (in bytes) */
  memory: number;

  /** Disk size (in bytes) */
  diskSize: number;

  /** VM architecture */
  arch: 'arm64' | 'x86_64';

  /** VM provider */
  provider: string;

  /** Base image used */
  image: string;
}

/**
 * Host system information
 */
export interface HostInfo {
  /** Operating system */
  os: 'darwin' | 'linux' | 'win32';

  /** OS version */
  osVersion: string;

  /** CPU architecture */
  arch: 'arm64' | 'x86_64';

  /** Hostname */
  hostname: string;
}

/**
 * Result of a snapshot operation
 */
export interface SnapshotResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** The snapshot info if successful */
  snapshot?: SnapshotInfo;

  /** Error message if failed */
  error?: string;

  /** Additional details about the error */
  errorDetails?: string;

  /** Duration of the operation in milliseconds */
  duration: number;
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  /** Whether the restore succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Additional details about the error */
  errorDetails?: string;

  /** Duration of the restore in milliseconds */
  duration: number;

  /** Services that were restored */
  restoredServices?: string[];

  /** Warnings during restore */
  warnings?: string[];
}

/**
 * Snapshot list response
 */
export interface SnapshotListResponse {
  /** List of snapshots */
  snapshots: SnapshotInfo[];

  /** Total count */
  total: number;

  /** Total size of all snapshots */
  totalSize: number;
}

/**
 * Snapshot size estimation
 */
export interface SnapshotSizeEstimate {
  /** Estimated disk size */
  diskSize: number;

  /** Estimated memory size */
  memorySize: number;

  /** Estimated total size before compression */
  uncompressedSize: number;

  /** Estimated total size after compression */
  compressedSize: number;

  /** Compression ratio estimate */
  compressionRatio: number;

  /** Available disk space */
  availableSpace: number;

  /** Whether there is enough space */
  hasEnoughSpace: boolean;
}

/**
 * Snapshot export options
 */
export interface SnapshotExportOptions {
  /** Export format */
  format: 'archive' | 'raw';

  /** Include metadata file */
  includeMetadata: boolean;

  /** Encrypt the export */
  encrypt?: boolean;

  /** Encryption password (if encrypt is true) */
  password?: string;
}

/**
 * Snapshot import options
 */
export interface SnapshotImportOptions {
  /** Override existing snapshot with same name */
  overwrite: boolean;

  /** Decryption password (if encrypted) */
  password?: string;

  /** Verify integrity after import */
  verify: boolean;
}

/**
 * Snapshot storage settings
 */
export interface SnapshotStorageSettings {
  /** Base directory for snapshots */
  baseDir: string;

  /** Maximum number of snapshots to keep */
  maxSnapshots: number;

  /** Maximum total size for snapshots (in bytes) */
  maxTotalSize: number;

  /** Auto-cleanup old snapshots when limits exceeded */
  autoCleanup: boolean;

  /** Retention period for snapshots (in days, 0 = forever) */
  retentionDays: number;

  /** Default compression algorithm */
  defaultCompression: 'zstd' | 'gzip' | 'lz4' | 'none';

  /** Default compression level */
  defaultCompressionLevel: number;
}

/**
 * Default snapshot options
 */
export const DEFAULT_SNAPSHOT_OPTIONS: SnapshotOptions = {
  includeDisk: true,
  includeMemory: true,
  compress: true,
  compressionAlgorithm: 'zstd',
  compressionLevel: 3,
  verifyIntegrity: true,
  pauseVM: true,
};

/**
 * Default snapshot storage settings
 */
export const DEFAULT_SNAPSHOT_STORAGE_SETTINGS: SnapshotStorageSettings = {
  baseDir: '~/Library/Application Support/VibeCode/snapshots',
  maxSnapshots: 20,
  maxTotalSize: 100 * 1024 * 1024 * 1024, // 100GB
  autoCleanup: true,
  retentionDays: 30,
  defaultCompression: 'zstd',
  defaultCompressionLevel: 3,
};

/**
 * Snapshot API request types
 */
export interface CreateSnapshotRequest {
  vmId: string;
  name: string;
  description?: string;
  options?: Partial<SnapshotOptions>;
}

export interface RestoreSnapshotRequest {
  snapshotId: string;
  targetVmId?: string;
  createNewVM?: boolean;
}

export interface DeleteSnapshotRequest {
  snapshotId: string;
  force?: boolean;
}

export interface ExportSnapshotRequest {
  snapshotId: string;
  options?: SnapshotExportOptions;
}

export interface ImportSnapshotRequest {
  filePath: string;
  options?: SnapshotImportOptions;
}

/**
 * Snapshot API response types
 */
export interface SnapshotAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}
