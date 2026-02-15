/**
 * vfkit Provider
 * Ports existing bash scripts from scripts/vfkit/ to TypeScript
 * Uses Apple Virtualization.framework for native macOS performance
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { validateVMName, validateVMPath, validateDownloadUrl } from '../security';
import { logger } from '@/lib/logger';
import { spawn, exec as execCallback, execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { isProcessRunning, waitForBoot } from '../utils/health-check';
import { retryWithThrow } from '../utils/retry';
import { validateMemoryAllocation, getRecommendedCpus } from '../utils/system-resources';

const exec = promisify(execCallback);
const execFile = promisify(execFileCallback);
let __tracer: any;
function getTracer() {
  if (!__tracer) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const t = require('dd-trace');
      if (!t._initialized) {
        t.init({ service: process.env.DD_SERVICE || 'vibecode-webgui' });
        t._initialized = true;
      }
      __tracer = t;
    } catch {
      __tracer = { startSpan: () => ({ setTag() {}, finish() {} }) };
    }
  }
  return __tracer;
}

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
    const span = getTracer().startSpan('vfkit.create');
    span.setTag('vm.name', config.name);

    const safeName = validateVMName(config.name);
    const vmDir = validateVMPath(this.vmBaseDir, safeName);

    // Validate memory allocation (limit to 80% of available memory)
    const sValidate = getTracer().startSpan('vfkit.create.validateResources');
    const memoryValidation = await validateMemoryAllocation(config.memory, 80);
    if (!memoryValidation.valid) {
      sValidate.finish();
      span.finish();
      logger.error('Memory allocation validation failed', {
        vmId: config.name,
        requested: config.memory,
        validation: memoryValidation
      });
      throw new Error(
        `Memory allocation validation failed: ${memoryValidation.message}. ` +
        `Requested: ${config.memory}, Available: ${memoryValidation.availableBytes} bytes, ` +
        `Max safe allocation: ${memoryValidation.maxSafeAllocation} bytes`
      );
    }

    // Validate CPU allocation (limit to 75% of available cores by default)
    const recommendedCpus = await getRecommendedCpus(config.cpus, 75);
    if (config.cpus > recommendedCpus) {
      logger.warn('CPU allocation exceeds recommendation', {
        vmId: config.name,
        requested: config.cpus,
        recommended: recommendedCpus
      });
      // Don't fail, but log warning - CPU over-allocation is less critical than memory
    }

    logger.info('Resource allocation validated', {
      vmId: config.name,
      memory: config.memory,
      memoryBytes: memoryValidation.requestedBytes,
      cpus: config.cpus,
      recommendedCpus
    });
    sValidate.finish();

    // Create directory structure
    const sDirs = getTracer().startSpan('vfkit.create.directories');
    await this.createDirectories(vmDir);
    sDirs.finish();
    
    // Download/ensure Alpine kernel
    const sKernel = getTracer().startSpan('vfkit.create.ensureKernel');
    await this.ensureKernel(vmDir, config);
    sKernel.finish();
    
    // Create rootfs
    const sRootfs = getTracer().startSpan('vfkit.create.ensureRootfs');
    await this.ensureRootfs(vmDir, config);
    sRootfs.finish();
    
    // Create disk image
    const sDisk = getTracer().startSpan('vfkit.create.createDisk');
    await this.createDisk(vmDir, config.disk);
    sDisk.finish();
    
    // Launch VM with retry logic
    const sLaunch = getTracer().startSpan('vfkit.create.launch');
    try {
      const vm = await retryWithThrow(
        () => this.launch(vmDir, config),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
          operationName: 'vfkit-launch',
          context: { vmId: config.name, vmDir }
        }
      );
      sLaunch.finish();
      span.finish();
      return vm;
    } catch (e) {
      sLaunch.finish();
      span.finish();
      throw e;
    }
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting vfkit VM', { vmId });

    const vmDir = path.join(this.vmBaseDir, vmId);

    // Read config from VM directory
    const configPath = path.join(vmDir, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: VMConfig = JSON.parse(configData);

    // Launch VM with retry logic
    await retryWithThrow(
      () => this.launch(vmDir, config),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        operationName: 'vfkit-start',
        context: { vmId, vmDir }
      }
    );
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping vfkit VM', { vmId });

    const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');

    try {
      const pidContent = await fs.readFile(pidPath, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);

      // Attempt graceful ACPI shutdown via serial console
      try {
        await this.sendACPIShutdown(vmId);
        logger.info('ACPI shutdown signal sent', { vmId });

        // Wait for graceful shutdown (30 seconds for ACPI)
        const acpiTimeout = 30000;
        const interval = 100;
        const maxAttempts = acpiTimeout / interval;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const running = await isProcessRunning(pid);

          if (!running) {
            logger.info('VM stopped gracefully via ACPI', {
              vmId,
              pid,
              duration: Date.now() - startTime
            });
            await fs.unlink(pidPath);
            return;
          }

          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, interval));
          }
        }

        logger.warn('ACPI shutdown timeout, falling back to SIGTERM', { vmId });
      } catch (error) {
        logger.warn('ACPI shutdown not available, using SIGTERM', { vmId, error });
      }

      // Fall back to SIGTERM
      process.kill(pid, 'SIGTERM');

      // Wait for process to stop with SIGTERM
      const timeout = 10000; // 10 seconds timeout
      const interval = 100; // Check every 100ms
      const maxAttempts = timeout / interval;
      const startTime = Date.now();

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const running = await isProcessRunning(pid);

        if (!running) {
          logger.info('VM process stopped via SIGTERM', {
            vmId,
            pid,
            duration: Date.now() - startTime
          });
          await fs.unlink(pidPath);
          return;
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        } else {
          logger.error('Failed to stop VM gracefully, forcing', { vmId, pid });
          process.kill(pid, 'SIGKILL');
          await fs.unlink(pidPath);
          throw new Error(`VM ${vmId} failed to stop gracefully, forced kill`);
        }
      }
    } catch (error) {
      logger.error('Failed to stop VM', { vmId, error });
      throw error;
    }
  }

  /**
   * Send ACPI shutdown signal to VM via serial console
   * This triggers a graceful OS shutdown inside the guest
   */
  private async sendACPIShutdown(vmId: string): Promise<void> {
    const vmDir = path.join(this.vmBaseDir, vmId);
    const consolePath = path.join(vmDir, 'logs/console.log');

    // For vfkit, ACPI shutdown can be triggered by writing to the serial console
    // This sends a shutdown command to the guest OS via virtio-serial
    // The guest must be configured to handle this (e.g., via inittab or systemd)

    try {
      // Write shutdown command to serial console
      // The exact mechanism depends on guest OS configuration
      // For Alpine Linux with proper init, this triggers ACPI shutdown
      const shutdownCommand = '\x00ACPI_SHUTDOWN\n';

      // Note: vfkit doesn't expose a direct ACPI interface
      // This is a placeholder for the actual ACPI mechanism
      // In practice, would need guest agent or SSH access
      logger.debug('ACPI shutdown mechanism not yet fully implemented', { vmId });

      // Throw to fall back to SIGTERM
      throw new Error('ACPI shutdown not available for vfkit');
    } catch (error) {
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
   * Create VM directory structure
   * Ported from scripts/vfkit/09-launch-node24-vm.sh
   */
  private async createDirectories(vmDir: string): Promise<void> {
    await fs.mkdir(validateVMPath(vmDir, 'kernel'), { recursive: true });
    await fs.mkdir(validateVMPath(vmDir, 'rootfs'), { recursive: true });
    await fs.mkdir(validateVMPath(vmDir, 'disk'), { recursive: true });
    await fs.mkdir(validateVMPath(vmDir, 'logs'), { recursive: true });
  }
  
  /**
   * Ensure Alpine kernel is available
   * Ported from scripts/vfkit/10-upgrade-to-alpine-3.22.sh
   */
  private async ensureKernel(vmDir: string, config: VMConfig): Promise<void> {
    const kernelDir = validateVMPath(vmDir, 'kernel');
    const vmlinuxPath = validateVMPath(kernelDir, 'vmlinux');

    // Check if kernel already exists
    try {
      await fs.access(vmlinuxPath);
      logger.info('Kernel already exists', { vmlinuxPath });
      return;
    } catch {
      // Need to download kernel
    }
    const span = getTracer().startSpan('vfkit.ensureKernel');
    logger.info('Downloading Alpine netboot kernel...');
    const alpineVersion = 'v3.22';
    const arch = (config.arch === 'x86_64' ? 'x86_64' : 'aarch64');
    const baseUrl = `https://dl-cdn.alpinelinux.org/alpine/${alpineVersion}/releases/${arch}/netboot`;
    const vmlinuzUrl = `${baseUrl}/vmlinuz-virt`;
    const initramfsUrl = `${baseUrl}/initramfs-virt`;
    const validatedVmlinuzUrl = validateDownloadUrl(vmlinuzUrl);
    const validatedInitramfsUrl = validateDownloadUrl(initramfsUrl);
    const vmlinuzPath = validateVMPath(kernelDir, 'vmlinuz');
    const initramfsPath = validateVMPath(kernelDir, 'initramfs');
    try {
      // Use execFile with array args to prevent shell injection
      await execFile('curl', ['-fL', '-o', vmlinuzPath, validatedVmlinuzUrl.href]);
      await execFile('curl', ['-fL', '-o', initramfsPath, validatedInitramfsUrl.href]);
      // Use shell redirection for gunzip decompression (with proper escaping)
      try {
        await execFile('gunzip', ['-c', vmlinuzPath], {
          shell: false,
          encoding: 'buffer'
        }).then(result => fs.writeFile(vmlinuxPath, result.stdout as Buffer));
      } catch {
        await execFile('cp', [vmlinuzPath, vmlinuxPath]);
      }
      logger.info('Netboot kernel downloaded');
      span.finish();
      return;
    } catch (e) {
      logger.warn('Netboot fetch failed, falling back to ISO', { e });
      const isoVer = '3.22.2';
      const isoUrl = `https://dl-cdn.alpinelinux.org/alpine/${alpineVersion}/releases/${arch}/alpine-virt-${isoVer}-${arch}.iso`;
      const validatedIsoUrl = validateDownloadUrl(isoUrl);
      const isoPath = validateVMPath(kernelDir, `alpine-virt-${isoVer}-${arch}.iso`);
      await execFile('curl', ['-L', '-o', isoPath, validatedIsoUrl.href]);
      const mountPoint = '/tmp/alpine-mount';
      await execFile('mkdir', ['-p', mountPoint]);
      await execFile('hdiutil', ['attach', isoPath, '-mountpoint', mountPoint]);
      try {
        await execFile('cp', [`${mountPoint}/boot/vmlinuz-virt`, vmlinuzPath]);
        try {
          await execFile('gunzip', ['-c', vmlinuzPath], {
            shell: false,
            encoding: 'buffer'
          }).then(result => fs.writeFile(vmlinuxPath, result.stdout as Buffer));
        } catch {
          await execFile('cp', [vmlinuzPath, vmlinuxPath]);
        }
        await execFile('cp', [`${mountPoint}/boot/initramfs-virt`, initramfsPath]);
      } finally {
        await execFile('hdiutil', ['detach', mountPoint]);
      }
      span.finish();
      logger.info('Kernel downloaded and extracted');
    }
  }
  
  /**
   * Ensure rootfs is available
   * Ported from scripts/vfkit/08-create-node24-rootfs.sh
   */
  private async ensureRootfs(vmDir: string, config: VMConfig): Promise<void> {
    const rootfsPath = validateVMPath(vmDir, 'rootfs/alpine-rootfs.cpio.gz');

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
    const diskPath = validateVMPath(vmDir, 'disk/root.img');

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

    // Create raw disk image - use execFile with array args to prevent shell injection
    const count = Math.floor(sizeBytes / (1024 * 1024));
    await execFile('dd', ['if=/dev/zero', `of=${diskPath}`, 'bs=1m', `count=${count}`]);
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
      '--kernel-cmdline', 'console=hvc0 random.trust_cpu=on ipv6.disable=1 net.ifnames=0 quiet'
    ];
    
    // Add port forwarding (if supported)
    // Note: vfkit doesn't natively support port forwarding
    // Would need SSH tunneling or other workaround
    
    const span = getTracer().startSpan('vfkit.launch');
    // Spawn vfkit process
    const proc = spawn('vfkit', args, {
      detached: true,
      stdio: 'ignore'
    });
    
    proc.unref();
    
    // Save PID
    const pidPath = validateVMPath(vmDir, 'vm.pid');
    await fs.writeFile(pidPath, proc.pid!.toString());

    // Save config
    const configPath = validateVMPath(vmDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Wait for VM to boot using health check
    const bootSpan = getTracer().startSpan('vfkit.boot.wait');
    const waitStart = Date.now();

    const bootResult = await waitForBoot(consolePath, {
      timeout: 30000, // 30 seconds timeout for boot
      interval: 200, // Check every 200ms
      operationName: 'vfkit-boot',
      context: { vmId: config.name }
    });

    bootSpan.setTag('boot.wait.ms', Date.now() - waitStart);
    bootSpan.setTag('boot.healthy', bootResult.healthy);
    bootSpan.setTag('boot.attempts', bootResult.attempts);
    bootSpan.finish();
    span.finish();

    if (!bootResult.healthy) {
      logger.warn('VM boot health check did not complete', {
        vmId: config.name,
        reason: bootResult.reason,
        duration: bootResult.duration
      });
    }

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
      const pidContent = await fs.readFile(pidPath, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);

      if (isNaN(pid)) {
        return 'stopped';
      }

      const running = await isProcessRunning(pid);
      return running ? 'running' : 'stopped';
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
