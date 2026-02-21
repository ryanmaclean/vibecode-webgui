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
      logger.info(
        'vfkit not found in PATH. Install vfkit to use Apple Virtualization Framework:\n' +
        '  brew install vfkit\n' +
        'For more information: https://github.com/crc-org/vfkit'
      );
      return false;
    }
  }

  /**
   * Perform pre-flight checks before VM creation
   * Validates system requirements and available resources
   */
  private async performPreflightChecks(config: VMConfig): Promise<void> {
    // 1. Check if vfkit binary exists
    const vfkitAvailable = await this.detect();
    if (!vfkitAvailable) {
      throw new Error(
        'vfkit is not installed or not in PATH. Please install vfkit to use Apple Virtualization Framework:\n' +
        '  brew install vfkit\n\n' +
        'For more information and manual installation instructions, see:\n' +
        '  https://github.com/crc-org/vfkit#installation'
      );
    }

    // 2. Check if running on macOS (Virtualization.framework requirement)
    if (os.platform() !== 'darwin') {
      throw new Error(
        `Apple Virtualization.framework is only available on macOS. ` +
        `Current platform: ${os.platform()}. ` +
        `For ${os.platform()}, please use Lima or QEMU instead:\n` +
        '  brew install lima    # Cross-platform VM manager\n' +
        '  brew install qemu    # Generic virtualization'
      );
    }

    // 3. Check macOS version (requires macOS 11.0+)
    try {
      const { stdout } = await exec('sw_vers -productVersion');
      const version = stdout.trim();
      const majorVersion = parseInt(version.split('.')[0]);

      if (majorVersion < 11) {
        throw new Error(
          `Apple Virtualization.framework requires macOS 11.0 (Big Sur) or later. ` +
          `Current version: ${version}. ` +
          `Please upgrade macOS or use an alternative VM provider like Lima:\n` +
          '  brew install lima'
        );
      }
    } catch (error) {
      // If we can't check the version, log warning but continue
      if (error instanceof Error && error.message.includes('Virtualization.framework')) {
        throw error; // Re-throw our own errors
      }
      logger.warn('Unable to verify macOS version, continuing with VM creation', { error });
    }

    // 4. Check if VM with same name already exists
    const safeName = validateVMName(config.name);
    const vmDir = path.join(this.vmBaseDir, safeName);
    try {
      await fs.access(vmDir);
      // If we get here, the directory exists
      throw new Error(
        `VM "${config.name}" already exists at ${vmDir}. ` +
        `Please choose a different name or delete the existing VM first:\n` +
        `  rm -rf "${vmDir}"`
      );
    } catch (error) {
      if ((error as any)?.code !== 'ENOENT') {
        // ENOENT is good - means directory doesn't exist
        // Any other error should be re-thrown
        throw error;
      }
      // Directory doesn't exist, which is what we want
    }

    // 5. Check available disk space (requires at least config.disk + 1GB buffer)
    if (config.disk) {
      try {
        const requiredBytes = this.parseSizeToBytes(config.disk) + (1024 * 1024 * 1024); // +1GB buffer

        // Check available space in vmBaseDir
        // First ensure the base directory exists
        await fs.mkdir(this.vmBaseDir, { recursive: true });

        // Use statfs to check available space
        // Note: Node.js doesn't have built-in statfs, so we'll use df command
        const { stdout } = await exec(`df -k "${this.vmBaseDir}" | tail -1 | awk '{print $4}'`);
        const availableKB = parseInt(stdout.trim());
        const availableBytes = availableKB * 1024;

        if (availableBytes < requiredBytes) {
          const requiredGB = (requiredBytes / (1024 * 1024 * 1024)).toFixed(2);
          const availableGB = (availableBytes / (1024 * 1024 * 1024)).toFixed(2);
          throw new Error(
            `Insufficient disk space. Required: ${requiredGB}GB (${config.disk} + 1GB buffer), ` +
            `Available: ${availableGB}GB. ` +
            `Please free up disk space or use a smaller disk size for the VM.`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Insufficient disk space')) {
          throw error;
        }
        // Log warning but continue if we can't check disk space
        logger.warn('Unable to verify available disk space, continuing with VM creation', { error });
      }
    }

    logger.info('Pre-flight checks passed', { vmName: config.name });
  }

  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating vfkit VM', { name: config.name });
    const span = getTracer().startSpan('vfkit.create');
    span.setTag('vm.name', config.name);

    try {
      // Pre-flight checks before any VM creation steps
      await this.performPreflightChecks(config);

      const safeName = validateVMName(config.name);
      const vmDir = validateVMPath(this.vmBaseDir, safeName);

      // Create directory structure
      const sDirs = getTracer().startSpan('vfkit.create.directories');
      try {
        await this.createDirectories(vmDir);
      } catch (error) {
        sDirs.finish();
        throw error;
      }
      sDirs.finish();

      // Download/ensure Alpine kernel
      const sKernel = getTracer().startSpan('vfkit.create.ensureKernel');
      try {
        await this.ensureKernel(vmDir, config);
      } catch (error) {
        sKernel.finish();
        throw error;
      }
      sKernel.finish();

      // Create rootfs
      const sRootfs = getTracer().startSpan('vfkit.create.ensureRootfs');
      try {
        await this.ensureRootfs(vmDir, config);
      } catch (error) {
        sRootfs.finish();
        throw error;
      }
      sRootfs.finish();

      // Create disk image
      const sDisk = getTracer().startSpan('vfkit.create.createDisk');
      try {
        await this.createDisk(vmDir, config.disk);
      } catch (error) {
        sDisk.finish();
        throw error;
      }
      sDisk.finish();

      // Launch VM
      const sLaunch = getTracer().startSpan('vfkit.create.launch');
      try {
        const vm = await this.launch(vmDir, config);
        sLaunch.finish();
        span.finish();
        return vm;
      } catch (e) {
        sLaunch.finish();
        throw e;
      }
    } catch (error) {
      span.finish();
      // Provide helpful context about VM creation failures
      if (error instanceof Error && error.message.includes('VM name')) {
        // Re-throw validation errors as-is (already user-friendly)
        throw error;
      }
      throw new Error(
        `Failed to create VM "${config.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      span.finish();
    }
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting vfkit VM', { vmId });

    const vmDir = path.join(this.vmBaseDir, vmId);

    // Read config from VM directory
    const configPath = path.join(vmDir, 'config.json');
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config: VMConfig = JSON.parse(configData);
      await this.launch(vmDir, config);
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" not found: config file does not exist at ${configPath}. ` +
          `Use 'list' to see available VMs or 'create' to create a new one.`
        );
      }
      if (error instanceof SyntaxError) {
        throw new Error(
          `VM "${vmId}" configuration is corrupted: ${configPath} contains invalid JSON. ` +
          `You may need to recreate this VM.`
        );
      }
      throw new Error(`Failed to start VM "${vmId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping vfkit VM', { vmId });

    const pidPath = path.join(this.vmBaseDir, vmId, 'vm.pid');

    try {
      const pid = await fs.readFile(pidPath, 'utf-8');
      const pidNum = parseInt(pid.trim());

      if (isNaN(pidNum)) {
        throw new Error(
          `VM "${vmId}" has invalid PID file: "${pid}" is not a valid process ID. ` +
          `The VM may need to be cleaned up manually.`
        );
      }

      process.kill(pidNum, 'SIGTERM');

      // Wait for process to stop
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove PID file
      await fs.unlink(pidPath);
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" is not running: PID file not found at ${pidPath}. ` +
          `The VM may already be stopped or was not started properly.`
        );
      }
      if ((error as any)?.code === 'ESRCH') {
        // Process doesn't exist, clean up PID file
        try {
          await fs.unlink(pidPath);
        } catch {
          // Ignore cleanup errors
        }
        throw new Error(
          `VM "${vmId}" process is not running (stale PID file). ` +
          `The PID file has been cleaned up. You can safely start the VM again.`
        );
      }
      if ((error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when stopping VM "${vmId}". ` +
          `The VM process may be owned by another user. ` +
          `If you created the VM, grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      logger.error('Failed to stop VM', { vmId, error });
      throw new Error(`Failed to stop VM "${vmId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying vfkit VM', { vmId });

    // Stop VM if running
    try {
      await this.stop(vmId);
    } catch (error) {
      // VM might not be running - log but continue with destruction
      logger.debug('VM stop failed during destroy (may not be running)', { vmId, error });
    }

    // Remove VM directory
    const vmDir = path.join(this.vmBaseDir, vmId);
    try {
      await fs.rm(vmDir, { recursive: true, force: true });
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" does not exist: directory not found at ${vmDir}. ` +
          `Use 'list' to see available VMs.`
        );
      }
      if ((error as any)?.code === 'EPERM' || (error as any)?.code === 'EACCES') {
        throw new Error(
          `Permission denied when deleting VM "${vmId}" at ${vmDir}. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access, ` +
          `or ensure you have write permissions to the VM directory. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      throw new Error(
        `Failed to delete VM "${vmId}" directory at ${vmDir}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
            // Skip invalid VM directories (missing or corrupted config.json)
            logger.debug(`Skipping invalid VM directory: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        // VM base directory doesn't exist yet - return empty list
        return vms;
      }
      if ((error as any)?.code === 'EACCES' || (error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when listing VMs at ${this.vmBaseDir}. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      logger.error('Failed to list VMs', { error });
      throw new Error(
        `Failed to list VMs in ${this.vmBaseDir}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return vms;
  }
  
  async exec(vmId: string, command: string): Promise<ExecResult> {
    const startTime = Date.now();

    logger.info('Executing command in VM', { vmId, command });

    // Verify VM exists and is running
    const status = await this.getVMStatus(vmId);
    if (status !== 'running') {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `VM "${vmId}" is not running (status: ${status}). Start the VM first with 'start' command.`,
        duration: Date.now() - startTime
      };
    }

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
      const errorCode = (error as any)?.code;
      const stderr = (error as any)?.stderr || (error instanceof Error ? error.message : 'Unknown error');

      // Provide user-friendly error messages for common issues
      let userFriendlyError = stderr;
      if (errorCode === 'ENOENT') {
        userFriendlyError = `Command not found: "${command}". Ensure the command exists in the VM's PATH.`;
      } else if (errorCode === 'EACCES' || errorCode === 'EPERM') {
        userFriendlyError = `Permission denied when executing "${command}" in VM "${vmId}". ` +
          `The command may require elevated privileges or Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`;
      }

      return {
        exitCode: errorCode || 1,
        stdout: (error as any)?.stdout || '',
        stderr: userFriendlyError,
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
    try {
      await fs.mkdir(validateVMPath(vmDir, 'kernel'), { recursive: true });
      await fs.mkdir(validateVMPath(vmDir, 'rootfs'), { recursive: true });
      await fs.mkdir(validateVMPath(vmDir, 'disk'), { recursive: true });
      await fs.mkdir(validateVMPath(vmDir, 'logs'), { recursive: true });
    } catch (error) {
      if ((error as any)?.code === 'EACCES' || (error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when creating VM directories at ${vmDir}. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access, ` +
          `or ensure you have write permissions to ${this.vmBaseDir}. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      if ((error as any)?.code === 'ENOSPC') {
        throw new Error(
          `Insufficient disk space to create VM directories at ${vmDir}. ` +
          `Free up disk space and try again. VM requires at least 1GB of free space.`
        );
      }
      throw new Error(
        `Failed to create VM directory structure at ${vmDir}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
      try {
        await execFile('curl', ['-fL', '-o', vmlinuzPath, validatedVmlinuzUrl.href]);
      } catch (error) {
        throw new Error(
          `Failed to download kernel from ${validatedVmlinuzUrl.href}: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Check your internet connection and verify the Alpine CDN is accessible.`
        );
      }

      try {
        await execFile('curl', ['-fL', '-o', initramfsPath, validatedInitramfsUrl.href]);
      } catch (error) {
        throw new Error(
          `Failed to download initramfs from ${validatedInitramfsUrl.href}: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Check your internet connection and verify the Alpine CDN is accessible.`
        );
      }

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

      try {
        await execFile('curl', ['-L', '-o', isoPath, validatedIsoUrl.href]);
      } catch (error) {
        throw new Error(
          `Failed to download Alpine ISO from ${validatedIsoUrl.href} after netboot failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Check your internet connection and verify the Alpine CDN is accessible. ` +
          `Original netboot error: ${e instanceof Error ? e.message : 'Unknown'}`
        );
      }

      const mountPoint = '/tmp/alpine-mount';
      await execFile('mkdir', ['-p', mountPoint]);

      try {
        await execFile('hdiutil', ['attach', isoPath, '-mountpoint', mountPoint]);
      } catch (error) {
        const errorCode = (error as any)?.code;
        if (errorCode === 'ENOENT') {
          throw new Error(
            `hdiutil command not found. This is a macOS system utility that should be available by default. ` +
            `Ensure you're running on macOS and the system binaries are not corrupted.`
          );
        }
        if (errorCode === 'EACCES' || errorCode === 'EPERM') {
          throw new Error(
            `Permission denied when mounting Alpine ISO at ${isoPath}. ` +
            `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
            `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
          );
        }
        throw new Error(
          `Failed to mount Alpine ISO at ${isoPath}: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Ensure hdiutil is available and you have permissions to mount disk images.`
        );
      }

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
      } catch (error) {
        throw new Error(
          `Failed to extract kernel from mounted ISO: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `The ISO may be corrupted or incompatible.`
        );
      } finally {
        try {
          await execFile('hdiutil', ['detach', mountPoint]);
        } catch (detachError) {
          logger.warn('Failed to detach ISO mount', { detachError });
        }
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

    throw new Error(
      `Rootfs creation is not yet implemented. Expected rootfs at ${rootfsPath}. ` +
      `Please provide a pre-built Alpine rootfs with Node.js 24, or run the existing bash scripts ` +
      `from scripts/vfkit/08-create-node24-rootfs.sh to create one.`
    );
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

    try {
      await execFile('dd', ['if=/dev/zero', `of=${diskPath}`, 'bs=1m', `count=${count}`]);
    } catch (error) {
      const errorCode = (error as any)?.code;
      if (errorCode === 'ENOSPC') {
        throw new Error(
          `Insufficient disk space to create ${size} disk image at ${diskPath}. ` +
          `Free up at least ${size} of disk space and try again.`
        );
      }
      if (errorCode === 'EACCES' || errorCode === 'EPERM') {
        throw new Error(
          `Permission denied when creating disk image at ${diskPath}. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      throw new Error(
        `Failed to create disk image at ${diskPath}: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Ensure you have sufficient disk space for ${size} and write permissions in the VM directory.`
      );
    }
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
    let proc;
    try {
      proc = spawn('vfkit', args, {
        detached: true,
        stdio: 'ignore'
      });

      // Handle spawn errors
      proc.on('error', (error) => {
        const errorCode = (error as any)?.code;
        if (errorCode === 'ENOENT') {
          throw new Error(
            `vfkit not found in PATH. Install vfkit to use Apple Virtualization Framework:\n` +
            `  brew install vfkit\n` +
            `For more information: https://github.com/crc-org/vfkit`
          );
        }
        if (errorCode === 'EACCES' || errorCode === 'EPERM') {
          throw new Error(
            `Permission denied when launching vfkit for VM "${config.name}". ` +
            `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
            `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
          );
        }
        throw new Error(
          `Failed to spawn vfkit process: ${error.message}. ` +
          `Ensure vfkit is installed and available in your PATH. ` +
          `Install with: brew install vfkit\n` +
          `For more information: https://github.com/crc-org/vfkit`
        );
      });
    } catch (error) {
      const errorCode = (error as any)?.code;
      if (errorCode === 'ENOENT') {
        throw new Error(
          `vfkit not found in PATH. Install vfkit to use Apple Virtualization Framework:\n` +
          `  brew install vfkit\n` +
          `For more information: https://github.com/crc-org/vfkit`
        );
      }
      if (errorCode === 'EACCES' || errorCode === 'EPERM') {
        throw new Error(
          `Permission denied when launching vfkit for VM "${config.name}". ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      throw new Error(
        `Failed to launch VM "${config.name}": ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        `Ensure vfkit is installed and available in your PATH. ` +
        `Install with: brew install vfkit\n` +
        `For more information: https://github.com/crc-org/vfkit`
      );
    }

    if (!proc.pid) {
      throw new Error(
        `Failed to launch VM "${config.name}": vfkit process did not start. ` +
        `Check that vfkit is properly installed and the kernel/disk files exist.`
      );
    }

    proc.unref();

    // Save PID
    const pidPath = validateVMPath(vmDir, 'vm.pid');
    await fs.writeFile(pidPath, proc.pid.toString());

    // Save config
    const configPath = validateVMPath(vmDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    const bootSpan = getTracer().startSpan('vfkit.boot.wait');
    const waitStart = Date.now();

    // Wait for VM to be ready with 30-second timeout
    await this.waitForVMReady(config.name);

    bootSpan.setTag('boot.wait.ms', Date.now() - waitStart);
    bootSpan.finish();
    span.finish();
    
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
   * Wait for VM to be ready
   */
  private async waitForVMReady(vmId: string, maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await this.getVMStatus(vmId);
        if (status === 'running') {
          logger.info('VM is ready', { vmId });
          return;
        }
      } catch {
        // Keep waiting
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const vmDir = path.join(this.vmBaseDir, vmId);
    const logPath = path.join(vmDir, 'logs/console.log');
    throw new Error(
      `VM "${vmId}" failed to start within ${maxWaitMs / 1000} seconds. ` +
      `Check the console log at ${logPath} for details, or try increasing memory/CPU allocation.`
    );
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
      throw new Error(
        `Invalid size format "${size}": expected format is a number followed by GB, MB, or KB ` +
        `(e.g., "2GB", "512MB", "1024KB"). If no unit is specified, MB is assumed.`
      );
    }

    const value = parseInt(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    if (value <= 0) {
      throw new Error(`Invalid size "${size}": size must be greater than 0`);
    }

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
