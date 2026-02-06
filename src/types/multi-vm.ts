/**
 * Multi-VM Type Definitions
 * Types for managing multiple VM instances in VibeCode
 */

import type { VMConfig, VMStatus, PortMapping as BasePortMapping, VolumeMapping, ProvisionScript } from '@/lib/vm/types';

/**
 * Extended port mapping with allocation tracking
 */
export interface PortMapping extends BasePortMapping {
  /** Service name for this port */
  service?: string;
  /** Whether this port was auto-allocated */
  autoAllocated?: boolean;
}

/**
 * Resource allocation for a VM
 */
export interface VMResource {
  /** Number of CPU cores allocated */
  cpuCores: number;
  /** Memory in MB */
  memoryMB: number;
  /** Disk size in MB */
  diskMB: number;
  /** GPU allocation (if supported) */
  gpu?: {
    enabled: boolean;
    type?: string;
    memory?: number;
  };
}

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  /** Maximum number of VMs */
  maxVMs: number;
  /** Maximum total CPU cores across all VMs */
  maxTotalCPU: number;
  /** Maximum total memory in MB */
  maxTotalMemoryMB: number;
  /** Maximum total disk in MB */
  maxTotalDiskMB: number;
  /** Maximum percentage of system resources to use (0-100) */
  maxSystemUsagePercent: number;
}

/**
 * System resource information
 */
export interface SystemResources {
  /** Total CPU cores available */
  totalCPU: number;
  /** Total memory in MB */
  totalMemoryMB: number;
  /** Available memory in MB */
  availableMemoryMB: number;
  /** Total disk space in MB */
  totalDiskMB: number;
  /** Available disk space in MB */
  availableDiskMB: number;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  /** Total CPU cores in use */
  cpuCoresUsed: number;
  /** Total memory in use (MB) */
  memoryUsedMB: number;
  /** Total disk in use (MB) */
  diskUsedMB: number;
  /** Number of active VMs */
  activeVMs: number;
  /** Percentage of allowed resources used */
  usagePercent: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

/**
 * VM instance status including detailed metrics
 */
export interface VMInstanceStatus {
  /** Base status */
  status: VMStatus;
  /** VM health score (0-100) */
  health: number;
  /** Uptime in seconds */
  uptimeSeconds?: number;
  /** Last health check timestamp */
  lastHealthCheck?: Date;
  /** Current resource usage */
  currentUsage?: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
  };
  /** Error message if status is 'error' */
  errorMessage?: string;
}

/**
 * Running service in a VM
 */
export interface VMService {
  /** Service name */
  name: string;
  /** Service status */
  status: 'running' | 'stopped' | 'starting' | 'error';
  /** Port the service is running on */
  port?: number;
  /** Health check URL (if applicable) */
  healthCheckUrl?: string;
}

/**
 * VM instance representing a running or stopped VM
 */
export interface VMInstance {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Instance status */
  status: VMInstanceStatus;
  /** Configuration used to create this VM */
  config: VMConfig;
  /** Port mappings (host to guest) */
  ports: PortMapping[];
  /** Associated project (if any) */
  project?: {
    id: string;
    name: string;
    path: string;
  };
  /** Profile used to create this VM */
  profileId?: string;
  /** Resource allocation */
  resources: VMResource;
  /** Running services */
  services: VMService[];
  /** VM IP address (if available) */
  ipAddress?: string;
  /** SSH connection details */
  ssh?: {
    host: string;
    port: number;
    user: string;
    keyPath?: string;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** VM metadata */
  metadata?: Record<string, unknown>;
  /** Tags for organization */
  tags?: string[];
}

/**
 * VM Profile template for creating VMs
 */
export interface VMProfile {
  /** Unique identifier */
  id: string;
  /** Profile name */
  name: string;
  /** Description of the profile */
  description: string;
  /** Base configuration */
  config: Partial<VMConfig>;
  /** Default resource allocation */
  resources: VMResource;
  /** Default port mappings */
  defaultPorts: PortMapping[];
  /** Pre-installed services */
  services: string[];
  /** Provisioning scripts */
  provision?: ProvisionScript[];
  /** Profile category */
  category: 'development' | 'testing' | 'minimal' | 'custom';
  /** Is this a built-in profile */
  isBuiltIn: boolean;
  /** Profile icon/emoji */
  icon?: string;
  /** Estimated setup time in seconds */
  estimatedSetupTime?: number;
  /** Profile version */
  version?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * VM Cluster - group of related VMs
 */
export interface VMCluster {
  /** Unique identifier */
  id: string;
  /** Cluster name */
  name: string;
  /** Description */
  description?: string;
  /** VM instance IDs in this cluster */
  vmIds: string[];
  /** Shared network configuration */
  network?: {
    /** Network name */
    name: string;
    /** Network subnet (e.g., "10.0.0.0/24") */
    subnet: string;
    /** Enable inter-VM communication */
    allowInterVMCommunication: boolean;
  };
  /** Shared environment variables */
  sharedEnv?: Record<string, string>;
  /** Cluster status */
  status: 'active' | 'partial' | 'stopped' | 'error';
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Port range configuration
 */
export interface PortRange {
  /** Start of range (inclusive) */
  start: number;
  /** End of range (inclusive) */
  end: number;
  /** Protocol */
  protocol: 'tcp' | 'udp' | 'both';
}

/**
 * Port allocation result
 */
export interface PortAllocation {
  /** Whether allocation was successful */
  success: boolean;
  /** Allocated host port (if successful) */
  hostPort?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * VM Pool state
 */
export interface VMPoolState {
  /** All VM instances */
  instances: VMInstance[];
  /** All clusters */
  clusters: VMCluster[];
  /** Resource usage */
  resourceUsage: ResourceUsage;
  /** Resource limits */
  limits: ResourceLimits;
  /** System resources */
  systemResources: SystemResources;
  /** Allocated ports */
  allocatedPorts: Map<number, string>; // port -> vmId
}

/**
 * VM creation options
 */
export interface CreateVMOptions {
  /** VM name (will be auto-generated if not provided) */
  name?: string;
  /** Profile ID to use */
  profileId?: string;
  /** Custom configuration (merged with profile) */
  config?: Partial<VMConfig>;
  /** Resource overrides */
  resources?: Partial<VMResource>;
  /** Custom port mappings */
  ports?: PortMapping[];
  /** Project association */
  project?: {
    id: string;
    name: string;
    path: string;
  };
  /** Tags */
  tags?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Start VM immediately after creation */
  autoStart?: boolean;
}

/**
 * VM clone options
 */
export interface CloneVMOptions {
  /** New name for the cloned VM */
  name?: string;
  /** Include volumes in clone */
  includeVolumes?: boolean;
  /** Start cloned VM immediately */
  autoStart?: boolean;
  /** New tags for the clone */
  tags?: string[];
}

/**
 * VM operation result
 */
export interface VMOperationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Operation message */
  message: string;
  /** VM instance (if applicable) */
  vm?: VMInstance;
  /** Error details (if failed) */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * VM list query options
 */
export interface VMListOptions {
  /** Filter by status */
  status?: VMStatus | VMStatus[];
  /** Filter by project ID */
  projectId?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by cluster ID */
  clusterId?: string;
  /** Sort by field */
  sortBy?: 'name' | 'createdAt' | 'status' | 'resources.memoryMB';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Profile export format
 */
export interface ProfileExport {
  /** Export version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Profile data */
  profile: Omit<VMProfile, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>;
}

/**
 * Dashboard statistics
 */
export interface VMDashboardStats {
  /** Total VMs */
  totalVMs: number;
  /** Running VMs */
  runningVMs: number;
  /** Stopped VMs */
  stoppedVMs: number;
  /** VMs with errors */
  errorVMs: number;
  /** Total resource usage */
  resourceUsage: ResourceUsage;
  /** Available capacity */
  availableCapacity: {
    vms: number;
    cpuCores: number;
    memoryMB: number;
  };
}
