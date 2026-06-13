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
import { isProcessRunning, waitForBoot, checkProcessHealth, HealthCheckResult } from '../utils/health-check';
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
  private initialized: boolean = false;

  constructor() {
    this.vmBaseDir = path.join(os.homedir(), '.vfkit/vms');
  }

  /**
   * Initialize the provider and restore VMs from previous session
   * Scans VM directories, validates PIDs, and cleans up stale state
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing vfkit provider, restoring VM state');

    try {
      // Ensure base directory exists
      await fs.mkdir(this.vmBaseDir, { recursive: true });

      // Scan for existing VMs and validate their state
      const entries = await fs.readdir(this.vmBaseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.validateVMState(entry.name);
        }
      }

      this.initialized = true;
      logger.info('vfkit provider initialized');
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        // VM base directory doesn't exist yet - this is fine for first run
        this.initialized = true;
        return;
      }

      // Handle permission errors with user-friendly messages
      if ((error as any)?.code === 'EACCES' || (error as any)?.code === 'EPERM') {
        logger.error('Failed to initialize vfkit provider - permission denied', { error });
        throw new Error(
          `Failed to initialize vfkit provider due to permission denied. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }

      logger.error('Failed to initialize vfkit provider', { error });
      throw new Error(
        `Failed to initialize vfkit provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate and restore VM state from disk
   * Checks if VM process is still running and cleans up stale PID files
   */
  private async validateVMState(vmId: string): Promise<void> {
    const vmDir = path.join(this.vmBaseDir, vmId);
    const pidPath = path.join(vmDir, 'vm.pid');

    try {
      // Check if PID file exists
      const pidData = await fs.readFile(pidPath, 'utf-8');
      const pid = parseInt(pidData.trim());

      if (isNaN(pid)) {
        logger.warn('Invalid PID file, cleaning up', { vmId, pid: pidData });
        await fs.unlink(pidPath);
        return;
      }

      // Check if process is still running
      try {
        process.kill(pid, 0); // Signal 0 checks if process exists without killing it
        logger.debug('VM process still running', { vmId, pid });
      } catch {
        // Process doesn't exist - clean up stale PID file
        logger.info('Cleaning up stale PID file', { vmId, pid });
        await fs.unlink(pidPath);
      }
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        // No PID file - VM is stopped, this is expected
        logger.debug('VM has no PID file (stopped)', { vmId });
        return;
      }
      // Other errors - log but continue
      logger.warn('Error validating VM state', { vmId, error });
    }
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
   * Ensure provider is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
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
    // Ensure provider is initialized
    await this.ensureInitialized();

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
          context: { vmId: config.name, vmDir },
          shouldRetry: (err: Error) => !err.message.includes('boot timeout')
        }
      );
      sLaunch.finish();
      return vm;
    } catch (error: unknown) {
      sLaunch.finish();
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

    // Validate VM is running after start
    const stateValidation = await this.validateVMState(vmId, 'running', 'start');
    if (!stateValidation.healthy) {
      logger.error('VM state validation failed after start', {
        vmId,
        validation: stateValidation
      });
      throw new Error(
        `VM state validation failed after start: ${stateValidation.reason}. ` +
        `Expected: running, Duration: ${stateValidation.duration}ms`
      );
    }

    logger.info('VM started and validated successfully', {
      vmId,
      validation: stateValidation
    });
  }
  
  /**
   * Clean up VM state files (PID file, socket files, etc.)
   * Handles locked/busy files gracefully
   */
  private async cleanupVMState(vmId: string): Promise<void> {
    const vmDir = path.join(this.vmBaseDir, vmId);
    const pidPath = path.join(vmDir, 'vm.pid');

    // Clean up PID file
    try {
      await fs.unlink(pidPath);
      logger.debug('Cleaned up PID file', { vmId });
    } catch (error) {
      const code = (error as any)?.code;

      if (code === 'ENOENT') {
        // File already removed - this is fine
        logger.debug('PID file already removed', { vmId });
      } else if (code === 'EBUSY' || code === 'ETXTBSY') {
        // File is locked/busy - retry once after a delay
        logger.warn('State file is busy, retrying cleanup', { vmId });
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await fs.unlink(pidPath);
        } catch (retryError) {
          // If still locked, log warning but don't fail
          logger.warn('Unable to remove PID file (file is busy)', {
            vmId,
            error: retryError,
            message: 'File may be in use by another process. It will be cleaned up on next initialization.'
          });
        }
      } else if (code === 'EPERM' || code === 'EACCES') {
        throw new Error(
          `Permission denied when cleaning up VM "${vmId}" state files. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      } else {
        // Unexpected error - log but don't fail the operation
        logger.warn('Error removing PID file during cleanup', { vmId, error });
      }
    }

    // Clean up any additional state files (socket files, lock files, etc.)
    try {
      const entries = await fs.readdir(vmDir);
      const stateFiles = entries.filter(name =>
        name.endsWith('.sock') ||
        name.endsWith('.lock') ||
        name === 'state.json'
      );

      for (const file of stateFiles) {
        try {
          const filePath = path.join(vmDir, file);
          await fs.unlink(filePath);
          logger.debug('Cleaned up state file', { vmId, file });
        } catch (error) {
          const code = (error as any)?.code;
          if (code !== 'ENOENT') {
            logger.warn('Error removing state file', { vmId, file, error });
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible - log but continue
      logger.debug('Unable to scan for additional state files', { vmId, error });
    }
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

            // Validate VM is stopped
            const stateValidation = await this.validateVMState(vmId, 'stopped', 'stop-acpi');
            if (!stateValidation.healthy) {
              logger.warn('VM state validation failed after ACPI stop', {
                vmId,
                validation: stateValidation
              });
            }
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

          // Validate VM is stopped after SIGTERM
          const stateValidation = await this.validateVMState(vmId, 'stopped', 'stop-sigterm');
          if (!stateValidation.healthy) {
            logger.error('VM state validation failed after SIGTERM stop', {
              vmId,
              validation: stateValidation
            });
            throw new Error(
              `VM state validation failed after stop: ${stateValidation.reason}. ` +
              `Expected: stopped, Duration: ${stateValidation.duration}ms`
            );
          }

          logger.info('VM stopped and validated successfully', {
            vmId,
            validation: stateValidation
          });
          return;
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        } else {
          logger.error('Failed to stop VM gracefully, forcing', { vmId, pid });
          process.kill(pid, 'SIGKILL');
          await fs.unlink(pidPath);

          // Validate VM is stopped after SIGKILL
          const stateValidation = await this.validateVMState(vmId, 'stopped', 'stop-sigkill');
          if (!stateValidation.healthy) {
            logger.error('VM state validation failed after SIGKILL', {
              vmId,
              validation: stateValidation
            });
          }
          throw new Error(`VM ${vmId} failed to stop gracefully, forced kill`);
        }
      }
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" is not running: PID file not found at ${pidPath}. ` +
          `The VM may already be stopped or was not started properly.`
        );
      }
      if ((error as any)?.code === 'ESRCH') {
        // Process doesn't exist, clean up state files
        try {
          await this.cleanupVMState(vmId);
        } catch (cleanupError) {
          logger.warn('Error during state cleanup', { vmId, error: cleanupError });
        }
        throw new Error(
          `VM "${vmId}" process is not running (stale PID file). ` +
          `The state files have been cleaned up. You can safely start the VM again.`
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

    // Stop VM if running (this also cleans up state files)
    try {
      await this.stop(vmId);
    } catch (error) {
      // VM might not be running - log but continue with destruction
      logger.debug('VM stop failed during destroy (may not be running)', { vmId, error });

      // Still attempt to clean up state files even if stop failed
      try {
        await this.cleanupVMState(vmId);
      } catch (cleanupError) {
        logger.debug('State cleanup failed during destroy (files may not exist)', { vmId, error: cleanupError });
      }
    }

    // Remove VM directory including all state files
    const vmDir = path.join(this.vmBaseDir, vmId);
    try {
      await fs.rm(vmDir, { recursive: true, force: true });
      logger.info('VM directory removed', { vmId, path: vmDir });
    } catch (error) {
      const code = (error as any)?.code;

      if (code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" does not exist: directory not found at ${vmDir}. ` +
          `Use 'list' to see available VMs.`
        );
      }
      if (code === 'EPERM' || code === 'EACCES') {
        throw new Error(
          `Permission denied when deleting VM "${vmId}" at ${vmDir}. ` +
          `Grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access, ` +
          `or ensure you have write permissions to the VM directory. ` +
          `More info: https://support.apple.com/guide/mac-help/allow-access-to-system-folders-mh15217/mac`
        );
      }
      if (code === 'EBUSY' || code === 'ETXTBSY') {
        throw new Error(
          `VM "${vmId}" directory is in use and cannot be deleted. ` +
          `Some files may be locked by another process. ` +
          `Please ensure the VM is fully stopped and no other applications are accessing the VM files. ` +
          `You may need to restart your computer to release locked files.`
        );
      }
      if (code === 'ENOTEMPTY') {
        // Directory not empty - retry with more aggressive cleanup
        logger.warn('Directory not empty, retrying with force', { vmId });
        try {
          // Try again with maxRetries
          await fs.rm(vmDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
        } catch (retryError) {
          throw new Error(
            `VM "${vmId}" directory could not be fully deleted (some files remain). ` +
            `Path: ${vmDir}. ` +
            `You may need to manually delete the directory or restart your computer.`
          );
        }
      }
      throw new Error(
        `Failed to delete VM "${vmId}" directory at ${vmDir}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async list(): Promise<VM[]> {
    // Ensure provider is initialized to restore VM state
    await this.ensureInitialized();

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
   * Pause the VM by sending SIGSTOP to the vfkit process
   */
  async pause(vmId: string): Promise<void> {
    logger.info('Pausing vfkit VM', { vmId });

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

      // Send SIGSTOP to pause the VM process
      process.kill(pidNum, 'SIGSTOP');
      logger.info('VM paused successfully', { vmId, pid: pidNum });
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" is not running: PID file not found at ${pidPath}. ` +
          `The VM may already be stopped or was not started properly.`
        );
      }
      if ((error as any)?.code === 'ESRCH') {
        throw new Error(
          `VM "${vmId}" process is not running (stale PID file). ` +
          `The VM may have been stopped externally.`
        );
      }
      if ((error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when pausing VM "${vmId}". ` +
          `The VM process may be owned by another user.`
        );
      }
      logger.error('Failed to pause VM', { vmId, error });
      throw new Error(`Failed to pause VM "${vmId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resume the VM by sending SIGCONT to the vfkit process
   */
  async resume(vmId: string): Promise<void> {
    logger.info('Resuming vfkit VM', { vmId });

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

      // Send SIGCONT to resume the VM process
      process.kill(pidNum, 'SIGCONT');
      logger.info('VM resumed successfully', { vmId, pid: pidNum });
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        throw new Error(
          `VM "${vmId}" is not running: PID file not found at ${pidPath}. ` +
          `The VM may already be stopped or was not started properly.`
        );
      }
      if ((error as any)?.code === 'ESRCH') {
        throw new Error(
          `VM "${vmId}" process is not running (stale PID file). ` +
          `The VM may have been stopped externally.`
        );
      }
      if ((error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when resuming VM "${vmId}". ` +
          `The VM process may be owned by another user.`
        );
      }
      logger.error('Failed to resume VM', { vmId, error });
      throw new Error(`Failed to resume VM "${vmId}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save VM state to a specified path
   * Saves disk image and VM configuration for later restoration
   */
  async saveState(vmId: string, statePath: string): Promise<boolean> {
    logger.info('Saving VM state', { vmId, statePath });

    const vmDir = validateVMPath(this.vmBaseDir, vmId);
    const validatedStatePath = validateVMPath(path.dirname(statePath), path.basename(statePath));

    try {
      // Verify VM exists
      try {
        await fs.access(vmDir);
      } catch {
        throw new Error(`VM "${vmId}" not found at ${vmDir}`);
      }

      // Create state directory
      await fs.mkdir(validatedStatePath, { recursive: true });

      // Save disk image
      const diskPath = validateVMPath(vmDir, 'disk/root.img');
      const stateDiskPath = validateVMPath(validatedStatePath, 'root.img');

      try {
        await fs.access(diskPath);
        logger.debug('Copying disk image', { from: diskPath, to: stateDiskPath });
        await fs.copyFile(diskPath, stateDiskPath);
      } catch (error) {
        if ((error as any)?.code === 'ENOENT') {
          logger.warn('Disk image not found, skipping', { diskPath });
        } else {
          throw error;
        }
      }

      // Save VM configuration
      const configPath = validateVMPath(vmDir, 'config.json');
      const stateConfigPath = validateVMPath(validatedStatePath, 'config.json');

      try {
        await fs.access(configPath);
        logger.debug('Copying configuration', { from: configPath, to: stateConfigPath });
        await fs.copyFile(configPath, stateConfigPath);
      } catch (error) {
        if ((error as any)?.code === 'ENOENT') {
          logger.warn('Configuration not found, skipping', { configPath });
        } else {
          throw error;
        }
      }

      // Save state metadata
      const metadata = {
        vmId,
        savedAt: new Date().toISOString(),
        provider: 'vfkit',
      };
      const metadataPath = validateVMPath(validatedStatePath, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('VM state saved successfully', { vmId, statePath });
      return true;
    } catch (error) {
      logger.error('Failed to save VM state', { vmId, statePath, error });

      if ((error as any)?.code === 'ENOSPC') {
        throw new Error(
          `Insufficient disk space to save VM state at ${statePath}. ` +
          `Free up disk space and try again.`
        );
      }
      if ((error as any)?.code === 'EACCES' || (error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when saving VM state to ${statePath}. ` +
          `Ensure you have write permissions to the target directory.`
        );
      }

      throw new Error(`Failed to save VM state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore VM state from a specified path
   * Restores disk image and VM configuration from a previous save
   */
  async restoreState(vmId: string, statePath: string): Promise<boolean> {
    logger.info('Restoring VM state', { vmId, statePath });

    const vmDir = path.join(this.vmBaseDir, vmId);

    try {
      // Verify state directory exists
      try {
        await fs.access(statePath);
      } catch {
        throw new Error(`State path not found: ${statePath}`);
      }

      // Verify VM directory exists
      try {
        await fs.access(vmDir);
      } catch {
        throw new Error(`VM "${vmId}" not found at ${vmDir}`);
      }

      // Verify VM is stopped before restoring
      const status = await this.getVMStatus(vmId);
      if (status === 'running') {
        throw new Error(
          `VM "${vmId}" must be stopped before restoring state. ` +
          `Stop the VM first with the stop command.`
        );
      }

      // Restore disk image
      const stateDiskPath = path.join(statePath, 'root.img');
      const diskPath = path.join(vmDir, 'disk/root.img');

      try {
        await fs.access(stateDiskPath);
        logger.debug('Restoring disk image', { from: stateDiskPath, to: diskPath });
        await fs.copyFile(stateDiskPath, diskPath);
      } catch (error) {
        if ((error as any)?.code === 'ENOENT') {
          logger.warn('Disk image not found in state, skipping', { stateDiskPath });
        } else {
          throw error;
        }
      }

      // Restore VM configuration
      const stateConfigPath = path.join(statePath, 'config.json');
      const configPath = path.join(vmDir, 'config.json');

      try {
        await fs.access(stateConfigPath);
        logger.debug('Restoring configuration', { from: stateConfigPath, to: configPath });
        await fs.copyFile(stateConfigPath, configPath);
      } catch (error) {
        if ((error as any)?.code === 'ENOENT') {
          logger.warn('Configuration not found in state, skipping', { stateConfigPath });
        } else {
          throw error;
        }
      }

      logger.info('VM state restored successfully', { vmId, statePath });
      return true;
    } catch (error) {
      logger.error('Failed to restore VM state', { vmId, statePath, error });

      if ((error as any)?.code === 'ENOSPC') {
        throw new Error(
          `Insufficient disk space to restore VM state to ${vmDir}. ` +
          `Free up disk space and try again.`
        );
      }
      if ((error as any)?.code === 'EACCES' || (error as any)?.code === 'EPERM') {
        throw new Error(
          `Permission denied when restoring VM state to ${vmDir}. ` +
          `Ensure you have write permissions to the VM directory.`
        );
      }

      throw new Error(`Failed to restore VM state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get VM configuration
   */
  async getConfig(vmId: string): Promise<VMConfig | null> {
    const configPath = path.join(this.vmBaseDir, vmId, 'config.json');

    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config: VMConfig = JSON.parse(configData);
      return config;
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        logger.debug('VM config not found', { vmId, configPath });
        return null;
      }
      logger.error('Failed to read VM config', { vmId, error });
      return null;
    }
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

      const mountPoint = await fs.mkdtemp(path.join(os.tmpdir(), 'alpine-mount-'));


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

    // Wait for VM to boot using health check
    const bootSpan = getTracer().startSpan('vfkit.boot.wait');
    const waitStart = Date.now();

    const bootResult = await waitForBoot(consolePath, {
      timeout: 30000, // 30 seconds timeout for boot
      interval: 200, // Check every 200ms
      maxAttempts: 10000, // Let timeout control termination, not attempt count
      operationName: 'vfkit-boot',
      context: { vmId: config.name }
    });

    bootSpan.setTag('boot.wait.ms', Date.now() - waitStart);
    bootSpan.setTag('boot.healthy', bootResult.healthy);
    bootSpan.setTag('boot.attempts', bootResult.attempts);
    bootSpan.finish();
    span.finish();

    if (!bootResult.healthy) {
      logger.error('VM boot health check failed', {
        vmId: config.name,
        reason: bootResult.reason,
        duration: bootResult.duration
      });
      const logPath = path.join(vmDir, 'logs/console.log');
      throw new Error(
        `VM "${config.name}" boot timeout: failed to start within 30 seconds (${bootResult.reason}). ` +
        `Check the console log at ${logPath} for details, or try increasing memory/CPU allocation.`
      );
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
   * Validate VM state matches expected state
   *
   * @param vmId - VM identifier
   * @param expectedState - Expected VM state ('running' or 'stopped')
   * @param operationName - Name of operation for logging
   * @returns Promise resolving to HealthCheckResult
   *
   * @example
   * ```typescript
   * const result = await this.validateVMState('my-vm', 'running', 'start');
   * if (!result.healthy) {
   *   logger.error('VM state validation failed', { result });
   * }
   * ```
   */
  private async validateVMState(
    vmId: string,
    expectedState: VMStatus,
    operationName: string
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const vmDir = path.join(this.vmBaseDir, vmId);
    const pidPath = path.join(vmDir, 'vm.pid');

    try {
      // Check if VM directory exists
      try {
        await fs.access(vmDir);
      } catch {
        return {
          healthy: false,
          reason: 'VM directory does not exist',
          attempts: 1,
          duration: Date.now() - startTime,
          details: { vmId, vmDir, expectedState, operationName }
        };
      }

      // Check if config file exists
      const configPath = path.join(vmDir, 'config.json');
      try {
        await fs.access(configPath);
      } catch {
        return {
          healthy: false,
          reason: 'VM config file not found',
          attempts: 1,
          duration: Date.now() - startTime,
          details: { vmId, configPath, expectedState, operationName }
        };
      }

      // Validate state based on expected state
      if (expectedState === 'running') {
        // For running state, check process health
        const processHealth = await checkProcessHealth(pidPath);

        if (!processHealth.healthy) {
          return {
            healthy: false,
            reason: `VM expected to be running but ${processHealth.reason}`,
            attempts: processHealth.attempts,
            duration: Date.now() - startTime,
            details: {
              vmId,
              expectedState,
              processHealth,
              operationName
            }
          };
        }

        logger.info('VM state validation passed', {
          vmId,
          expectedState,
          actualState: 'running',
          operationName,
          duration: Date.now() - startTime
        });

        return {
          healthy: true,
          reason: 'VM is running as expected',
          attempts: processHealth.attempts,
          duration: Date.now() - startTime,
          details: { vmId, expectedState, operationName, pid: processHealth.details?.pid }
        };

      } else if (expectedState === 'stopped') {
        // For stopped state, verify PID file doesn't exist or process is not running
        try {
          const pidContent = await fs.readFile(pidPath, 'utf-8');
          const pid = parseInt(pidContent.trim(), 10);

          if (!isNaN(pid)) {
            const running = await isProcessRunning(pid);

            if (running) {
              return {
                healthy: false,
                reason: 'VM expected to be stopped but process is still running',
                attempts: 1,
                duration: Date.now() - startTime,
                details: { vmId, expectedState, pid, operationName }
              };
            }
          }
        } catch {
          // PID file not found or unreadable - this is expected for stopped state
        }

        logger.info('VM state validation passed', {
          vmId,
          expectedState,
          actualState: 'stopped',
          operationName,
          duration: Date.now() - startTime
        });

        return {
          healthy: true,
          reason: 'VM is stopped as expected',
          attempts: 1,
          duration: Date.now() - startTime,
          details: { vmId, expectedState, operationName }
        };
      } else {
        return {
          healthy: false,
          reason: `Unknown expected state: ${expectedState}`,
          attempts: 1,
          duration: Date.now() - startTime,
          details: { vmId, expectedState, operationName }
        };
      }
    } catch (error) {
      return {
        healthy: false,
        reason: error instanceof Error ? error.message : 'Unknown error during state validation',
        attempts: 1,
        duration: Date.now() - startTime,
        details: { vmId, expectedState, operationName, error }
      };
    }
  }
  
  /**
   * Pause a running VM
   * Note: vfkit doesn't natively support pause/resume
   * This is a no-op placeholder for snapshot compatibility
   */
  async pause(vmId: string): Promise<void> {
    logger.debug('Pause operation not supported by vfkit', { vmId });
    // vfkit doesn't have native pause support
    // For snapshots, we rely on the snapshot manager to handle this
  }

  /**
   * Resume a paused VM
   * Note: vfkit doesn't natively support pause/resume
   * This is a no-op placeholder for snapshot compatibility
   */
  async resume(vmId: string): Promise<void> {
    logger.debug('Resume operation not supported by vfkit', { vmId });
    // vfkit doesn't have native resume support
  }

  /**
   * Save VM state to file
   * Saves VM configuration and runtime state for later restoration
   *
   * @param vmId - VM identifier
   * @param statePath - Path where state should be saved
   * @returns Promise resolving to true if state was saved successfully
   */
  async saveState(vmId: string, statePath: string): Promise<boolean> {
    logger.info('Saving VM state', { vmId, statePath });

    try {
      const vmDir = validateVMPath(this.vmBaseDir, vmId);
      const validatedStatePath = validateVMPath(path.dirname(statePath), path.basename(statePath));

      // Collect VM state information
      const state = {
        vmId,
        savedAt: new Date().toISOString(),
        status: await this.getVMStatus(vmId),
        config: null as VMConfig | null,
        pid: null as number | null,
      };

      // Read VM config
      try {
        const configPath = validateVMPath(vmDir, 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        state.config = JSON.parse(configData);
      } catch (error) {
        logger.warn('Could not read VM config during state save', { vmId, error });
      }

      // Read VM PID if running
      try {
        const pidPath = validateVMPath(vmDir, 'vm.pid');
        const pidContent = await fs.readFile(pidPath, 'utf-8');
        state.pid = parseInt(pidContent.trim(), 10);
      } catch (error) {
        logger.debug('No PID file found during state save', { vmId });
      }

      // Save state to file
      await fs.writeFile(validatedStatePath, JSON.stringify(state, null, 2));

      logger.info('VM state saved successfully', { vmId, statePath });
      return true;
    } catch (error) {
      logger.error('Failed to save VM state', { vmId, statePath, error });
      return false;
    }
  }

  /**
   * Restore VM state from file
   * Restores VM configuration and runtime state
   *
   * @param vmId - VM identifier
   * @param statePath - Path to saved state file
   * @returns Promise resolving to true if state was restored successfully
   */
  async restoreState(vmId: string, statePath: string): Promise<boolean> {
    logger.info('Restoring VM state', { vmId, statePath });

    try {
      // Read state file
      const stateData = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateData);

      logger.debug('VM state read from file', {
        vmId,
        savedVmId: state.vmId,
        savedAt: state.savedAt,
        status: state.status
      });

      // Verify state matches VM
      if (state.vmId !== vmId) {
        logger.warn('State file is for different VM', {
          vmId,
          stateVmId: state.vmId
        });
        return false;
      }

      // Restore config if present
      if (state.config) {
        const vmDir = path.join(this.vmBaseDir, vmId);
        const configPath = path.join(vmDir, 'config.json');

        try {
          await fs.writeFile(configPath, JSON.stringify(state.config, null, 2));
          logger.debug('VM config restored', { vmId });
        } catch (error) {
          logger.warn('Could not restore VM config', { vmId, error });
        }
      }

      logger.info('VM state restored successfully', { vmId, statePath });
      return true;
    } catch (error) {
      logger.error('Failed to restore VM state', { vmId, statePath, error });
      return false;
    }
  }

  /**
   * Restart a VM with state preservation
   * Saves VM state before stopping, then restores after starting
   *
   * @param vmId - VM identifier
   * @returns Promise that resolves when restart is complete
   */
  async restart(vmId: string): Promise<void> {
    logger.info('Restarting VM with state preservation', { vmId });
    const span = getTracer().startSpan('vfkit.restart');
    span.setTag('vm.id', vmId);

    const vmDir = path.join(this.vmBaseDir, vmId);
    const statePath = path.join(vmDir, 'restart.state');

    try {
      // Save current state
      const sSave = getTracer().startSpan('vfkit.restart.saveState');
      const stateSaved = await this.saveState(vmId, statePath);
      sSave.setTag('state.saved', stateSaved);
      sSave.finish();

      if (!stateSaved) {
        logger.warn('Could not save VM state, proceeding with restart anyway', { vmId });
      }

      // Stop VM
      const sStop = getTracer().startSpan('vfkit.restart.stop');
      try {
        await this.stop(vmId);
        sStop.finish();
      } catch (error) {
        sStop.finish();
        logger.warn('Error stopping VM during restart', { vmId, error });
        // Continue with restart even if stop fails (VM might already be stopped)
      }

      // Start VM
      const sStart = getTracer().startSpan('vfkit.restart.start');
      await this.start(vmId);
      sStart.finish();

      // Restore state if it was saved
      if (stateSaved) {
        const sRestore = getTracer().startSpan('vfkit.restart.restoreState');
        const stateRestored = await this.restoreState(vmId, statePath);
        sRestore.setTag('state.restored', stateRestored);
        sRestore.finish();

        if (!stateRestored) {
          logger.warn('Could not restore VM state after restart', { vmId });
        }

        // Clean up state file
        try {
          await fs.unlink(statePath);
        } catch (error) {
          logger.debug('Could not clean up state file', { vmId, statePath, error });
        }
      }

      logger.info('VM restarted successfully', { vmId });
      span.finish();
    } catch (error) {
      logger.error('Failed to restart VM', { vmId, error });
      span.finish();
      throw error;
    }
  }

  /**
   * Get VM configuration
   *
   * @param vmId - VM identifier
   * @returns Promise resolving to VM config or null if not found
   */
  async getConfig(vmId: string): Promise<VMConfig | null> {
    try {
      const vmDir = path.join(this.vmBaseDir, vmId);
      const configPath = path.join(vmDir, 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      logger.debug('Could not read VM config', { vmId, error });
      return null;
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
