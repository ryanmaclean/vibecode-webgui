/**
 * VM Management Tool for MCP Server
 *
 * Provides VM creation, listing, and control via Apple Virtualization.framework.
 * Enables management of Linux, Windows, and macOS virtual machines through the
 * Model Context Protocol (MCP) interface.
 *
 * @module vm-management
 *
 * @example
 * ```typescript
 * import { vmManager, createVM, startVM, listVMs } from '@/mcp/tools/vm-management';
 *
 * // Create a new Linux VM
 * const result = await createVM({
 *   name: 'dev-vm',
 *   type: 'linux',
 *   cpus: 4,
 *   memory: 8,
 *   disk: 50
 * });
 *
 * // Start the VM
 * await startVM({ name: 'dev-vm' });
 *
 * // List all VMs
 * const vms = await listVMs();
 * ```
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Configuration options for creating a new virtual machine.
 *
 * @interface VMConfig
 * @property name - Unique name for the VM (alphanumeric, hyphens, underscores only)
 * @property type - Type of VM: 'linux', 'linux-gui', 'windows', or 'macos'
 * @property cpus - Number of CPU cores to allocate (optional)
 * @property memory - Amount of RAM in GB (optional)
 * @property disk - Disk size in GB (optional)
 * @property isoPath - Path to installation ISO image (optional)
 */
export interface VMConfig {
  name: string;
  type: 'linux' | 'linux-gui' | 'windows' | 'macos';
  cpus?: number;
  memory?: number; // GB
  disk?: number; // GB
  isoPath?: string;
}

/**
 * Information about a virtual machine's current state.
 *
 * @interface VMInfo
 * @property name - Unique name of the VM
 * @property type - Type of VM: 'linux', 'linux-gui', 'windows', or 'macos'
 * @property status - Current status: 'running', 'stopped', or 'error'
 * @property pid - Process ID if the VM is running (optional)
 * @property uptime - Uptime in seconds if the VM is running (optional)
 * @property createdAt - ISO timestamp of when the VM was created (optional)
 */
export interface VMInfo {
  name: string;
  type: VMConfig['type'];
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  uptime?: number;
  createdAt?: string;
}

/**
 * Persistent metadata stored on disk for each VM.
 *
 * @interface VMMetadata
 * @property name - Unique name of the VM
 * @property type - Type of VM
 * @property createdAt - ISO timestamp of when the VM was created
 * @property cpus - Number of CPU cores allocated (optional)
 * @property memory - Amount of RAM in GB (optional)
 * @property disk - Disk size in GB (optional)
 */
interface VMMetadata {
  name: string;
  type: VMConfig['type'];
  createdAt: string;
  cpus?: number;
  memory?: number;
  disk?: number;
}

/**
 * In-memory state for a currently running VM.
 *
 * @interface RunningVMState
 * @property process - The child process running the VM
 * @property type - Type of VM
 * @property startedAt - Timestamp when the VM was started (Date.now())
 */
interface RunningVMState {
  process: ChildProcess;
  type: VMConfig['type'];
  startedAt: number;
}

/** Regular expression pattern for validating VM names - alphanumeric, hyphens, underscores only */
const VM_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
/** Maximum allowed length for VM names */
const MAX_VM_NAME_LENGTH = 64;

/**
 * Manages virtual machines using Apple Virtualization.framework.
 * Provides methods for creating, starting, stopping, and listing VMs.
 *
 * @class VMManager
 *
 * @example
 * ```typescript
 * const manager = new VMManager();
 *
 * await manager.createVM({ name: 'test-vm', type: 'linux' });
 * await manager.startVM('test-vm');
 *
 * const vms = await manager.listVMs();
 * console.log(vms);
 *
 * await manager.stopVM('test-vm');
 * await manager.deleteVM('test-vm');
 * ```
 */
class VMManager {
  /** Path to the virtualization binary */
  private vzBinary: string;
  /** Base directory for VM storage */
  private vmBaseDir: string;
  /** Map of running VM names to their state */
  private runningVMs: Map<string, RunningVMState> = new Map();

  /**
   * Creates a new VMManager instance.
   * Initializes paths and ensures the VM base directory exists.
   */
  constructor() {
    this.vzBinary = join(process.cwd(), 'vz-swift/.build/debug/vibecode-vm');
    this.vmBaseDir = join(homedir(), '.vfkit/vms');

    // Ensure base directory exists
    if (!existsSync(this.vmBaseDir)) {
      mkdirSync(this.vmBaseDir, { recursive: true });
    }
  }

  /**
   * Validates a VM name to prevent path traversal and injection attacks.
   * Names must be alphanumeric with hyphens and underscores only.
   *
   * @param name - The VM name to validate
   * @returns Object with valid boolean and optional error message
   *
   * @example
   * ```typescript
   * const result = this.validateVMName('my-vm-01');
   * if (!result.valid) {
   *   console.error(result.error);
   * }
   * ```
   */
  private validateVMName(name: string): { valid: boolean; error?: string } {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'VM name is required' };
    }

    if (name.length > MAX_VM_NAME_LENGTH) {
      return { valid: false, error: `VM name must be ${MAX_VM_NAME_LENGTH} characters or less` };
    }

    if (!VM_NAME_PATTERN.test(name)) {
      return { valid: false, error: 'VM name can only contain alphanumeric characters, hyphens, and underscores' };
    }

    // Additional checks for path traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      return { valid: false, error: 'VM name contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Gets the metadata file path for a VM.
   *
   * @param name - The VM name
   * @returns The full path to the VM's metadata JSON file
   * @throws Error if the VM name is invalid
   */
  private getMetadataPath(name: string): string {
    const validation = this.validateVMName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    return join(this.vmBaseDir, name, 'vm-metadata.json');
  }

  /**
   * Saves VM metadata to disk for persistence across restarts.
   *
   * @param metadata - The VM metadata to save
   */
  private saveMetadata(metadata: VMMetadata): void {
    const vmDir = join(this.vmBaseDir, metadata.name);
    if (!existsSync(vmDir)) {
      mkdirSync(vmDir, { recursive: true });
    }
    const metadataPath = this.getMetadataPath(metadata.name);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Loads VM metadata from disk.
   *
   * @param name - The VM name
   * @returns The VM metadata, or null if not found or invalid
   * @throws Error if the VM name is invalid
   */
  private loadMetadata(name: string): VMMetadata | null {
    const metadataPath = this.getMetadataPath(name);
    if (!existsSync(metadataPath)) {
      return null;
    }
    try {
      const content = readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content) as VMMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Gets all VM directories from the filesystem.
   * Returns both running and stopped VM directories.
   *
   * @returns Array of VM directory names
   */
  private getVMDirectories(): string[] {
    if (!existsSync(this.vmBaseDir)) {
      return [];
    }
    try {
      return readdirSync(this.vmBaseDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    } catch {
      return [];
    }
  }

  /**
   * Creates a new virtual machine.
   * Sets up the VM directory and saves metadata, but does not start the VM.
   *
   * @param config - The VM configuration
   * @param config.name - Unique name for the VM (must pass validation)
   * @param config.type - Type of VM to create
   * @param config.cpus - Number of CPU cores (optional)
   * @param config.memory - RAM in GB (optional)
   * @param config.disk - Disk size in GB (optional)
   * @param config.isoPath - Path to installation ISO (optional)
   * @returns Result object with success status and message
   *
   * @example
   * ```typescript
   * const result = await vmManager.createVM({
   *   name: 'ubuntu-dev',
   *   type: 'linux',
   *   cpus: 4,
   *   memory: 8,
   *   disk: 100
   * });
   *
   * if (result.success) {
   *   console.log(result.message);
   * }
   * ```
   */
  async createVM(config: VMConfig): Promise<{ success: boolean; message: string }> {
    try {
      // Validate VM name to prevent path traversal attacks
      const nameValidation = this.validateVMName(config.name);
      if (!nameValidation.valid) {
        return {
          success: false,
          message: nameValidation.error || 'Invalid VM name'
        };
      }

      const vmDir = join(this.vmBaseDir, config.name);

      // Ensure VM directory exists
      if (!existsSync(vmDir)) {
        mkdirSync(vmDir, { recursive: true });
      }

      // Check if VZ binary exists and is executable
      if (!existsSync(this.vzBinary)) {
        return {
          success: false,
          message: `VZ binary not found: ${this.vzBinary}. Run: cd vz-swift && swift build`
        };
      }

      // Save VM metadata to disk for persistence
      const metadata: VMMetadata = {
        name: config.name,
        type: config.type,
        createdAt: new Date().toISOString(),
        cpus: config.cpus,
        memory: config.memory,
        disk: config.disk,
      };
      this.saveMetadata(metadata);

      return {
        success: true,
        message: `VM ${config.name} created. Directory: ${vmDir}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create VM: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Starts a virtual machine.
   * Spawns the VM process using the virtualization binary.
   *
   * @param name - The name of the VM to start
   * @param type - Optional VM type override (defaults to saved metadata type or 'linux')
   * @returns Result object with success status, message, and optional PID
   *
   * @example
   * ```typescript
   * const result = await vmManager.startVM('ubuntu-dev');
   *
   * if (result.success) {
   *   console.log(`VM started with PID: ${result.pid}`);
   * }
   * ```
   */
  async startVM(name: string, type?: string): Promise<{ success: boolean; message: string; pid?: number }> {
    try {
      // Validate VM name to prevent path traversal attacks
      const nameValidation = this.validateVMName(name);
      if (!nameValidation.valid) {
        return {
          success: false,
          message: nameValidation.error || 'Invalid VM name'
        };
      }

      if (this.runningVMs.has(name)) {
        return {
          success: false,
          message: `VM ${name} is already running`
        };
      }

      // Load metadata to get VM type if not provided
      const metadata = this.loadMetadata(name);
      const vmType = (type as VMConfig['type']) || metadata?.type || 'linux';

      const vmProcess = spawn(this.vzBinary, [vmType, name], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Track both the process and its type
      this.runningVMs.set(name, {
        process: vmProcess,
        type: vmType,
        startedAt: Date.now(),
      });

      vmProcess.unref();

      // Handle process events
      vmProcess.on('error', (error) => {
        console.error(`VM ${name} error:`, error);
        this.runningVMs.delete(name);
      });

      vmProcess.on('exit', (code) => {
        console.log(`VM ${name} exited with code ${code}`);
        this.runningVMs.delete(name);
      });

      return {
        success: true,
        message: `VM ${name} started successfully`,
        pid: vmProcess.pid
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start VM: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Stops a running virtual machine.
   * Sends SIGTERM to the VM process for graceful shutdown.
   *
   * @param name - The name of the VM to stop
   * @returns Result object with success status and message
   *
   * @example
   * ```typescript
   * const result = await vmManager.stopVM('ubuntu-dev');
   *
   * if (result.success) {
   *   console.log('VM stopped successfully');
   * }
   * ```
   */
  async stopVM(name: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate VM name to prevent path traversal attacks
      const nameValidation = this.validateVMName(name);
      if (!nameValidation.valid) {
        return {
          success: false,
          message: nameValidation.error || 'Invalid VM name'
        };
      }

      const vmState = this.runningVMs.get(name);

      if (!vmState) {
        return {
          success: false,
          message: `VM ${name} is not running`
        };
      }

      vmState.process.kill('SIGTERM');
      this.runningVMs.delete(name);

      return {
        success: true,
        message: `VM ${name} stopped successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop VM: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Lists all virtual machines, both running and stopped.
   * Combines in-memory running VM state with on-disk metadata.
   *
   * @returns Array of VMInfo objects for all VMs
   *
   * @example
   * ```typescript
   * const vms = await vmManager.listVMs();
   *
   * vms.forEach(vm => {
   *   console.log(`${vm.name}: ${vm.status} (${vm.type})`);
   *   if (vm.uptime) {
   *     console.log(`  Uptime: ${vm.uptime}s`);
   *   }
   * });
   * ```
   */
  async listVMs(): Promise<VMInfo[]> {
    const vms: VMInfo[] = [];
    const runningNames = new Set(this.runningVMs.keys());

    // List running VMs with proper type tracking
    for (const [name, vmState] of Array.from(this.runningVMs.entries())) {
      const metadata = this.loadMetadata(name);
      const uptime = Math.floor((Date.now() - vmState.startedAt) / 1000);
      vms.push({
        name,
        type: vmState.type,
        status: 'running',
        pid: vmState.process.pid,
        uptime,
        createdAt: metadata?.createdAt,
      });
    }

    // List stopped VMs from filesystem
    const vmDirectories = this.getVMDirectories();
    for (const vmName of vmDirectories) {
      // Skip if already in running VMs
      if (runningNames.has(vmName)) {
        continue;
      }

      const metadata = this.loadMetadata(vmName);
      if (metadata) {
        vms.push({
          name: vmName,
          type: metadata.type,
          status: 'stopped',
          createdAt: metadata.createdAt,
        });
      } else {
        // VM directory exists but no metadata - legacy VM
        vms.push({
          name: vmName,
          type: 'linux', // Default for legacy VMs without metadata
          status: 'stopped',
        });
      }
    }

    return vms;
  }

  /**
   * Gets the current status of a specific virtual machine.
   * Returns error status if the VM name is invalid.
   *
   * @param name - The name of the VM
   * @returns VMInfo object with the current status
   *
   * @example
   * ```typescript
   * const status = await vmManager.getVMStatus('ubuntu-dev');
   *
   * if (status.status === 'running') {
   *   console.log(`Running for ${status.uptime} seconds`);
   * }
   * ```
   */
  async getVMStatus(name: string): Promise<VMInfo> {
    // Validate VM name to prevent path traversal attacks
    const nameValidation = this.validateVMName(name);
    if (!nameValidation.valid) {
      return {
        name,
        type: 'linux',
        status: 'error',
      };
    }

    const vmState = this.runningVMs.get(name);
    const metadata = this.loadMetadata(name);

    if (vmState && vmState.process.pid) {
      const uptime = Math.floor((Date.now() - vmState.startedAt) / 1000);
      return {
        name,
        type: vmState.type,
        status: 'running',
        pid: vmState.process.pid,
        uptime,
        createdAt: metadata?.createdAt,
      };
    }

    // VM is not running - get type from metadata
    return {
      name,
      type: metadata?.type || 'linux',
      status: 'stopped',
      createdAt: metadata?.createdAt,
    };
  }

  /**
   * Deletes a virtual machine and its associated metadata.
   * Automatically stops the VM if it is running.
   *
   * Note: This only removes the metadata file. The VM disk image and other
   * files in the VM directory may need to be cleaned up separately.
   *
   * @param name - The name of the VM to delete
   * @returns Result object with success status and message
   *
   * @example
   * ```typescript
   * const result = await vmManager.deleteVM('ubuntu-dev');
   *
   * if (result.success) {
   *   console.log('VM deleted');
   * }
   * ```
   */
  async deleteVM(name: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate VM name to prevent path traversal attacks
      const nameValidation = this.validateVMName(name);
      if (!nameValidation.valid) {
        return {
          success: false,
          message: nameValidation.error || 'Invalid VM name'
        };
      }

      // Stop the VM if running
      if (this.runningVMs.has(name)) {
        await this.stopVM(name);
      }

      // Remove metadata file
      const metadataPath = this.getMetadataPath(name);
      if (existsSync(metadataPath)) {
        unlinkSync(metadataPath);
      }

      return {
        success: true,
        message: `VM ${name} deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete VM: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

/** Singleton VMManager instance for use throughout the application */
export const vmManager = new VMManager();

// ============================================================================
// MCP Tool Handlers
// ============================================================================

/**
 * MCP Tool Handler: Creates a new virtual machine.
 *
 * @param args - VM configuration options
 * @returns Result object with success status and message
 *
 * @example
 * ```typescript
 * await createVM({ name: 'dev-vm', type: 'linux', cpus: 4, memory: 8 });
 * ```
 */
export const createVM = async (args: VMConfig) => vmManager.createVM(args);

/**
 * MCP Tool Handler: Starts a virtual machine.
 *
 * @param args - Object containing VM name and optional type override
 * @param args.name - The name of the VM to start
 * @param args.type - Optional VM type override
 * @returns Result object with success status, message, and optional PID
 *
 * @example
 * ```typescript
 * await startVM({ name: 'dev-vm' });
 * ```
 */
export const startVM = async (args: { name: string; type?: string }) => vmManager.startVM(args.name, args.type);

/**
 * MCP Tool Handler: Stops a running virtual machine.
 *
 * @param args - Object containing VM name
 * @param args.name - The name of the VM to stop
 * @returns Result object with success status and message
 *
 * @example
 * ```typescript
 * await stopVM({ name: 'dev-vm' });
 * ```
 */
export const stopVM = async (args: { name: string }) => vmManager.stopVM(args.name);

/**
 * MCP Tool Handler: Lists all virtual machines.
 *
 * @returns Array of VMInfo objects for all VMs
 *
 * @example
 * ```typescript
 * const vms = await listVMs();
 * vms.forEach(vm => console.log(vm.name, vm.status));
 * ```
 */
export const listVMs = async () => vmManager.listVMs();

/**
 * MCP Tool Handler: Gets the status of a specific virtual machine.
 *
 * @param args - Object containing VM name
 * @param args.name - The name of the VM to query
 * @returns VMInfo object with the current status
 *
 * @example
 * ```typescript
 * const status = await getVMStatus({ name: 'dev-vm' });
 * console.log(status.status, status.uptime);
 * ```
 */
export const getVMStatus = async (args: { name: string }) => vmManager.getVMStatus(args.name);

/**
 * MCP Tool Handler: Deletes a virtual machine.
 *
 * @param args - Object containing VM name
 * @param args.name - The name of the VM to delete
 * @returns Result object with success status and message
 *
 * @example
 * ```typescript
 * await deleteVM({ name: 'dev-vm' });
 * ```
 */
export const deleteVM = async (args: { name: string }) => vmManager.deleteVM(args.name);

