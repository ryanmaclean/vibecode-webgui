/**
 * Native VM Provider
 * Uses Apple Virtualization.framework via Swift VM manager
 * macOS 12.0+ (Monterey) required
 *
 * Architecture:
 * - TypeScript layer: This provider (spawns and communicates with Swift binary)
 * - Swift layer: platforms/macos/vm/Sources/main.swift (manages VMs using Virtualization.framework)
 * - Protocol: JSON-RPC over stdio
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult, PortMapping } from '../types';
import { logger } from '@/lib/logger';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCallback);

// JSON-RPC protocol types
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface NativeVMConfig {
  vmId: string;
  cpus: number;
  memoryGB: number;
  diskSizeGB: number;
  kernelPath: string;
  initrdPath: string;
  diskPath: string;
  ports?: PortMapping[];
}

interface SwiftVMInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  cpus: number;
  memory: number;
  createdAt: string;
}

export class NativeVMProvider implements VMProvider {
  name = 'native-vm';
  private vmBaseDir: string;
  private swiftBinaryPath: string;
  private processes: Map<string, ChildProcess> = new Map();
  private requestId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    this.vmBaseDir = path.join(os.homedir(), '.vibecode/native-vms');
    // Path to compiled Swift binary
    this.swiftBinaryPath = path.join(
      __dirname,
      '../../../../platforms/macos/vm/.build/release/vibecode-vm'
    );
  }

  /**
   * Detect if native VM provider is available
   * Requirements:
   * - macOS platform
   * - macOS 12.0+ (Monterey)
   * - Swift binary compiled
   */
  async detect(): Promise<boolean> {
    // Check platform
    if (process.platform !== 'darwin') {
      logger.debug('Native VM provider: not macOS');
      return false;
    }

    // Check macOS version
    try {
      const { stdout } = await exec('sw_vers -productVersion');
      const version = stdout.trim();
      const [major, minor] = version.split('.').map(Number);

      // macOS 12.0+ required for Virtualization.framework improvements
      if (major < 12) {
        logger.debug('Native VM provider: macOS version too old', { version });
        return false;
      }
    } catch (error) {
      logger.error('Failed to check macOS version', { error });
      return false;
    }

    // Check Swift binary
    try {
      await fs.access(this.swiftBinaryPath, fs.constants.X_OK);
      logger.info('Native VM provider detected', { binaryPath: this.swiftBinaryPath });
      return true;
    } catch {
      logger.debug('Native VM provider: Swift binary not found', {
        path: this.swiftBinaryPath
      });
      return false;
    }
  }

  /**
   * Create and start a new VM
   */
  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating native VM', { name: config.name });

    const vmDir = path.join(this.vmBaseDir, config.name);

    // Create directory structure
    await this.createDirectories(vmDir);

    // Download/ensure kernel and initrd
    await this.ensureKernel(vmDir, config);

    // Create disk image
    await this.createDisk(vmDir, config.disk);

    // Prepare native VM configuration
    const nativeConfig: NativeVMConfig = {
      vmId: config.name,
      cpus: config.cpus,
      memoryGB: this.parseMemoryToGB(config.memory),
      diskSizeGB: this.parseSizeToGB(config.disk),
      kernelPath: path.join(vmDir, 'kernel/vmlinuz'),
      initrdPath: path.join(vmDir, 'kernel/initramfs'),
      diskPath: path.join(vmDir, 'disk/root.img'),
      ports: config.ports
    };

    // Save configuration
    const configPath = path.join(vmDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Launch VM via Swift process
    const proc = await this.launchSwiftVM(vmDir, nativeConfig);
    this.processes.set(config.name, proc);

    // Wait for VM to start (check status)
    await this.waitForVMReady(config.name);

    return {
      id: config.name,
      name: config.name,
      provider: 'native-vm',
      status: 'running',
      ports: config.ports || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Start an existing VM
   */
  async start(vmId: string): Promise<void> {
    logger.info('Starting native VM', { vmId });

    const vmDir = path.join(this.vmBaseDir, vmId);

    // Check if already running
    if (this.processes.has(vmId)) {
      logger.warn('VM already running', { vmId });
      return;
    }

    // Load configuration
    const configPath = path.join(vmDir, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: VMConfig = JSON.parse(configData);

    const nativeConfig: NativeVMConfig = {
      vmId: vmId,
      cpus: config.cpus,
      memoryGB: this.parseMemoryToGB(config.memory),
      diskSizeGB: this.parseSizeToGB(config.disk),
      kernelPath: path.join(vmDir, 'kernel/vmlinuz'),
      initrdPath: path.join(vmDir, 'kernel/initramfs'),
      diskPath: path.join(vmDir, 'disk/root.img'),
      ports: config.ports
    };

    // Launch VM
    const proc = await this.launchSwiftVM(vmDir, nativeConfig);
    this.processes.set(vmId, proc);

    await this.waitForVMReady(vmId);
  }

  /**
   * Stop a running VM
   */
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping native VM', { vmId });

    const proc = this.processes.get(vmId);
    if (!proc) {
      logger.warn('VM process not found', { vmId });
      return;
    }

    try {
      // Send shutdown request via JSON-RPC
      await this.sendRequest(proc, 'vm.stop', { vmId });

      // Wait for graceful shutdown
      const timedOut = await new Promise<boolean>((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        }, 10000);

        proc.once('exit', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });
      });

      if (timedOut) {
        // Force kill if doesn't stop gracefully
        logger.error('Failed to stop VM gracefully, forcing', { vmId });
        proc.kill('SIGKILL');
        this.processes.delete(vmId);
        throw new Error(`VM ${vmId} failed to stop gracefully, forced kill`);
      }

      this.processes.delete(vmId);
    } catch (error) {
      logger.error('Failed to stop VM gracefully, forcing', { vmId, error });
      proc.kill('SIGKILL');
      this.processes.delete(vmId);
      throw error;
    }
  }

  /**
   * Destroy a VM and its resources
   */
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying native VM', { vmId });

    // Stop VM if running
    try {
      await this.stop(vmId);
    } catch {
      // VM might not be running
    }

    // Remove VM directory
    const vmDir = path.join(this.vmBaseDir, vmId);
    await fs.rm(vmDir, { recursive: true, force: true });
  }

  /**
   * List all VMs
   */
  async list(): Promise<VM[]> {
    const vms: VM[] = [];

    try {
      await fs.mkdir(this.vmBaseDir, { recursive: true });
      const entries = await fs.readdir(this.vmBaseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const vmDir = path.join(this.vmBaseDir, entry.name);
            const configPath = path.join(vmDir, 'config.json');
            const configData = await fs.readFile(configPath, 'utf-8');
            const config: VMConfig = JSON.parse(configData);

            const status = await this.status(entry.name);

            vms.push({
              id: entry.name,
              name: entry.name,
              provider: 'native-vm',
              status,
              ports: config.ports || [],
              createdAt: new Date(),
              updatedAt: new Date()
            });
          } catch (error) {
            logger.warn('Failed to load VM config', { vmId: entry.name, error });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list VMs', { error });
    }

    return vms;
  }

  /**
   * Execute command in VM
   */
  async exec(vmId: string, command: string): Promise<ExecResult> {
    const startTime = Date.now();
    logger.info('Executing command in VM', { vmId, command });

    const proc = this.processes.get(vmId);
    if (!proc) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'VM not running',
        duration: Date.now() - startTime
      };
    }

    try {
      const result = await this.sendRequest(proc, 'vm.exec', { vmId, command });

      return {
        exitCode: result.exitCode || 0,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get VM status
   */
  async status(vmId: string): Promise<VMStatus> {
    const proc = this.processes.get(vmId);

    if (!proc || proc.killed) {
      return 'stopped';
    }

    try {
      const result = await this.sendRequest(proc, 'vm.status', { vmId });
      return this.mapSwiftStatus(result.status);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Launch Swift VM process
   */
  private async launchSwiftVM(vmDir: string, config: NativeVMConfig): Promise<ChildProcess> {
    logger.info('Launching Swift VM process', { vmId: config.vmId });

    // Build command line arguments
    const args = [
      '--json-rpc',  // Enable JSON-RPC mode
      '--vm-id', config.vmId,
      '--cpus', config.cpus.toString(),
      '--memory', config.memoryGB.toString(),
      '--kernel', config.kernelPath,
      '--initrd', config.initrdPath,
      '--disk', config.diskPath
    ];

    // Add port forwarding
    if (config.ports) {
      for (const port of config.ports) {
        args.push('--port', `${port.host}:${port.guest}`);
      }
    }

    // Spawn Swift process
    const proc = spawn(this.swiftBinaryPath, args, {
      cwd: vmDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Setup JSON-RPC communication
    this.setupJSONRPCHandlers(proc);

    // Handle process exit
    proc.on('exit', (code, signal) => {
      logger.info('Swift VM process exited', {
        vmId: config.vmId,
        code,
        signal
      });
      this.processes.delete(config.vmId);
    });

    proc.on('error', (error) => {
      logger.error('Swift VM process error', {
        vmId: config.vmId,
        error
      });
    });

    return proc;
  }

  /**
   * Setup JSON-RPC handlers for stdio communication
   */
  private setupJSONRPCHandlers(proc: ChildProcess): void {
    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete JSON-RPC messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response: JSONRPCResponse = JSON.parse(line);
            this.handleJSONRPCResponse(response);
          } catch (error) {
            logger.error('Failed to parse JSON-RPC response', { line, error });
          }
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      logger.warn('Swift VM stderr', { data: data.toString() });
    });
  }

  /**
   * Handle JSON-RPC response
   */
  private handleJSONRPCResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(Number(response.id));

    if (!pending) {
      logger.warn('No pending request for response', { id: response.id });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(Number(response.id));

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Send JSON-RPC request to Swift process
   */
  private async sendRequest(
    proc: ChildProcess,
    method: string,
    params?: any,
    timeoutMs: number = 30000
  ): Promise<any> {
    const id = ++this.requestId;

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request via stdin (newline-delimited JSON)
      proc.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Wait for VM to be ready
   */
  private async waitForVMReady(vmId: string, maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await this.status(vmId);
        if (status === 'running') {
          logger.info('VM is ready', { vmId });
          return;
        }
      } catch {
        // Keep waiting
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`VM failed to start within ${maxWaitMs}ms`);
  }

  /**
   * Create VM directory structure
   */
  private async createDirectories(vmDir: string): Promise<void> {
    await fs.mkdir(path.join(vmDir, 'kernel'), { recursive: true });
    await fs.mkdir(path.join(vmDir, 'disk'), { recursive: true });
    await fs.mkdir(path.join(vmDir, 'logs'), { recursive: true });
  }

  /**
   * Ensure kernel and initrd are available
   */
  private async ensureKernel(vmDir: string, config: VMConfig): Promise<void> {
    const kernelPath = path.join(vmDir, 'kernel/vmlinuz');
    const initrdPath = path.join(vmDir, 'kernel/initramfs');

    // Check if kernel already exists
    try {
      await fs.access(kernelPath);
      await fs.access(initrdPath);
      logger.info('Kernel and initrd already exist');
      return;
    } catch {
      // Need to download
    }

    logger.info('Downloading Alpine kernel and initrd...');

    const alpineVersion = 'v3.22';
    const arch = config.arch === 'x86_64' ? 'x86_64' : 'aarch64';
    const baseUrl = `https://dl-cdn.alpinelinux.org/alpine/${alpineVersion}/releases/${arch}/netboot`;

    try {
      await exec(`curl -fL -o ${kernelPath} ${baseUrl}/vmlinuz-virt`);
      await exec(`curl -fL -o ${initrdPath} ${baseUrl}/initramfs-virt`);
      logger.info('Kernel and initrd downloaded successfully');
    } catch (error) {
      logger.error('Failed to download kernel', { error });
      throw error;
    }
  }

  /**
   * Create disk image
   */
  private async createDisk(vmDir: string, size: string): Promise<void> {
    const diskPath = path.join(vmDir, 'disk/root.img');

    // Check if disk already exists
    try {
      await fs.access(diskPath);
      logger.info('Disk already exists');
      return;
    } catch {
      // Need to create
    }

    logger.info('Creating disk image', { size });

    const sizeGB = this.parseSizeToGB(size);
    const sizeBytes = sizeGB * 1024 * 1024 * 1024;

    // Create sparse file
    const fileHandle = await fs.open(diskPath, 'w');
    try {
      await fileHandle.truncate(sizeBytes);
    } finally {
      await fileHandle.close();
    }

    logger.info('Disk image created');
  }

  /**
   * Parse memory string to GB
   */
  private parseMemoryToGB(memory: string): number {
    const match = memory.match(/^(\d+)(GB|MB)?$/i);
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`);
    }

    const value = parseInt(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    switch (unit) {
      case 'GB':
        return value;
      case 'MB':
        return value / 1024;
      default:
        return value / 1024; // Default to MB
    }
  }

  /**
   * Parse size string to GB
   */
  private parseSizeToGB(size: string): number {
    const match = size.match(/^(\d+)(GB|MB|TB)?$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }

    const value = parseInt(match[1]);
    const unit = (match[2] || 'GB').toUpperCase();

    switch (unit) {
      case 'TB':
        return value * 1024;
      case 'GB':
        return value;
      case 'MB':
        return value / 1024;
      default:
        return value;
    }
  }

  /**
   * Map Swift VM status to VMStatus
   */
  private mapSwiftStatus(status: string): VMStatus {
    switch (status.toLowerCase()) {
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'stopping':
        return 'stopping';
      case 'error':
        return 'error';
      default:
        return 'unknown';
    }
  }
}
