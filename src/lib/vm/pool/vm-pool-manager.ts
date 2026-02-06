/**
 * VM Pool Manager
 * Manages multiple VM instances with resource tracking and lifecycle management
 */

import { createServiceLogger } from '@/lib/logging';
import { ProviderFactory } from '../provider-factory';
import { getPortManager, PortManager } from '../ports/port-manager';
import { getProfilesService, VMProfilesService } from '../profiles/vm-profiles';
import type { VMProvider, VMConfig, VMStatus, ExecResult } from '../types';
import type {
  VMInstance,
  VMInstanceStatus,
  VMResource,
  ResourceLimits,
  ResourceUsage,
  SystemResources,
  VMPoolState,
  CreateVMOptions,
  CloneVMOptions,
  VMOperationResult,
  VMListOptions,
  VMService,
  PortMapping,
  VMCluster
} from '@/types/multi-vm';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const log = createServiceLogger({
  service: 'vibecode-vm',
  component: 'pool-manager'
});

/**
 * Default resource limits
 */
const DEFAULT_LIMITS: ResourceLimits = {
  maxVMs: 4,
  maxTotalCPU: 8,
  maxTotalMemoryMB: 8192, // 8GB
  maxTotalDiskMB: 102400, // 100GB
  maxSystemUsagePercent: 80
};

/**
 * Default VM resources
 */
const DEFAULT_VM_RESOURCES: VMResource = {
  cpuCores: 2,
  memoryMB: 1024, // 1GB
  diskMB: 10240  // 10GB
};

/**
 * State persistence path
 */
const STATE_FILE = '.vibecode/vm-pool-state.json';

/**
 * VM Pool Manager - manages multiple VM instances
 */
export class VMPoolManager {
  private instances: Map<string, VMInstance> = new Map();
  private clusters: Map<string, VMCluster> = new Map();
  private provider: VMProvider | null = null;
  private portManager: PortManager;
  private profilesService: VMProfilesService;
  private limits: ResourceLimits;
  private initialized = false;
  private statePath: string;

  constructor(options?: {
    limits?: Partial<ResourceLimits>;
    statePath?: string;
    portManager?: PortManager;
    profilesService?: VMProfilesService;
  }) {
    this.limits = { ...DEFAULT_LIMITS, ...options?.limits };
    this.statePath = options?.statePath || path.join(os.homedir(), STATE_FILE);
    this.portManager = options?.portManager || getPortManager();
    this.profilesService = options?.profilesService || getProfilesService();
  }

  /**
   * Initialize the pool manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    log.info('Initializing VM pool manager');

    try {
      // Detect and get the best provider
      this.provider = await ProviderFactory.detectProvider();
      log.info('Using VM provider', { provider: this.provider.name });

      // Load saved state
      await this.loadState();

      // Sync with actual VM state
      await this.syncVMState();

      this.initialized = true;
      log.info('VM pool manager initialized', {
        instanceCount: this.instances.size,
        clusterCount: this.clusters.size
      });
    } catch (error) {
      log.error('Failed to initialize VM pool manager', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create a new VM instance
   */
  async createVM(options: CreateVMOptions): Promise<VMOperationResult> {
    await this.ensureInitialized();

    const id = randomUUID();
    const name = options.name || `vm-${id.slice(0, 8)}`;

    log.info('Creating VM', { id, name, profileId: options.profileId });

    // Check resource limits
    const canCreate = await this.checkResourceLimits(options.resources);
    if (!canCreate.allowed) {
      return {
        success: false,
        message: 'Resource limits exceeded',
        error: {
          code: 'RESOURCE_LIMIT_EXCEEDED',
          message: canCreate.reason || 'Cannot create VM due to resource limits',
          details: canCreate
        }
      };
    }

    // Get profile configuration
    let baseConfig: Partial<VMConfig> = {};
    let baseResources: VMResource = { ...DEFAULT_VM_RESOURCES };
    let defaultPorts: PortMapping[] = [];

    if (options.profileId) {
      const profile = this.profilesService.getProfile(options.profileId);
      if (profile) {
        baseConfig = { ...profile.config };
        baseResources = { ...profile.resources };
        defaultPorts = [...profile.defaultPorts];
      } else {
        log.warn('Profile not found, using defaults', { profileId: options.profileId });
      }
    }

    // Merge configurations
    const resources: VMResource = {
      ...baseResources,
      ...options.resources
    };

    const config: VMConfig = {
      name,
      cpus: resources.cpuCores,
      memory: `${resources.memoryMB}MB`,
      disk: `${resources.diskMB}MB`,
      image: 'alpine-3.22',
      ...baseConfig,
      ...options.config
    };

    // Allocate ports
    const portsToAllocate = options.ports || defaultPorts;
    const portResult = await this.portManager.allocatePorts(
      id,
      portsToAllocate.map(p => ({
        guestPort: p.guest,
        preferredHostPort: p.host,
        service: p.service,
        protocol: p.protocol
      }))
    );

    if (!portResult.success && portResult.errors.length > 0) {
      log.warn('Some ports could not be allocated', { errors: portResult.errors });
    }

    // Create VM instance record
    const instance: VMInstance = {
      id,
      name,
      status: {
        status: 'creating',
        health: 0
      },
      config,
      ports: portResult.mappings,
      project: options.project,
      profileId: options.profileId,
      resources,
      services: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata,
      tags: options.tags
    };

    this.instances.set(id, instance);

    try {
      // Create the actual VM
      const vm = await this.provider!.create(config);

      instance.ipAddress = vm.ip;
      instance.status = {
        status: vm.status,
        health: vm.status === 'running' ? 100 : 0,
        lastHealthCheck: new Date()
      };

      // Configure SSH if available
      if (vm.ip) {
        const sshPort = instance.ports.find(p => p.guest === 22);
        instance.ssh = {
          host: '127.0.0.1',
          port: sshPort?.host || 22,
          user: 'root'
        };
      }

      // Start if auto-start is enabled
      if (options.autoStart !== false && instance.status.status !== 'running') {
        await this.startVM(id);
      }

      await this.saveState();

      log.info('VM created successfully', { id, name, status: instance.status.status });

      return {
        success: true,
        message: `VM ${name} created successfully`,
        vm: instance
      };
    } catch (error) {
      // Cleanup on failure
      this.portManager.releaseAllPorts(id);
      this.instances.delete(id);

      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Failed to create VM', { id, name, error: errorMessage });

      return {
        success: false,
        message: `Failed to create VM: ${errorMessage}`,
        error: {
          code: 'VM_CREATION_FAILED',
          message: errorMessage
        }
      };
    }
  }

  /**
   * Start a VM
   */
  async startVM(id: string): Promise<VMOperationResult> {
    await this.ensureInitialized();

    const instance = this.instances.get(id);
    if (!instance) {
      return {
        success: false,
        message: 'VM not found',
        error: { code: 'VM_NOT_FOUND', message: `VM with id ${id} not found` }
      };
    }

    log.info('Starting VM', { id, name: instance.name });

    try {
      await this.provider!.start(id);

      instance.status = {
        ...instance.status,
        status: 'running',
        health: 100,
        lastHealthCheck: new Date()
      };
      instance.updatedAt = new Date();

      await this.saveState();

      return {
        success: true,
        message: `VM ${instance.name} started`,
        vm: instance
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      instance.status = {
        ...instance.status,
        status: 'error',
        errorMessage
      };

      return {
        success: false,
        message: `Failed to start VM: ${errorMessage}`,
        error: { code: 'VM_START_FAILED', message: errorMessage }
      };
    }
  }

  /**
   * Stop a VM
   */
  async stopVM(id: string): Promise<VMOperationResult> {
    await this.ensureInitialized();

    const instance = this.instances.get(id);
    if (!instance) {
      return {
        success: false,
        message: 'VM not found',
        error: { code: 'VM_NOT_FOUND', message: `VM with id ${id} not found` }
      };
    }

    log.info('Stopping VM', { id, name: instance.name });

    try {
      instance.status = { ...instance.status, status: 'stopping' };
      await this.provider!.stop(id);

      instance.status = {
        ...instance.status,
        status: 'stopped',
        health: 0,
        uptimeSeconds: undefined
      };
      instance.updatedAt = new Date();

      await this.saveState();

      return {
        success: true,
        message: `VM ${instance.name} stopped`,
        vm: instance
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      instance.status = {
        ...instance.status,
        status: 'error',
        errorMessage
      };

      return {
        success: false,
        message: `Failed to stop VM: ${errorMessage}`,
        error: { code: 'VM_STOP_FAILED', message: errorMessage }
      };
    }
  }

  /**
   * Delete a VM
   */
  async deleteVM(id: string): Promise<VMOperationResult> {
    await this.ensureInitialized();

    const instance = this.instances.get(id);
    if (!instance) {
      return {
        success: false,
        message: 'VM not found',
        error: { code: 'VM_NOT_FOUND', message: `VM with id ${id} not found` }
      };
    }

    log.info('Deleting VM', { id, name: instance.name });

    try {
      // Stop if running
      if (instance.status.status === 'running') {
        await this.provider!.stop(id);
      }

      // Destroy VM
      await this.provider!.destroy(id);

      // Release ports
      this.portManager.releaseAllPorts(id);

      // Remove from clusters
      for (const cluster of this.clusters.values()) {
        const idx = cluster.vmIds.indexOf(id);
        if (idx !== -1) {
          cluster.vmIds.splice(idx, 1);
        }
      }

      // Remove instance
      this.instances.delete(id);

      await this.saveState();

      return {
        success: true,
        message: `VM ${instance.name} deleted`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Failed to delete VM', { id, error: errorMessage });

      return {
        success: false,
        message: `Failed to delete VM: ${errorMessage}`,
        error: { code: 'VM_DELETE_FAILED', message: errorMessage }
      };
    }
  }

  /**
   * Clone an existing VM
   */
  async cloneVM(sourceId: string, options?: CloneVMOptions): Promise<VMOperationResult> {
    await this.ensureInitialized();

    const source = this.instances.get(sourceId);
    if (!source) {
      return {
        success: false,
        message: 'Source VM not found',
        error: { code: 'VM_NOT_FOUND', message: `VM with id ${sourceId} not found` }
      };
    }

    log.info('Cloning VM', { sourceId, sourceName: source.name });

    // Create new VM with source config
    const cloneOptions: CreateVMOptions = {
      name: options?.name || `${source.name}-clone`,
      profileId: source.profileId,
      config: { ...source.config },
      resources: { ...source.resources },
      project: source.project,
      tags: options?.tags || source.tags,
      autoStart: options?.autoStart ?? false
    };

    // Don't copy the original ports - let new ones be allocated
    return this.createVM(cloneOptions);
  }

  /**
   * Execute command in a VM
   */
  async execInVM(id: string, command: string): Promise<ExecResult> {
    await this.ensureInitialized();

    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error(`VM with id ${id} not found`);
    }

    if (instance.status.status !== 'running') {
      throw new Error(`VM ${instance.name} is not running`);
    }

    return this.provider!.exec(id, command);
  }

  /**
   * Get a VM instance
   */
  getVM(id: string): VMInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * List all VMs with optional filtering
   */
  listVMs(options?: VMListOptions): VMInstance[] {
    let vms = Array.from(this.instances.values());

    // Apply filters
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      vms = vms.filter(vm => statuses.includes(vm.status.status));
    }

    if (options?.projectId) {
      vms = vms.filter(vm => vm.project?.id === options.projectId);
    }

    if (options?.tags && options.tags.length > 0) {
      vms = vms.filter(vm =>
        options.tags!.some(tag => vm.tags?.includes(tag))
      );
    }

    if (options?.clusterId) {
      const cluster = this.clusters.get(options.clusterId);
      if (cluster) {
        vms = vms.filter(vm => cluster.vmIds.includes(vm.id));
      } else {
        vms = [];
      }
    }

    // Apply sorting
    if (options?.sortBy) {
      vms.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (options.sortBy) {
          case 'name':
            aVal = a.name;
            bVal = b.name;
            break;
          case 'createdAt':
            aVal = a.createdAt.getTime();
            bVal = b.createdAt.getTime();
            break;
          case 'status':
            aVal = a.status.status;
            bVal = b.status.status;
            break;
          case 'resources.memoryMB':
            aVal = a.resources.memoryMB;
            bVal = b.resources.memoryMB;
            break;
          default:
            return 0;
        }

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    if (options?.offset) {
      vms = vms.slice(options.offset);
    }
    if (options?.limit) {
      vms = vms.slice(0, options.limit);
    }

    return vms;
  }

  /**
   * Get resource usage
   */
  getResourceUsage(): ResourceUsage {
    let cpuCoresUsed = 0;
    let memoryUsedMB = 0;
    let diskUsedMB = 0;
    let activeVMs = 0;

    for (const instance of this.instances.values()) {
      cpuCoresUsed += instance.resources.cpuCores;
      memoryUsedMB += instance.resources.memoryMB;
      diskUsedMB += instance.resources.diskMB;

      if (instance.status.status === 'running') {
        activeVMs++;
      }
    }

    return {
      cpuCoresUsed,
      memoryUsedMB,
      diskUsedMB,
      activeVMs,
      usagePercent: {
        cpu: (cpuCoresUsed / this.limits.maxTotalCPU) * 100,
        memory: (memoryUsedMB / this.limits.maxTotalMemoryMB) * 100,
        disk: (diskUsedMB / this.limits.maxTotalDiskMB) * 100
      }
    };
  }

  /**
   * Get system resources
   */
  async getSystemResources(): Promise<SystemResources> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // Try to get disk space (platform-specific) using execFile for safety
    let totalDiskMB = 0;
    let availableDiskMB = 0;

    try {
      const { stdout } = await execFileAsync('df', ['-m', '/']);
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].trim().split(/\s+/);
        if (parts.length >= 4) {
          totalDiskMB = parseInt(parts[1], 10);
          availableDiskMB = parseInt(parts[3], 10);
        }
      }
    } catch {
      // Fallback values
      totalDiskMB = 256 * 1024; // 256GB
      availableDiskMB = 128 * 1024; // 128GB
    }

    return {
      totalCPU: cpus.length,
      totalMemoryMB: Math.floor(totalMemory / (1024 * 1024)),
      availableMemoryMB: Math.floor(freeMemory / (1024 * 1024)),
      totalDiskMB,
      availableDiskMB
    };
  }

  /**
   * Get resource limits
   */
  getLimits(): ResourceLimits {
    return { ...this.limits };
  }

  /**
   * Update resource limits
   */
  setLimits(limits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...limits };
    log.info('Updated resource limits', { limits: this.limits });
  }

  /**
   * Get pool state
   */
  async getPoolState(): Promise<VMPoolState> {
    const systemResources = await this.getSystemResources();

    return {
      instances: Array.from(this.instances.values()),
      clusters: Array.from(this.clusters.values()),
      resourceUsage: this.getResourceUsage(),
      limits: this.limits,
      systemResources,
      allocatedPorts: this.portManager.getAllAllocatedPorts()
    };
  }

  /**
   * Check if resource limits allow creation
   */
  private async checkResourceLimits(
    resources?: Partial<VMResource>
  ): Promise<{ allowed: boolean; reason?: string }> {
    const usage = this.getResourceUsage();
    const vmResources = { ...DEFAULT_VM_RESOURCES, ...resources };

    // Check VM count
    if (this.instances.size >= this.limits.maxVMs) {
      return { allowed: false, reason: `Maximum VM count (${this.limits.maxVMs}) reached` };
    }

    // Check CPU
    if (usage.cpuCoresUsed + vmResources.cpuCores > this.limits.maxTotalCPU) {
      return { allowed: false, reason: 'CPU limit would be exceeded' };
    }

    // Check memory
    if (usage.memoryUsedMB + vmResources.memoryMB > this.limits.maxTotalMemoryMB) {
      return { allowed: false, reason: 'Memory limit would be exceeded' };
    }

    // Check disk
    if (usage.diskUsedMB + vmResources.diskMB > this.limits.maxTotalDiskMB) {
      return { allowed: false, reason: 'Disk limit would be exceeded' };
    }

    // Check system resources
    const sysResources = await this.getSystemResources();
    const maxAllowedMemory = sysResources.totalMemoryMB * (this.limits.maxSystemUsagePercent / 100);

    if (usage.memoryUsedMB + vmResources.memoryMB > maxAllowedMemory) {
      return {
        allowed: false,
        reason: `Would exceed ${this.limits.maxSystemUsagePercent}% system memory usage`
      };
    }

    return { allowed: true };
  }

  /**
   * Sync VM state with actual provider state
   */
  private async syncVMState(): Promise<void> {
    if (!this.provider) return;

    try {
      const actualVMs = await this.provider.list();

      for (const instance of this.instances.values()) {
        const actualVM = actualVMs.find(vm => vm.id === instance.id || vm.name === instance.name);

        if (actualVM) {
          instance.status = {
            ...instance.status,
            status: actualVM.status,
            lastHealthCheck: new Date()
          };
          instance.ipAddress = actualVM.ip;
        } else {
          // VM no longer exists in provider
          log.warn('VM not found in provider, marking as unknown', { id: instance.id });
          instance.status = { ...instance.status, status: 'unknown' };
        }
      }
    } catch (error) {
      log.error('Failed to sync VM state', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const state = JSON.parse(data);

      // Restore instances
      if (state.instances) {
        for (const inst of state.instances) {
          inst.createdAt = new Date(inst.createdAt);
          inst.updatedAt = new Date(inst.updatedAt);
          if (inst.status.lastHealthCheck) {
            inst.status.lastHealthCheck = new Date(inst.status.lastHealthCheck);
          }
          this.instances.set(inst.id, inst);
        }
      }

      // Restore clusters
      if (state.clusters) {
        for (const cluster of state.clusters) {
          cluster.createdAt = new Date(cluster.createdAt);
          cluster.updatedAt = new Date(cluster.updatedAt);
          this.clusters.set(cluster.id, cluster);
        }
      }

      // Restore port allocations
      if (state.portAllocations) {
        this.portManager.importAllocations(state.portAllocations);
      }

      log.info('Loaded VM pool state', {
        instances: this.instances.size,
        clusters: this.clusters.size
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn('Failed to load VM pool state', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    try {
      const dir = path.dirname(this.statePath);
      await fs.mkdir(dir, { recursive: true });

      const state = {
        instances: Array.from(this.instances.values()),
        clusters: Array.from(this.clusters.values()),
        portAllocations: this.portManager.exportAllocations(),
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
      log.debug('Saved VM pool state');
    } catch (error) {
      log.error('Failed to save VM pool state', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Ensure manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Shutdown the pool manager
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down VM pool manager');
    await this.saveState();
    this.initialized = false;
  }
}

// Singleton instance
let poolManagerInstance: VMPoolManager | null = null;

/**
 * Get the singleton pool manager instance
 */
export function getPoolManager(
  options?: ConstructorParameters<typeof VMPoolManager>[0]
): VMPoolManager {
  if (!poolManagerInstance) {
    poolManagerInstance = new VMPoolManager(options);
  }
  return poolManagerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetPoolManager(): void {
  poolManagerInstance = null;
}
