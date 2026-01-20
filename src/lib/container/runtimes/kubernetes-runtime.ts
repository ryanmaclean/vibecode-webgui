/**
 * Kubernetes Container Runtime
 * 
 * Implementation of ContainerRuntime interface for Kubernetes
 * Manages containers as Kubernetes pods and deployments
 */

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
  KubernetesConfig,
} from '../runtime-interface';
import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

export class KubernetesRuntime implements ContainerRuntime {
  readonly name = 'kubernetes' as const;
  readonly version?: string;

  private context?: string;
  private namespace: string;
  private kubeconfig?: string;

  constructor(config?: KubernetesConfig) {
    this.context = config?.context;
    this.namespace = config?.namespace || 'vibecode';
    this.kubeconfig = config?.kubeconfig;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await this.execKubectl(['version', '--client', '--short']);
      logger.debug('Kubectl version check', { output: stdout });
      return true;
    } catch (error) {
      logger.debug('Kubectl not available', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const { stdout: versionOutput } = await this.execKubectl(['version', '--client', '--short']);
      const version = versionOutput.trim().split(' ')[2];

      // Check cluster connectivity
      const { stdout: clusterInfo } = await this.execKubectl(['cluster-info']);
      
      return {
        available: true,
        running: true,
        version,
        info: {
          context: this.context,
          namespace: this.namespace,
          clusterInfo: clusterInfo.split('\n')[0],
        },
      };
    } catch (error) {
      return {
        available: true,
        running: false,
        error: error instanceof Error ? error.message : 'Kubernetes cluster not accessible',
      };
    }
  }

  async start(image: string, options: ContainerOptions = {}): Promise<ContainerStartResult> {
    try {
      const podName = options.name || `vibecode-${Date.now()}`;
      
      // Create pod manifest
      const manifest = this.createPodManifest(podName, image, options);
      
      // Apply manifest
      await this.execKubectl(['apply', '-f', '-'], { input: JSON.stringify(manifest) });

      logger.info('Started Kubernetes pod', { name: podName });

      return {
        success: true,
        id: podName,
        name: podName,
      };
    } catch (error) {
      logger.error('Failed to start Kubernetes pod', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        image,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start pod',
      };
    }
  }

  async stop(containerId: string): Promise<OperationResult> {
    try {
      await this.execKubectl(['delete', 'pod', containerId, '--grace-period=30']);
      logger.info('Stopped Kubernetes pod', { name: containerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop Kubernetes pod', { 
        name: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop pod',
      };
    }
  }

  async remove(containerId: string): Promise<OperationResult> {
    try {
      await this.execKubectl(['delete', 'pod', containerId, '--force', '--grace-period=0']);
      logger.info('Removed Kubernetes pod', { name: containerId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to remove Kubernetes pod', { 
        name: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove pod',
      };
    }
  }

  async list(options: ListOptions = {}): Promise<ContainerListResult> {
    try {
      const args = ['get', 'pods', '-o', 'json'];

      const { stdout } = await this.execKubectl(args);
      const data = JSON.parse(stdout);

      const containers: ContainerInfo[] = data.items.map((pod: any) => ({
        id: pod.metadata.name,
        name: pod.metadata.name,
        image: pod.spec.containers[0]?.image || 'unknown',
        state: this.mapPodPhase(pod.status.phase),
        ipAddress: pod.status.podIP,
        created: pod.metadata.creationTimestamp,
        labels: pod.metadata.labels,
      }));

      return {
        success: true,
        containers,
      };
    } catch (error) {
      logger.error('Failed to list Kubernetes pods', { 
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        containers: [],
        error: error instanceof Error ? error.message : 'Failed to list pods',
      };
    }
  }

  async logs(containerId: string, options: LogOptions = {}): Promise<ContainerLogsResult> {
    try {
      const args = ['logs', containerId];

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
        args.push('--since-time', options.since.toISOString());
      }

      const { stdout, stderr } = await this.execKubectl(args);
      const logs = stdout + stderr;

      return {
        success: true,
        logs,
      };
    } catch (error) {
      logger.error('Failed to get Kubernetes pod logs', { 
        name: containerId,
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
      const { stdout } = await this.execKubectl(['get', 'pod', containerId, '-o', 'json']);
      const pod = JSON.parse(stdout);

      return {
        id: pod.metadata.name,
        name: pod.metadata.name,
        image: pod.spec.containers[0]?.image || 'unknown',
        state: this.mapPodPhase(pod.status.phase),
        ipAddress: pod.status.podIP,
        created: pod.metadata.creationTimestamp,
        started: pod.status.startTime,
        labels: pod.metadata.labels,
      };
    } catch (error) {
      logger.error('Failed to inspect Kubernetes pod', { 
        name: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async exec(containerId: string, command: string[]): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await this.execKubectl(['exec', containerId, '--', ...command]);

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
      const { stdout } = await this.execKubectl(['top', 'pod', containerId, '--containers']);
      
      // Parse kubectl top output
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return null;

      const data = lines[1].split(/\s+/);
      const cpuStr = data[1];
      const memStr = data[2];

      return {
        containerId,
        cpuPercent: this.parseCPU(cpuStr),
        memoryUsage: this.parseMemory(memStr),
        memoryLimit: 0, // Not available from kubectl top
        memoryPercent: 0,
        networkRx: 0,
        networkTx: 0,
        blockRead: 0,
        blockWrite: 0,
      };
    } catch (error) {
      logger.error('Failed to get Kubernetes pod stats', { 
        name: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Execute kubectl command
   */
  private async execKubectl(
    args: string[], 
    options?: { input?: string }
  ): Promise<{ stdout: string; stderr: string }> {
    const kubectlCmd = this.buildKubectlCommand(args);
    logger.debug('Executing kubectl command', { command: kubectlCmd });
    
    if (options?.input) {
      // Use echo to pipe input
      return exec(`echo '${options.input}' | ${kubectlCmd}`);
    }
    
    return exec(kubectlCmd);
  }

  /**
   * Build kubectl command with options
   */
  private buildKubectlCommand(args: string[]): string {
    const parts = ['kubectl'];

    if (this.context) {
      parts.push('--context', this.context);
    }

    if (this.namespace) {
      parts.push('--namespace', this.namespace);
    }

    if (this.kubeconfig) {
      parts.push('--kubeconfig', this.kubeconfig);
    }

    return [...parts, ...args].join(' ');
  }

  /**
   * Create Kubernetes pod manifest
   */
  private createPodManifest(name: string, image: string, options: ContainerOptions): any {
    const manifest: any = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name,
        namespace: this.namespace,
        labels: {
          app: 'vibecode',
          ...options.labels,
        },
      },
      spec: {
        containers: [
          {
            name: 'main',
            image,
            env: options.env ? Object.entries(options.env).map(([name, value]) => ({ name, value })) : [],
            ports: options.ports ? Object.entries(options.ports).map(([_, containerPort]) => ({
              containerPort: parseInt(containerPort.toString()),
            })) : [],
            resources: {
              requests: {
                cpu: options.cpus ? `${options.cpus}` : '100m',
                memory: options.memory ? `${options.memory}Mi` : '128Mi',
              },
              limits: {
                cpu: options.cpus ? `${options.cpus}` : '1',
                memory: options.memory ? `${options.memory}Mi` : '512Mi',
              },
            },
          },
        ],
        restartPolicy: this.mapRestartPolicy(options.restart),
      },
    };

    if (options.command) {
      manifest.spec.containers[0].command = options.command;
    }

    return manifest;
  }

  /**
   * Map pod phase to container state
   */
  private mapPodPhase(phase: string): any {
    const phaseMap: Record<string, any> = {
      'Pending': 'created',
      'Running': 'running',
      'Succeeded': 'exited',
      'Failed': 'exited',
      'Unknown': 'exited',
    };

    return phaseMap[phase] || 'exited';
  }

  /**
   * Map restart policy
   */
  private mapRestartPolicy(restart?: string): string {
    const policyMap: Record<string, string> = {
      'no': 'Never',
      'always': 'Always',
      'on-failure': 'OnFailure',
      'unless-stopped': 'Always',
    };

    return policyMap[restart || 'no'] || 'Never';
  }

  /**
   * Parse CPU from kubectl top output
   */
  private parseCPU(cpuStr: string): number {
    // Parse format: "100m" or "0.5"
    if (cpuStr.endsWith('m')) {
      return parseFloat(cpuStr.slice(0, -1)) / 1000;
    }
    return parseFloat(cpuStr);
  }

  /**
   * Parse memory from kubectl top output
   */
  private parseMemory(memStr: string): number {
    const match = memStr.match(/^(\d+)([KMGT]i?)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      'K': 1024,
      'Ki': 1024,
      'M': 1024 * 1024,
      'Mi': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }
}
