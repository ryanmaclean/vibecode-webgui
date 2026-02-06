/**
 * VM Provider Types
 * Unified interface for vfkit, Lima, QEMU, and WSL2
 */

export interface VMProvider {
  /** Provider name (vfkit, lima, qemu, wsl2) */
  name: string;

  /** Detect if provider is available on current system */
  detect(): Promise<boolean>;

  /** Create and start a new VM */
  create(config: VMConfig): Promise<VM>;

  /** Start an existing VM */
  start(vmId: string): Promise<void>;

  /** Stop a running VM */
  stop(vmId: string): Promise<void>;

  /** Destroy a VM and its resources */
  destroy(vmId: string): Promise<void>;

  /** List all VMs managed by this provider */
  list(): Promise<VM[]>;

  /** Execute command in VM */
  exec(vmId: string, command: string): Promise<ExecResult>;

  /** Get VM status */
  status(vmId: string): Promise<VMStatus>;

  // Snapshot-related methods (optional)

  /** Pause VM (for snapshotting) */
  pause?(vmId: string): Promise<void>;

  /** Resume a paused VM */
  resume?(vmId: string): Promise<void>;

  /** Save VM state to file (if supported) */
  saveState?(vmId: string, statePath: string): Promise<boolean>;

  /** Restore VM state from file (if supported) */
  restoreState?(vmId: string, statePath: string): Promise<boolean>;

  /** Get VM configuration */
  getConfig?(vmId: string): Promise<VMConfig | null>;

  /** Get provider capabilities */
  getCapabilities?(): Promise<ProviderCapabilities>;
}

export interface VMConfig {
  /** VM name (must be unique) */
  name: string;
  
  /** Number of CPU cores */
  cpus: number;
  
  /** Memory size (e.g., "4GB", "2048MB") */
  memory: string;
  
  /** Disk size (e.g., "20GB", "100GB") */
  disk: string;
  
  /** Base image (alpine-3.22, ubuntu-24.04, etc.) */
  image: string;
  
  /** Architecture (arm64, x86_64, auto) */
  arch?: 'arm64' | 'x86_64' | 'auto';
  
  /** Port mappings */
  ports?: PortMapping[];
  
  /** Volume mappings */
  volumes?: VolumeMapping[];
  
  /** Provisioning scripts */
  provision?: ProvisionScript[];
  
  /** Environment variables */
  env?: Record<string, string>;
  
  /** Provider-specific options */
  providerOptions?: Record<string, any>;
}

export interface VM {
  /** Unique VM identifier */
  id: string;
  
  /** VM name */
  name: string;
  
  /** Provider managing this VM */
  provider: string;
  
  /** Current status */
  status: VMStatus;
  
  /** VM IP address (if available) */
  ip?: string;
  
  /** Port mappings */
  ports: PortMapping[];
  
  /** Volume mappings */
  volumes?: VolumeMapping[];
  
  /** VM metadata */
  metadata?: Record<string, any>;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
}

export type VMStatus = 
  | 'creating'
  | 'running'
  | 'stopped'
  | 'stopping'
  | 'error'
  | 'unknown';

export interface PortMapping {
  /** Guest (VM) port */
  guest: number;
  
  /** Host port */
  host: number;
  
  /** Protocol (tcp, udp) */
  protocol?: 'tcp' | 'udp';
}

export interface VolumeMapping {
  /** Host path */
  host: string;
  
  /** Guest (VM) path */
  guest: string;
  
  /** Writable flag */
  writable?: boolean;
}

export interface ProvisionScript {
  /** Execution mode (system, user) */
  mode: 'system' | 'user';
  
  /** Script content */
  script: string;
  
  /** Script description */
  description?: string;
}

export interface ExecResult {
  /** Exit code */
  exitCode: number;
  
  /** Standard output */
  stdout: string;
  
  /** Standard error */
  stderr: string;
  
  /** Execution duration (ms) */
  duration: number;
}

export interface ProviderCapabilities {
  /** Supports port forwarding */
  portForwarding: boolean;
  
  /** Supports volume mounting */
  volumeMounting: boolean;
  
  /** Supports snapshots */
  snapshots: boolean;
  
  /** Supports live migration */
  liveMigration: boolean;
  
  /** Supports GPU passthrough */
  gpuPassthrough: boolean;
  
  /** Maximum CPUs */
  maxCpus: number;
  
  /** Maximum memory (GB) */
  maxMemory: number;
}

export interface SystemInfo {
  /** Operating system */
  os: 'darwin' | 'linux' | 'win32' | 'freebsd';
  
  /** CPU architecture */
  arch: 'arm64' | 'x86_64';
  
  /** Is Apple Silicon */
  isAppleSilicon: boolean;
  
  /** Available providers */
  availableProviders: string[];
  
  /** Recommended provider */
  recommendedProvider: string;
}
