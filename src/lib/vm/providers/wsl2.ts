/**
 * WSL2 Provider
 * Windows Subsystem for Linux support
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCallback);

export class WSL2Provider implements VMProvider {
  name = 'wsl2';
  private configDir: string;
  
  constructor() {
    this.configDir = path.join(os.homedir(), '.vibecode/wsl2');
  }
  
  async detect(): Promise<boolean> {
    if (os.platform() !== 'win32') {
      return false;
    }
    
    try {
      const { stdout } = await exec('wsl --status');
      return stdout.includes('WSL 2');
    } catch {
      return false;
    }
  }
  
  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating WSL2 instance', { name: config.name });
    
    // WSL2 uses distributions, not traditional VMs
    // We'll import Alpine Linux as a custom distribution
    
    const distroName = config.name;
    const installDir = path.join(this.configDir, distroName);
    
    await fs.mkdir(installDir, { recursive: true });
    
    // Download Alpine rootfs
    const rootfsPath = await this.downloadAlpineRootfs(installDir);
    
    // Import as WSL distribution
    await exec(`wsl --import ${distroName} ${installDir} ${rootfsPath}`);
    
    // Configure distribution
    await this.configureDistribution(distroName, config);
    
    // Save config
    const configPath = path.join(installDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return {
      id: distroName,
      name: distroName,
      provider: 'wsl2',
      status: 'running',
      ports: config.ports || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting WSL2 instance', { vmId });
    
    // WSL2 distributions start automatically when accessed
    // Just verify it's available
    await exec(`wsl -d ${vmId} echo "started"`);
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping WSL2 instance', { vmId });
    
    await exec(`wsl --terminate ${vmId}`);
  }
  
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying WSL2 instance', { vmId });
    
    // Unregister distribution
    await exec(`wsl --unregister ${vmId}`);
    
    // Remove config directory
    const installDir = path.join(this.configDir, vmId);
    await fs.rm(installDir, { recursive: true, force: true });
  }
  
  async list(): Promise<VM[]> {
    const vms: VM[] = [];
    
    try {
      const { stdout } = await exec('wsl --list --verbose');
      const lines = stdout.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const match = line.match(/\s*(\S+)\s+(Running|Stopped)/);
        if (match) {
          const [, name, state] = match;
          
          // Only include our managed distributions
          const configPath = path.join(this.configDir, name, 'config.json');
          try {
            const configData = await fs.readFile(configPath, 'utf-8');
            const config: VMConfig = JSON.parse(configData);
            
            vms.push({
              id: name,
              name,
              provider: 'wsl2',
              status: state === 'Running' ? 'running' : 'stopped',
              ports: config.ports || [],
              createdAt: new Date(),
              updatedAt: new Date()
            });
          } catch {
            // Not a managed distribution
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list WSL2 instances', { error });
    }
    
    return vms;
  }
  
  async exec(vmId: string, command: string): Promise<ExecResult> {
    const startTime = Date.now();
    
    logger.info('Executing command in WSL2', { vmId, command });
    
    try {
      const { stdout, stderr } = await exec(`wsl -d ${vmId} -- ${command}`);
      
      return {
        exitCode: 0,
        stdout,
        stderr,
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
    try {
      const { stdout } = await exec(`wsl --list --verbose`);
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        if (line.includes(vmId)) {
          if (line.includes('Running')) {
            return 'running';
          } else if (line.includes('Stopped')) {
            return 'stopped';
          }
        }
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Download Alpine Linux rootfs for WSL2
   */
  private async downloadAlpineRootfs(installDir: string): Promise<string> {
    const rootfsPath = path.join(installDir, 'alpine-rootfs.tar.gz');
    
    try {
      await fs.access(rootfsPath);
      logger.info('Alpine rootfs already exists');
      return rootfsPath;
    } catch {
      // Need to download
    }
    
    logger.info('Downloading Alpine rootfs for WSL2...');
    
    // Alpine provides mini rootfs for containers/WSL
    const url = 'https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/x86_64/alpine-minirootfs-3.22.2-x86_64.tar.gz';
    
    await exec(`curl -L -o ${rootfsPath} ${url}`);
    logger.info('Alpine rootfs downloaded');
    
    return rootfsPath;
  }
  
  /**
   * Configure WSL2 distribution
   */
  private async configureDistribution(distroName: string, config: VMConfig): Promise<void> {
    logger.info('Configuring WSL2 distribution', { distroName });
    
    // Set default user to root
    await exec(`wsl -d ${distroName} -u root -- echo "Configured"`);
    
    // Install Node.js if needed
    if (config.provision) {
      for (const provision of config.provision) {
        await exec(`wsl -d ${distroName} -u root -- sh -c "${provision.script}"`);
      }
    }
    
    // Configure .wslconfig for resource limits
    const wslConfigPath = path.join(os.homedir(), '.wslconfig');
    const wslConfig = `
[wsl2]
memory=${config.memory}
processors=${config.cpus}
`;
    
    try {
      const existing = await fs.readFile(wslConfigPath, 'utf-8');
      if (!existing.includes('[wsl2]')) {
        await fs.appendFile(wslConfigPath, wslConfig);
      }
    } catch {
      await fs.writeFile(wslConfigPath, wslConfig);
    }
  }
}
