/**
 * Lima Provider
 * Cross-platform VM support for macOS and Linux
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';

const exec = promisify(execCallback);

export class LimaProvider implements VMProvider {
  name = 'lima';
  
  async detect(): Promise<boolean> {
    try {
      await exec('which limactl');
      return true;
    } catch {
      return false;
    }
  }
  
  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating Lima VM', { name: config.name });
    
    // Generate Lima YAML configuration
    const limaConfig = this.generateLimaConfig(config);
    
    // Write config to temp file
    const configPath = `/tmp/${config.name}.yaml`;
    await fs.writeFile(configPath, yaml.stringify(limaConfig));
    
    // Create and start VM
    await exec(`limactl create --name=${config.name} ${configPath}`);
    await exec(`limactl start ${config.name}`);
    
    return {
      id: config.name,
      name: config.name,
      provider: 'lima',
      status: 'running',
      ports: config.ports || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting Lima VM', { vmId });
    await exec(`limactl start ${vmId}`);
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping Lima VM', { vmId });
    await exec(`limactl stop ${vmId}`);
  }
  
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying Lima VM', { vmId });
    await exec(`limactl delete ${vmId}`);
  }
  
  async list(): Promise<VM[]> {
    const { stdout } = await exec('limactl list --json');

    // Handle empty output
    if (!stdout || stdout.trim() === '') {
      return [];
    }

    const limaVMs = JSON.parse(stdout);

    // Handle null or non-array responses
    if (!limaVMs || !Array.isArray(limaVMs)) {
      return [];
    }

    return limaVMs.map((vm: any) => ({
      id: vm.name,
      name: vm.name,
      provider: 'lima',
      status: this.mapLimaStatus(vm.status),
      ports: [],
      createdAt: new Date(vm.created),
      updatedAt: new Date()
    }));
  }
  
  async exec(vmId: string, command: string): Promise<ExecResult> {
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await exec(`limactl shell ${vmId} -- ${command}`);
      
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
    const { stdout } = await exec(`limactl list ${vmId} --json`);
    const vms = JSON.parse(stdout);
    
    if (vms.length === 0) {
      return 'unknown';
    }
    
    return this.mapLimaStatus(vms[0].status);
  }
  
  /**
   * Generate Lima configuration
   */
  private generateLimaConfig(config: VMConfig): any {
    const arch = config.arch === 'arm64' ? 'aarch64' : 'x86_64';
    
    return {
      arch,
      images: [{
        location: `https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/${arch}/alpine-virt-3.22.2-${arch}.iso`,
        arch
      }],
      cpus: config.cpus,
      memory: config.memory,
      disk: config.disk,
      mounts: config.volumes?.map(v => ({
        location: v.host,
        writable: v.writable || false
      })) || [],
      portForwards: config.ports?.map(p => ({
        guestPort: p.guest,
        hostPort: p.host,
        proto: p.protocol || 'tcp'
      })) || [],
      provision: config.provision?.map(p => ({
        mode: p.mode,
        script: p.script
      })) || []
    };
  }
  
  /**
   * Map Lima status to VMStatus
   */
  private mapLimaStatus(limaStatus: string): VMStatus {
    switch (limaStatus.toLowerCase()) {
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'stopping':
        return 'stopping';
      default:
        return 'unknown';
    }
  }
}
