/**
 * VM Management Tool for MCP Server
 * Provides VM creation, listing, and control via Apple Virtualization.framework
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
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
  type: string;
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  uptime?: number;
}

class VMManager {
  private vzBinary: string;
  private vmBaseDir: string;
  private runningVMs: Map<string, ChildProcess> = new Map();

  constructor() {
    this.vzBinary = join(process.cwd(), 'vz-swift/.build/debug/vibecode-vm');
    this.vmBaseDir = join(homedir(), '.vfkit/vms');
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
  async startVM(name: string, type: string = 'linux'): Promise<{ success: boolean; message: string; pid?: number }> {
    try {
      if (this.runningVMs.has(name)) {
        return {
          success: false,
          message: `VM ${name} is already running`
        };
      }

      const vmProcess = spawn(this.vzBinary, [type, name], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.runningVMs.set(name, vmProcess);

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
      const vmProcess = this.runningVMs.get(name);
      
      if (!vmProcess) {
        return {
          success: false,
          message: `VM ${name} is not running`
        };
      }

      vmProcess.kill('SIGTERM');
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

    // List running VMs
    for (const [name, process] of Array.from(this.runningVMs.entries())) {
      vms.push({
        name,
        type: 'linux', // TODO: Track type
        status: 'running',
        pid: process.pid
      });
    }

    // TODO: List stopped VMs from filesystem

    return vms;
  }

  /**
   * Get VM status
   */
  async getVMStatus(name: string): Promise<VMInfo> {
    const vmProcess = this.runningVMs.get(name);
    
    if (vmProcess && vmProcess.pid) {
      return {
        name,
        type: 'linux',
        status: 'running',
        pid: vmProcess.pid
      };
    }

    return {
      name,
      type: 'linux',
      status: 'stopped'
    };
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

