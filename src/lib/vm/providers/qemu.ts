/**
 * QEMU Provider
 * Linux and BSD support with optional KVM acceleration
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { validateVMName, validateVMPath, validateDownloadUrl } from '../security';
import { logger } from '@/lib/logger';
import { spawn, exec as execCallback, execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCallback);
const execFile = promisify(execFileCallback);

export class QEMUProvider implements VMProvider {
  name = 'qemu';
  private kvm: boolean;
  private vmBaseDir: string;
  
  constructor(options: { kvm: boolean }) {
    this.kvm = options.kvm;
    this.vmBaseDir = path.join(os.homedir(), '.vibecode/qemu/vms');
  }
  
  async detect(): Promise<boolean> {
    try {
      const arch = os.arch();
      const qemuBinary = arch === 'arm64' ? 'qemu-system-aarch64' : 'qemu-system-x86_64';
      await exec(`which ${qemuBinary}`);
      return true;
    } catch {
      return false;
    }
  }
  
  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating QEMU VM', { name: config.name, kvm: this.kvm });

    const safeName = validateVMName(config.name);
    const vmDir = validateVMPath(this.vmBaseDir, safeName);

    // Create directory structure
    await fs.mkdir(validateVMPath(vmDir, 'disks'), { recursive: true });
    await fs.mkdir(validateVMPath(vmDir, 'logs'), { recursive: true });
    
    // Download Alpine ISO if needed
    await this.ensureAlpineISO(vmDir);
    
    // Create disk image
    const diskPath = await this.createDisk(vmDir, config.disk);
    
    // Launch VM
    return await this.launch(vmDir, config, diskPath);
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting QEMU VM', { vmId });
    
    const vmDir = path.join(this.vmBaseDir, vmId);
    const configPath = path.join(vmDir, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: VMConfig = JSON.parse(configData);
    
    const diskPath = path.join(vmDir, 'disks/root.qcow2');
    await this.launch(vmDir, config, diskPath);
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping QEMU VM', { vmId });
    
    const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');
    
    try {
      const pid = await fs.readFile(pidPath, 'utf-8');
      process.kill(parseInt(pid.trim()), 'SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Force kill if still running
      try {
        process.kill(parseInt(pid.trim()), 0);
        process.kill(parseInt(pid.trim()), 'SIGKILL');
      } catch {
        // Already stopped
      }
      
      await fs.unlink(pidPath);
    } catch (error) {
      logger.error('Failed to stop VM', { vmId, error });
      throw error;
    }
  }
  
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying QEMU VM', { vmId });
    
    try {
      await this.stop(vmId);
    } catch {
      // VM might not be running
    }
    
    const vmDir = path.join(this.vmBaseDir, vmId);
    await fs.rm(vmDir, { recursive: true, force: true });
  }
  
  async list(): Promise<VM[]> {
    const vms: VM[] = [];
    
    try {
      const entries = await fs.readdir(this.vmBaseDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const vmDir = path.join(this.vmBaseDir, entry.name);
            const configPath = path.join(vmDir, 'config.json');
            const configData = await fs.readFile(configPath, 'utf-8');
            const config: VMConfig = JSON.parse(configData);
            
            const status = await this.getVMStatus(entry.name);
            
            vms.push({
              id: entry.name,
              name: entry.name,
              provider: 'qemu',
              status,
              ports: config.ports || [],
              createdAt: new Date(),
              updatedAt: new Date()
            });
          } catch {
            // Skip invalid VM directories
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list VMs', { error });
    }
    
    return vms;
  }
  
  async exec(vmId: string, command: string): Promise<ExecResult> {
    const startTime = Date.now();
    
    logger.info('Executing command in VM via SSH', { vmId, command });
    
    // QEMU VMs need SSH access
    // Assuming SSH is configured with key-based auth
    const vmDir = path.join(this.vmBaseDir, vmId);
    const sshPort = 2222; // Default SSH forward port
    
    try {
      const { stdout, stderr } = await exec(
        `ssh -p ${sshPort} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@localhost "${command}"`
      );
      
      return {
        exitCode: 0,
        stdout,
        stderr,
        duration: Date.now() - startTime
      };
    } catch (error: unknown) {
      return {
        exitCode: (error as any)?.code || 1,
        stdout: (error as any)?.stdout || '',
        stderr: (error as any)?.stderr || (error instanceof Error ? error.message : 'Unknown error'),
        duration: Date.now() - startTime
      };
    }
  }
  
  async status(vmId: string): Promise<VMStatus> {
    return await this.getVMStatus(vmId);
  }
  
  /**
   * Ensure Alpine ISO is downloaded
   */
  private async ensureAlpineISO(vmDir: string): Promise<void> {
    const isoPath = validateVMPath(vmDir, 'alpine-virt-3.22.2-aarch64.iso');

    try {
      await fs.access(isoPath);
      logger.info('Alpine ISO already exists');
      return;
    } catch {
      // Need to download
    }

    logger.info('Downloading Alpine ISO...');

    const arch = os.arch() === 'arm64' ? 'aarch64' : 'x86_64';
    const url = `https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/${arch}/alpine-virt-3.22.2-${arch}.iso`;
    const validatedUrl = validateDownloadUrl(url);

    // Use execFile with array args to prevent shell injection
    await execFile('curl', ['-L', '-o', isoPath, validatedUrl.href]);
    logger.info('Alpine ISO downloaded');
  }
  
  /**
   * Create QCOW2 disk image
   */
  private async createDisk(vmDir: string, size: string): Promise<string> {
    const diskPath = validateVMPath(vmDir, 'disks/root.qcow2');

    try {
      await fs.access(diskPath);
      logger.info('Disk already exists');
      return diskPath;
    } catch {
      // Need to create
    }
    
    logger.info('Creating QCOW2 disk', { size });

    // Use execFile with array args to prevent shell injection
    await execFile('qemu-img', ['create', '-f', 'qcow2', diskPath, size]);

    return diskPath;
  }
  
  /**
   * Launch QEMU VM
   */
  private async launch(vmDir: string, config: VMConfig, diskPath: string): Promise<VM> {
    logger.info('Launching QEMU VM', { name: config.name, kvm: this.kvm });
    
    const arch = config.arch === 'arm64' ? 'aarch64' : 'x86_64';
    const qemuBinary = `qemu-system-${arch}`;
    const isoPath = path.join(vmDir, `alpine-virt-3.22.2-${arch}.iso`);
    const monitorPath = path.join(vmDir, 'monitor.sock');
    
    const args = [
      '-m', this.parseSizeToMB(config.memory).toString(),
      '-smp', config.cpus.toString(),
      '-drive', `file=${diskPath},format=qcow2`,
      '-cdrom', isoPath,
      '-boot', 'd',
      '-monitor', `unix:${monitorPath},server,nowait`,
      '-daemonize',
      '-pidfile', path.join(vmDir, 'vm.pid')
    ];
    
    // Add KVM acceleration if available
    if (this.kvm) {
      args.push('-enable-kvm');
      args.push('-cpu', 'host');
    } else {
      args.push('-cpu', arch === 'aarch64' ? 'cortex-a76' : 'qemu64');
    }
    
    // Add network with port forwarding
    const portForwards = config.ports?.map(p => 
      `hostfwd=tcp::${p.host}-:${p.guest}`
    ).join(',') || '';
    
    args.push('-netdev', `user,id=net0${portForwards ? ',' + portForwards : ''}`);
    args.push('-device', 'virtio-net-pci,netdev=net0');
    
    // Add virtio-rng for entropy
    args.push('-device', 'virtio-rng-pci');
    
    // Spawn QEMU
    const proc = spawn(qemuBinary, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    proc.unref();
    
    // Save config
    const configPath = validateVMPath(vmDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Wait for VM to boot
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      id: config.name,
      name: config.name,
      provider: 'qemu',
      status: 'running',
      ports: config.ports || [],
      metadata: { kvm: this.kvm },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  /**
   * Get VM status
   */
  private async getVMStatus(vmId: string): Promise<VMStatus> {
    const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');
    
    try {
      const pid = await fs.readFile(pidPath, 'utf-8');
      
      try {
        process.kill(parseInt(pid.trim()), 0);
        return 'running';
      } catch {
        return 'stopped';
      }
    } catch {
      return 'stopped';
    }
  }
  
  /**
   * Parse size to MB
   */
  private parseSizeToMB(size: string): number {
    const match = size.match(/^(\d+)(GB|MB)?$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }
    
    const value = parseInt(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();
    
    switch (unit) {
      case 'GB':
        return value * 1024;
      case 'MB':
        return value;
      default:
        return value;
    }
  }
}
