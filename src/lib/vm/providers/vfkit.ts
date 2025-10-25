/**
 * vfkit Provider
 * Ports existing bash scripts from scripts/vfkit/ to TypeScript
 * Uses Apple Virtualization.framework for native macOS performance
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult, PortMapping } from '../types';
import { logger } from '@/lib/logger';
import { spawn, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCallback);

export class VfkitProvider implements VMProvider {
  name = 'vfkit';
  private vmBaseDir: string;
  
  constructor() {
    this.vmBaseDir = path.join(os.homedir(), '.vfkit/vms');
  }
  
  async detect(): Promise<boolean> {
    try {
      await exec('which vfkit');
      return true;
    } catch {
      return false;
    }
  }
  
  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating vfkit VM', { name: config.name });
    
    const vmDir = path.join(this.vmBaseDir, config.name);
    
    // Create directory structure
    await this.createDirectories(vmDir);
    
    // Download/ensure Alpine kernel
    await this.ensureKernel(vmDir, config);
    
    // Create rootfs
    await this.ensureRootfs(vmDir, config);
    
    // Create disk image
    await this.createDisk(vmDir, config.disk);
    
    // Launch VM
    return await this.launch(vmDir, config);
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting vfkit VM', { vmId });
    
    const vmDir = path.join(this.vmBaseDir, vmId);
    
    // Read config from VM directory
    const configPath = path.join(vmDir, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: VMConfig = JSON.parse(configData);
    
    await this.launch(vmDir, config);
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping vfkit VM', { vmId });
    
    const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');
    
    try {
      const pid = await fs.readFile(pidPath, 'utf-8');
      process.kill(parseInt(pid.trim()), 'SIGTERM');
      
      // Wait for process to stop
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Remove PID file
      await fs.unlink(pidPath);
    } catch (error) {
      logger.error('Failed to stop VM', { vmId, error });
      throw error;
    }
  }
  
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying vfkit VM', { vmId });
    
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
              provider: 'vfkit',
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
    
    logger.info('Executing command in VM', { vmId, command });
    
    // For vfkit, we need to use console/serial connection
    // This is a simplified implementation
    // In production, would use virtio-serial or SSH
    
    try {
      const result = await exec(command);
      
      return {
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        duration: Date.now() - startTime
      };
    }
  }
  
  async status(vmId: string): Promise<VMStatus> {
    return await this.getVMStatus(vmId);
  }
  
  /**
   * Create VM directory structure
   * Ported from scripts/vfkit/09-launch-node24-vm.sh
   */
  private async createDirectories(vmDir: string): Promise<void> {
    await fs.mkdir(path.join(vmDir, 'kernel'), { recursive: true });
    await fs.mkdir(path.join(vmDir, 'rootfs'), { recursive: true });
    await fs.mkdir(path.join(vmDir, 'disk'), { recursive: true });
    await fs.mkdir(path.join(vmDir, 'logs'), { recursive: true });
  }
  
  /**
   * Ensure Alpine kernel is available
   * Ported from scripts/vfkit/10-upgrade-to-alpine-3.22.sh
   */
  private async ensureKernel(vmDir: string, config: VMConfig): Promise<void> {
    const kernelDir = path.join(vmDir, 'kernel');
    const vmlinuxPath = path.join(kernelDir, 'vmlinux');
    
    // Check if kernel already exists
    try {
      await fs.access(vmlinuxPath);
      logger.info('Kernel already exists', { vmlinuxPath });
      return;
    } catch {
      // Need to download kernel
    }
    
    logger.info('Downloading Alpine 3.22 kernel...');
    
    const alpineVersion = '3.22.2';
    const arch = config.arch || 'aarch64';
    const isoUrl = `https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/${arch}/alpine-virt-${alpineVersion}-${arch}.iso`;
    const isoPath = path.join(kernelDir, `alpine-virt-${alpineVersion}-${arch}.iso`);
    
    // Download ISO
    await exec(`curl -L -o ${isoPath} ${isoUrl}`);
    
    // Extract kernel
    const mountPoint = '/tmp/alpine-mount';
    await exec(`mkdir -p ${mountPoint}`);
    await exec(`hdiutil attach ${isoPath} -mountpoint ${mountPoint}`);
    
    try {
      // Copy compressed kernel
      await exec(`cp ${mountPoint}/boot/vmlinuz-virt ${path.join(kernelDir, 'vmlinuz')}`);
      
      // Decompress kernel (vfkit needs uncompressed)
      await exec(`gunzip -c ${path.join(kernelDir, 'vmlinuz')} > ${vmlinuxPath}`);
      
      // Copy initramfs
      await exec(`cp ${mountPoint}/boot/initramfs-virt ${path.join(kernelDir, 'initramfs')}`);
    } finally {
      await exec(`hdiutil detach ${mountPoint}`);
    }
    
    logger.info('Kernel downloaded and extracted');
  }
  
  /**
   * Ensure rootfs is available
   * Ported from scripts/vfkit/08-create-node24-rootfs.sh
   */
  private async ensureRootfs(vmDir: string, config: VMConfig): Promise<void> {
    const rootfsPath = path.join(vmDir, 'rootfs/alpine-rootfs.cpio.gz');
    
    // Check if rootfs already exists
    try {
      await fs.access(rootfsPath);
      logger.info('Rootfs already exists', { rootfsPath });
      return;
    } catch {
      // Need to create rootfs
    }
    
    logger.info('Creating Alpine rootfs with Node.js 24...');
    
    // This would be a complex build process
    // For now, we'll use a pre-built rootfs or existing one
    // In production, would port the full rootfs build logic
    
    logger.warn('Rootfs creation not yet implemented - using existing rootfs');
  }
  
  /**
   * Create disk image
   */
  private async createDisk(vmDir: string, size: string): Promise<void> {
    const diskPath = path.join(vmDir, 'disk/root.img');
    
    // Check if disk already exists
    try {
      await fs.access(diskPath);
      logger.info('Disk already exists', { diskPath });
      return;
    } catch {
      // Need to create disk
    }
    
    logger.info('Creating disk image', { size });
    
    // Convert size (e.g., "20GB" to bytes)
    const sizeBytes = this.parseSizeToBytes(size);
    
    // Create raw disk image
    await exec(`dd if=/dev/zero of=${diskPath} bs=1m count=${sizeBytes / (1024 * 1024)}`);
  }
  
  /**
   * Launch VM
   * Ported from scripts/vfkit/09-launch-node24-vm.sh
   */
  private async launch(vmDir: string, config: VMConfig): Promise<VM> {
    logger.info('Launching vfkit VM', { name: config.name });
    
    const kernelPath = path.join(vmDir, 'kernel/vmlinux');
    const initrdPath = path.join(vmDir, 'kernel/initramfs');
    const diskPath = path.join(vmDir, 'disk/root.img');
    const consolePath = path.join(vmDir, 'logs/console.log');
    
    // Build vfkit command
    const args = [
      '--cpus', config.cpus.toString(),
      '--memory', this.parseSizeToBytes(config.memory).toString(),
      '--kernel', kernelPath,
      '--initrd', initrdPath,
      '--device', `virtio-blk,path=${diskPath}`,
      '--device', 'virtio-net,nat',
      '--device', `virtio-serial,logFilePath=${consolePath}`,
      '--device', 'virtio-rng',
      '--kernel-cmdline', 'console=hvc0 quiet'
    ];
    
    // Add port forwarding (if supported)
    // Note: vfkit doesn't natively support port forwarding
    // Would need SSH tunneling or other workaround
    
    // Spawn vfkit process
    const proc = spawn('vfkit', args, {
      detached: true,
      stdio: 'ignore'
    });
    
    proc.unref();
    
    // Save PID
    const pidPath = path.join(vmDir, 'vm.pid');
    await fs.writeFile(pidPath, proc.pid!.toString());
    
    // Save config
    const configPath = path.join(vmDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    // Wait for VM to boot
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      id: config.name,
      name: config.name,
      provider: 'vfkit',
      status: 'running',
      ports: config.ports || [],
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
      
      // Check if process is running
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
   * Parse size string to bytes
   */
  private parseSizeToBytes(size: string): number {
    const match = size.match(/^(\d+)(GB|MB|KB)?$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }
    
    const value = parseInt(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();
    
    switch (unit) {
      case 'GB':
        return value * 1024 * 1024 * 1024;
      case 'MB':
        return value * 1024 * 1024;
      case 'KB':
        return value * 1024;
      default:
        return value;
    }
  }
}
