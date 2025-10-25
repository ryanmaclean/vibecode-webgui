/**
 * Docker Provider
 * Container-based VM alternative for testing and development
 * Works on any platform with Docker installed
 */

import { VMProvider, VMConfig, VM, VMStatus, ExecResult } from '../types';
import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export class DockerProvider implements VMProvider {
  name = 'docker';
  private remoteHost?: string;
  
  constructor(options?: { remoteHost?: string }) {
    this.remoteHost = options?.remoteHost;
  }
  
  async detect(): Promise<boolean> {
    try {
      const cmd = this.remoteHost 
        ? `ssh ${this.remoteHost} "docker --version"`
        : 'docker --version';
      await exec(cmd);
      return true;
    } catch {
      return false;
    }
  }
  
  async create(config: VMConfig): Promise<VM> {
    logger.info('Creating Docker container', { name: config.name, remote: this.remoteHost });
    
    // Build docker run command
    const args = [
      'docker run -d',
      `--name ${config.name}`,
      `--cpus=${config.cpus}`,
      `--memory=${config.memory}`,
    ];
    
    // Add port mappings
    if (config.ports) {
      config.ports.forEach(p => {
        args.push(`-p ${p.host}:${p.guest}`);
      });
    }
    
    // Add volume mappings
    if (config.volumes) {
      config.volumes.forEach(v => {
        const mode = v.writable ? 'rw' : 'ro';
        args.push(`-v ${v.host}:${v.guest}:${mode}`);
      });
    }
    
    // Add environment variables
    if (config.env) {
      Object.entries(config.env).forEach(([key, value]) => {
        args.push(`-e ${key}="${value}"`);
      });
    }
    
    // Determine image
    const image = this.getImage(config.image);
    args.push(image);
    
    // Add command to keep container running
    args.push('tail -f /dev/null');
    
    const cmd = this.wrapRemote(args.join(' '));
    const { stdout } = await exec(cmd);
    const containerId = stdout.trim();
    
    // Run provisioning scripts
    if (config.provision) {
      for (const provision of config.provision) {
        await this.exec(config.name, provision.script);
      }
    }
    
    return {
      id: containerId.substring(0, 12),
      name: config.name,
      provider: 'docker',
      status: 'running',
      ports: config.ports || [],
      metadata: { remoteHost: this.remoteHost },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  async start(vmId: string): Promise<void> {
    logger.info('Starting Docker container', { vmId });
    const cmd = this.wrapRemote(`docker start ${vmId}`);
    await exec(cmd);
  }
  
  async stop(vmId: string): Promise<void> {
    logger.info('Stopping Docker container', { vmId });
    const cmd = this.wrapRemote(`docker stop ${vmId}`);
    await exec(cmd);
  }
  
  async destroy(vmId: string): Promise<void> {
    logger.info('Destroying Docker container', { vmId });
    
    try {
      await this.stop(vmId);
    } catch {
      // Container might not be running
    }
    
    const cmd = this.wrapRemote(`docker rm ${vmId}`);
    await exec(cmd);
  }
  
  async list(): Promise<VM[]> {
    const cmd = this.wrapRemote('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}"');
    const { stdout } = await exec(cmd);
    
    const vms: VM[] = [];
    const lines = stdout.trim().split('\n').filter(l => l);
    
    for (const line of lines) {
      const [id, name, status, ports] = line.split('|');
      
      vms.push({
        id,
        name,
        provider: 'docker',
        status: status.startsWith('Up') ? 'running' : 'stopped',
        ports: this.parsePorts(ports),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return vms;
  }
  
  async exec(vmId: string, command: string): Promise<ExecResult> {
    const startTime = Date.now();
    
    logger.info('Executing command in container', { vmId, command });
    
    try {
      const cmd = this.wrapRemote(`docker exec ${vmId} sh -c "${command.replace(/"/g, '\\"')}"`);
      const { stdout, stderr } = await exec(cmd);
      
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
      const cmd = this.wrapRemote(`docker inspect -f '{{.State.Status}}' ${vmId}`);
      const { stdout } = await exec(cmd);
      const status = stdout.trim();
      
      switch (status) {
        case 'running':
          return 'running';
        case 'exited':
        case 'created':
          return 'stopped';
        case 'paused':
          return 'stopping';
        default:
          return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Wrap command for remote execution
   */
  private wrapRemote(cmd: string): string {
    if (this.remoteHost) {
      return `ssh ${this.remoteHost} "${cmd.replace(/"/g, '\\"')}"`;
    }
    return cmd;
  }
  
  /**
   * Get Docker image for config
   */
  private getImage(image: string): string {
    // Map our image names to Docker images
    const imageMap: Record<string, string> = {
      'alpine-3.22': 'alpine:3.22',
      'ubuntu-24.04': 'ubuntu:24.04',
      'debian-12': 'debian:12',
      'postgres-16': 'postgres:16-alpine',
      'valkey-7.2': 'valkey/valkey:7.2-alpine'
    };
    
    return imageMap[image] || image;
  }
  
  /**
   * Parse Docker port string
   */
  private parsePorts(portsStr: string): Array<{ guest: number; host: number; protocol?: 'tcp' | 'udp' }> {
    const ports: Array<{ guest: number; host: number; protocol?: 'tcp' | 'udp' }> = [];
    
    if (!portsStr) return ports;
    
    // Parse format: "0.0.0.0:5432->5432/tcp"
    const matches = portsStr.matchAll(/(\d+)->(\d+)\/(tcp|udp)/g);
    for (const match of matches) {
      ports.push({
        host: parseInt(match[1]),
        guest: parseInt(match[2]),
        protocol: match[3] as 'tcp' | 'udp'
      });
    }
    
    return ports;
  }
}
