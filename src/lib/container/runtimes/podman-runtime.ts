/**
 * Podman Container Runtime
 * 
 * Implementation of ContainerRuntime interface for Podman
 * Podman is Docker-compatible, so we extend DockerRuntime with Podman-specific features
 */

import { DockerRuntime } from './docker-runtime';
import type { PodmanConfig, RuntimeStatus } from '../runtime-interface';
import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export class PodmanRuntime extends DockerRuntime {
  readonly name = 'podman' as const;

  private machine?: string;
  private remoteHost?: string;
  private rootless: boolean;

  constructor(config?: PodmanConfig) {
    super({
      socketPath: config?.socketPath || '/run/user/1000/podman/podman.sock',
    });
    this.machine = config?.machine;
    this.remoteHost = config?.remoteHost;
    this.rootless = config?.rootless ?? true;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await this.execPodman(['--version']);
      logger.debug('Podman version check', { output: stdout });
      return true;
    } catch (error) {
      logger.debug('Podman not available', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const { stdout: versionOutput } = await this.execPodman(['--version']);
      const version = versionOutput.trim().split(' ')[2];

      // Check if Podman machine is running (macOS)
      if (this.machine) {
        try {
          const { stdout: machineStatus } = await this.execPodman(['machine', 'inspect', this.machine]);
          const machineInfo = JSON.parse(machineStatus);
          
          return {
            available: true,
            running: machineInfo.State === 'running',
            version,
            info: {
              machine: this.machine,
              machineState: machineInfo.State,
              rootless: this.rootless,
            },
          };
        } catch {
          return {
            available: true,
            running: false,
            version,
            error: 'Podman machine not running',
          };
        }
      }

      // Linux: check if Podman service is accessible
      const { stdout: infoOutput } = await this.execPodman(['info', '--format', '{{json .}}']);
      const info = JSON.parse(infoOutput);

      return {
        available: true,
        running: true,
        version,
        info: {
          version: info.version?.Version,
          rootless: this.rootless,
          ociRuntime: info.host?.ociRuntime?.name,
        },
      };
    } catch (error) {
      return {
        available: false,
        running: false,
        error: error instanceof Error ? error.message : 'Podman not available',
      };
    }
  }

  /**
   * Start Podman machine (macOS only)
   */
  async startMachine(): Promise<void> {
    if (!this.machine) {
      throw new Error('No Podman machine configured');
    }

    logger.info('Starting Podman machine', { machine: this.machine });
    
    try {
      await this.execPodman(['machine', 'start', this.machine]);
      logger.info('Podman machine started', { machine: this.machine });
    } catch (error) {
      logger.error('Failed to start Podman machine', {
        machine: this.machine,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop Podman machine (macOS only)
   */
  async stopMachine(): Promise<void> {
    if (!this.machine) {
      throw new Error('No Podman machine configured');
    }

    logger.info('Stopping Podman machine', { machine: this.machine });
    
    try {
      await this.execPodman(['machine', 'stop', this.machine]);
      logger.info('Podman machine stopped', { machine: this.machine });
    } catch (error) {
      logger.error('Failed to stop Podman machine', {
        machine: this.machine,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute Podman command
   */
  private async execPodman(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const podmanCmd = this.buildPodmanCommand(args);
    logger.debug('Executing Podman command', { command: podmanCmd });
    return exec(podmanCmd);
  }

  /**
   * Build Podman command with options
   */
  private buildPodmanCommand(args: string[]): string {
    const parts = ['podman'];

    if (this.remoteHost) {
      parts.push('--remote', '--host', this.remoteHost);
    }

    return [...parts, ...args].join(' ');
  }

  /**
   * Override Docker command execution to use Podman
   */
  protected buildDockerCommand(args: string[]): string {
    return this.buildPodmanCommand(args);
  }
}
