/**
 * Docker Container Runtime
 * 
 * Implementation of ContainerRuntime interface for Docker
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import type {
  ContainerRuntime,
  ContainerOptions,
  ContainerStartResult,
  OperationResult,
  ContainerListResult,
  ContainerLogsResult,
  ContainerInfo,
  ExecResult,
  ContainerStats,
  RuntimeStatus,
  ListOptions,
  LogOptions,
  DockerConfig,
  ContainerState,
} from '../runtime-interface';
import { logger } from '@/lib/logger';

const exec = promisify(execCallback);

export class DockerRuntime implements ContainerRuntime {
  readonly name = 'docker' as const;
  readonly version?: string;

  private socketPath: string;
  private host?: string;
  private tlsVerify: boolean;

  constructor(config?: DockerConfig) {
    this.socketPath = config?.socketPath || '/var/run/docker.sock';
    this.host = config?.host;
    this.tlsVerify = config?.tlsVerify || false;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await this.execDocker(['--version']);
      logger.debug('Docker version check', { output: stdout });
      return true;
    } catch (error) {
      logger.debug('Docker not available', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const { stdout: versionOutput } = await this.execDocker(['--version']);
      const version = versionOutput.trim().split(' ')[2]?.replace(',', '');

      // Check if Docker daemon is running
      const { stdout: infoOutput } = await this.execDocker(['info', '--format', '{{json .}}']);
      const info = JSON.parse(infoOutput);

      return {
        available: true,
        running: true,
        version,
        info: {
          serverVersion: info.ServerVersion,
          containers: info.Containers,
          images: info.Images,
          driver: info.Driver,
        },
      };
    } catch (error) {
      return {
        available: false,
        running: false,
        error: error instanceof Error ? error.message : 'Docker not available',
      };
    }
  }

  async start(image: string, options: ContainerOptions = {}): Promise<ContainerStartResult> {
    try {
      const args = ['run'];

      // Detached mode (default)
      if (options.detached !== false) {
        args.push('-d');
      }

      // Container name
      if (options.name) {
        args.push('--name', options.name);
      }

      // Port mappings
      if (options.ports) {
        for (const [host, container] of Object.entries(options.ports)) {
          args.push('-p', `${host}:${container}`);
        }
      }

      // Environment variables
      if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
          args.push('-e', `${key}=${value}`);
        }
      }

      // Volume mounts
      if (options.volumes) {
        for (const [hostPath, containerPath] of Object.entries(options.volumes)) {
          args.push('-v', `${hostPath}:${containerPath}`);
        }
      }

      // Remove after exit
      if (options.rm) {
        args.push('--rm');
      }

      // CPU and memory limits
      if (options.cpus) {
        args.push('--cpus', options.cpus.toString());
      }
      if (options.memory) {
        args.push('--memory', `${options.memory}m`);
      }

      // Network
      if (options.network) {
        args.push('--network', options.network);
      }

      // Working directory
      if (options.workdir) {
        args.push('--workdir', options.workdir);
      }

      // User
      if (options.user) {
        args.push('--user', options.user);
      }

      // Labels
      if (options.labels) {
        for (const [key, value] of Object.entries(options.labels)) {
          args.push('--label', `${key}=${value}`);
        }
      }

      // Restart policy
      if (options.restart) {
        args.push('--restart', options.restart);
      }

      // Health check
      if (options.healthCheck) {
        const { test, interval, timeout, retries, startPeriod } = options.healthCheck;
        args.push('--health-cmd', test.join(' '));
        if (interval) args.push('--health-interval', `${interval}s`);
        if (timeout) args.push('--health-timeout', `${timeout}s`);
        if (retries) args.push('--health-retries', retries.toString());
        if (startPeriod) args.push('--health-start-period', `${startPeriod}s`);
      }

      // Image name
      args.push(image);

      // Command
      if (options.command) {
        args.push(...options.command);
      }

      const { stdout } = await this.execDocker(args);
      const containerId = stdout.trim();

      logger.info('Started Docker container', { id: containerId, name: options.name });

      return {
        success: true,
        id: containerId,
        name: options.name || containerId.substring(0, 12),
      };
    } catch (error) {
      logger.error('Failed to start Docker container', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        image,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start container',
      };
    }
  }

  async stop(containerId: string): Promise<OperationResult> {
    try {
      await this.execDocker(['stop', containerId]);
      logger.info('Stopped Docker container', { id: containerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop Docker container', { 
        id: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop container',
      };
    }
  }

  async remove(containerId: string): Promise<OperationResult> {
    try {
      await this.execDocker(['rm', '-f', containerId]);
      logger.info('Removed Docker container', { id: containerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove Docker container', { 
        id: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove container',
      };
    }
  }

  async list(options: ListOptions = {}): Promise<ContainerListResult> {
    try {
      const args = ['ps', '--format', '{{json .}}'];

      if (options.all) {
        args.push('-a');
      }

      if (options.limit) {
        args.push('--last', options.limit.toString());
      }

      const { stdout } = await this.execDocker(args);
      const lines = stdout.trim().split('\n').filter(l => l);

      const containers: ContainerInfo[] = lines.map(line => {
        const data = JSON.parse(line);
        return this.parseContainerInfo(data);
      });

      return {
        success: true,
        containers,
      };
    } catch (error) {
      logger.error('Failed to list Docker containers', { 
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        containers: [],
        error: error instanceof Error ? error.message : 'Failed to list containers',
      };
    }
  }

  async logs(containerId: string, options: LogOptions = {}): Promise<ContainerLogsResult> {
    try {
      const args = ['logs'];

      if (options.follow) {
        args.push('-f');
      }

      if (options.tail) {
        args.push('--tail', options.tail.toString());
      }

      if (options.timestamps) {
        args.push('--timestamps');
      }

      if (options.since) {
        args.push('--since', options.since.toISOString());
      }

      if (options.until) {
        args.push('--until', options.until.toISOString());
      }

      args.push(containerId);

      const { stdout, stderr } = await this.execDocker(args);
      const logs = stdout + stderr;

      return {
        success: true,
        logs,
      };
    } catch (error) {
      logger.error('Failed to get Docker container logs', { 
        id: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        logs: '',
        error: error instanceof Error ? error.message : 'Failed to get logs',
      };
    }
  }

  async inspect(containerId: string): Promise<ContainerInfo | null> {
    try {
      const { stdout } = await this.execDocker(['inspect', containerId]);
      const data = JSON.parse(stdout)[0];

      if (!data) return null;

      return {
        id: data.Id,
        name: data.Name.replace(/^\//, ''),
        image: data.Config.Image,
        state: this.mapDockerState(data.State.Status),
        ipAddress: data.NetworkSettings?.IPAddress,
        ports: this.parsePortBindings(data.NetworkSettings?.Ports),
        created: data.Created,
        started: data.State.StartedAt,
        labels: data.Config.Labels,
        networks: Object.entries(data.NetworkSettings?.Networks || {}).map(([name, info]: [string, any]) => ({
          name,
          id: info.NetworkID,
          ipAddress: info.IPAddress,
          gateway: info.Gateway,
        })),
      };
    } catch (error) {
      logger.error('Failed to inspect Docker container', { 
        id: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async exec(containerId: string, command: string[]): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await this.execDocker(['exec', containerId, ...command]);

      return {
        success: true,
        exitCode: 0,
        stdout,
        stderr,
      };
    } catch (error: any) {
      return {
        success: false,
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || (error instanceof Error ? error.message : 'Unknown error'),
        error: error instanceof Error ? error.message : 'Command execution failed',
      };
    }
  }

  async stats(containerId: string): Promise<ContainerStats | null> {
    try {
      const { stdout } = await this.execDocker([
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}',
        containerId,
      ]);

      const data = JSON.parse(stdout);

      return {
        containerId: data.Container,
        cpuPercent: parseFloat(data.CPUPerc.replace('%', '')),
        memoryUsage: this.parseBytes(data.MemUsage.split('/')[0]),
        memoryLimit: this.parseBytes(data.MemUsage.split('/')[1]),
        memoryPercent: parseFloat(data.MemPerc.replace('%', '')),
        networkRx: this.parseBytes(data.NetIO.split('/')[0]),
        networkTx: this.parseBytes(data.NetIO.split('/')[1]),
        blockRead: this.parseBytes(data.BlockIO.split('/')[0]),
        blockWrite: this.parseBytes(data.BlockIO.split('/')[1]),
        pids: parseInt(data.PIDs),
      };
    } catch (error) {
      logger.error('Failed to get Docker container stats', { 
        id: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Execute Docker command
   */
  private async execDocker(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const dockerCmd = this.buildDockerCommand(args);
    logger.debug('Executing Docker command', { command: dockerCmd });
    return exec(dockerCmd);
  }

  /**
   * Build Docker command with options
   */
  private buildDockerCommand(args: string[]): string {
    const parts = ['docker'];

    if (this.host) {
      parts.push('-H', this.host);
    }

    if (this.tlsVerify) {
      parts.push('--tlsverify');
    }

    return [...parts, ...args].join(' ');
  }

  /**
   * Parse Docker container info from ps output
   */
  private parseContainerInfo(data: any): ContainerInfo {
    return {
      id: data.ID,
      name: data.Names,
      image: data.Image,
      state: this.mapDockerState(data.State),
      created: data.CreatedAt,
      ports: this.parsePortsFromPS(data.Ports),
    };
  }

  /**
   * Map Docker state to ContainerState
   */
  private mapDockerState(state: string): ContainerState {
    const stateMap: Record<string, ContainerState> = {
      'created': 'created',
      'running': 'running',
      'paused': 'paused',
      'restarting': 'restarting',
      'removing': 'removing',
      'exited': 'exited',
      'dead': 'dead',
    };

    return stateMap[state.toLowerCase()] || 'exited';
  }

  /**
   * Parse port bindings from inspect output
   */
  private parsePortBindings(ports: any): Record<string, number> {
    if (!ports) return {};

    const result: Record<string, number> = {};

    for (const [containerPort, bindings] of Object.entries(ports)) {
      if (Array.isArray(bindings) && bindings.length > 0) {
        const hostPort = bindings[0].HostPort;
        if (hostPort) {
          result[containerPort] = parseInt(hostPort);
        }
      }
    }

    return result;
  }

  /**
   * Parse ports from ps output
   */
  private parsePortsFromPS(portsStr: string): Record<string, number> {
    if (!portsStr) return {};

    const result: Record<string, number> = {};
    
    // Parse format: "0.0.0.0:8080->80/tcp"
    const matches = portsStr.matchAll(/(\d+)->(\d+)\/(tcp|udp)/g);
    for (const match of matches) {
      result[`${match[2]}/${match[3]}`] = parseInt(match[1]);
    }

    return result;
  }

  /**
   * Parse bytes from Docker stats output
   */
  private parseBytes(str: string): number {
    const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*([KMGTP]i?B?)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1000,
      'KIB': 1024,
      'MB': 1000 * 1000,
      'MIB': 1024 * 1024,
      'GB': 1000 * 1000 * 1000,
      'GIB': 1024 * 1024 * 1024,
      'TB': 1000 * 1000 * 1000 * 1000,
      'TIB': 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }
}
