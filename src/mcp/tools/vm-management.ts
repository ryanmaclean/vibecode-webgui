/**
 * VM Management Tool for MCP Server
 * Provides VM creation, listing, and control via Apple Virtualization.framework
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface VMConfig {
  name: string;
  type: 'linux' | 'linux-gui' | 'windows' | 'macos';
  cpus?: number;
  memory?: number; // GB
  disk?: number; // GB
  isoPath?: string;
}

export interface VMInfo {
  name: string;
  type: VMConfig['type'];
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  uptime?: number;
  createdAt?: string;
}

interface VMMetadata {
  name: string;
  type: VMConfig['type'];
  createdAt: string;
  cpus?: number;
  memory?: number;
  disk?: number;
}

interface RunningVMState {
  process: ChildProcess;
  type: VMConfig['type'];
  startedAt: number;
}

class VMManager {
  private vzBinary: string;
  private vmBaseDir: string;
  private runningVMs: Map<string, RunningVMState> = new Map();

  constructor() {
    this.vzBinary = join(process.cwd(), 'vz-swift/.build/debug/vibecode-vm');
    this.vmBaseDir = join(homedir(), '.vfkit/vms');

    // Ensure base directory exists
    if (!existsSync(this.vmBaseDir)) {
      mkdirSync(this.vmBaseDir, { recursive: true });
    }
  }

  /**
   * Get the metadata file path for a VM
   */
  private getMetadataPath(name: string): string {
    return join(this.vmBaseDir, name, 'vm-metadata.json');
  }

  /**
   * Save VM metadata to disk
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
   * Load VM metadata from disk
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
   * Get all VM directories (both running and stopped)
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
   * Create a new VM
   */
  async createVM(config: VMConfig): Promise<{ success: boolean; message: string }> {
    try {
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
   * Start a VM
   */
  async startVM(name: string, type?: string): Promise<{ success: boolean; message: string; pid?: number }> {
    try {
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
   * Stop a VM
   */
  async stopVM(name: string): Promise<{ success: boolean; message: string }> {
    try {
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
   * List all VMs
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
   * Get VM status
   */
  async getVMStatus(name: string): Promise<VMInfo> {
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
   * Delete a VM and its associated data
   */
  async deleteVM(name: string): Promise<{ success: boolean; message: string }> {
    try {
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

// Singleton instance
export const vmManager = new VMManager();

// MCP Tool Handlers
export const createVM = async (args: VMConfig) => vmManager.createVM(args);
export const startVM = async (args: { name: string; type?: string }) => vmManager.startVM(args.name, args.type);
export const stopVM = async (args: { name: string }) => vmManager.stopVM(args.name);
export const listVMs = async () => vmManager.listVMs();
export const getVMStatus = async (args: { name: string }) => vmManager.getVMStatus(args.name);
export const deleteVM = async (args: { name: string }) => vmManager.deleteVM(args.name);

