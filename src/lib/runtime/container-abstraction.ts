/**
 * Container Runtime Abstraction
 * Issue #877: Support Docker, Podman, K8s, and Apple Containers
 */

import { spawn } from 'child_process';

/**
 * Container information
 */
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  createdAt: Date;
  ports: PortMapping[];
  labels: Record<string, string>;
}

export type ContainerStatus = 'created' | 'running' | 'paused' | 'stopped' | 'dead';

export interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: 'tcp' | 'udp';
}

/**
 * Container runtime type
 */
export type RuntimeType = 'docker' | 'podman' | 'kubernetes' | 'apple-containers';

/**
 * Container runtime interface
 */
export interface ContainerRuntime {
  type: RuntimeType;

  // Lifecycle
  start(containerId: string): Promise<void>;
  stop(containerId: string, timeout?: number): Promise<void>;
  restart(containerId: string): Promise<void>;
  remove(containerId: string, force?: boolean): Promise<void>;

  // Execution
  exec(containerId: string, command: string[]): Promise<ExecResult>;

  // Information
  logs(containerId: string, options?: LogOptions): Promise<string>;
  inspect(containerId: string): Promise<ContainerInfo>;
  listContainers(all?: boolean): Promise<ContainerInfo[]>;

  // Images
  pullImage(image: string): Promise<void>;
  listImages(): Promise<ImageInfo[]>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface LogOptions {
  tail?: number;
  since?: Date;
  follow?: boolean;
}

export interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  createdAt: Date;
}

/**
 * Run command safely using spawn (no shell injection)
 */
function runCommand(command: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);
    proc.on('close', code => resolve({ exitCode: code || 0, stdout, stderr }));
    proc.on('error', reject);
  });
}

/**
 * Docker runtime implementation
 */
export class DockerRuntime implements ContainerRuntime {
  type: RuntimeType = 'docker';
  protected cmd = 'docker';

  async start(containerId: string): Promise<void> {
    await runCommand(this.cmd, ['start', containerId]);
  }

  async stop(containerId: string, timeout = 10): Promise<void> {
    await runCommand(this.cmd, ['stop', '-t', String(timeout), containerId]);
  }

  async restart(containerId: string): Promise<void> {
    await runCommand(this.cmd, ['restart', containerId]);
  }

  async remove(containerId: string, force = false): Promise<void> {
    const args = force ? ['rm', '-f', containerId] : ['rm', containerId];
    await runCommand(this.cmd, args);
  }

  async exec(containerId: string, command: string[]): Promise<ExecResult> {
    return runCommand(this.cmd, ['exec', containerId, ...command]);
  }

  async logs(containerId: string, options?: LogOptions): Promise<string> {
    const args = ['logs'];
    if (options?.tail) args.push('--tail', String(options.tail));
    args.push(containerId);
    const result = await runCommand(this.cmd, args);
    return result.stdout + result.stderr;
  }

  async inspect(containerId: string): Promise<ContainerInfo> {
    const result = await runCommand(this.cmd, ['inspect', containerId]);
    const data = JSON.parse(result.stdout)[0];
    return this.parseContainerInfo(data);
  }

  async listContainers(all = false): Promise<ContainerInfo[]> {
    const args = ['ps', '--format', '{{json .}}'];
    if (all) args.push('-a');
    const result = await runCommand(this.cmd, args);
    return result.stdout.trim().split('\n')
      .filter(line => line)
      .map(line => this.parseContainerInfo(JSON.parse(line)));
  }

  async pullImage(image: string): Promise<void> {
    await runCommand(this.cmd, ['pull', image]);
  }

  async listImages(): Promise<ImageInfo[]> {
    const result = await runCommand(this.cmd, ['images', '--format', '{{json .}}']);
    return result.stdout.trim().split('\n')
      .filter(line => line)
      .map(line => {
        const data = JSON.parse(line);
        return {
          id: data.ID,
          tags: [data.Repository + ':' + data.Tag],
          size: parseInt(data.Size) || 0,
          createdAt: new Date(data.CreatedAt),
        };
      });
  }

  private parseContainerInfo(data: Record<string, unknown>): ContainerInfo {
    return {
      id: String(data.Id || data.ID || ''),
      name: String(data.Name || data.Names || '').replace(/^\//, ''),
      image: String(data.Image || ''),
      status: this.parseStatus(String(data.State || data.Status || '')),
      createdAt: new Date(String(data.Created || data.CreatedAt || '')),
      ports: [],
      labels: (data.Labels as Record<string, string>) || {},
    };
  }

  private parseStatus(status: string): ContainerStatus {
    const s = status.toLowerCase();
    if (s.includes('running')) return 'running';
    if (s.includes('paused')) return 'paused';
    if (s.includes('exited') || s.includes('stopped')) return 'stopped';
    if (s.includes('dead')) return 'dead';
    return 'created';
  }
}

/**
 * Podman runtime (same CLI as Docker)
 */
export class PodmanRuntime extends DockerRuntime {
  type: RuntimeType = 'podman';
  protected cmd = 'podman';
}

/**
 * Factory to create runtime based on type
 */
export function createRuntime(type: RuntimeType): ContainerRuntime {
  switch (type) {
    case 'docker':
      return new DockerRuntime();
    case 'podman':
      return new PodmanRuntime();
    case 'kubernetes':
    case 'apple-containers':
      // Placeholder - would need kubectl/container tool implementations
      return new DockerRuntime();
    default:
      return new DockerRuntime();
  }
}

/**
 * Auto-detect available runtime
 */
export async function detectRuntime(): Promise<RuntimeType> {
  try {
    await runCommand('docker', ['--version']);
    return 'docker';
  } catch {
    try {
      await runCommand('podman', ['--version']);
      return 'podman';
    } catch {
      return 'docker'; // Default fallback
    }
  }
}
