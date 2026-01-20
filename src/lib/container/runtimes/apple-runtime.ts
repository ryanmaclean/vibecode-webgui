/**
 * Apple Container Runtime Adapter
 * 
 * Adapts the existing AppleContainerRuntime to the unified ContainerRuntime interface
 * Note: This wraps the legacy implementation found in ../apple-container.ts
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
  AppleContainerConfig,
} from '../runtime-interface';
// Import the existing Apple Container implementation
import { AppleContainerRuntime as LegacyAppleRuntime } from '../apple-container';
import { logger } from '@/lib/logger';

export class AppleContainerRuntime implements ContainerRuntime {
  readonly name = 'apple' as const;
  readonly version?: string;

  private runtime: LegacyAppleRuntime;
  private isolation: 'process' | 'vm';
  private enableRosetta: boolean;

  constructor(config?: AppleContainerConfig) {
    this.runtime = new LegacyAppleRuntime();
    this.isolation = config?.isolation || 'vm';
    this.enableRosetta = config?.enableRosetta ?? true;
  }

  async isAvailable(): Promise<boolean> {
    return this.runtime.isAvailable();
  }

  async getStatus(): Promise<RuntimeStatus> {
    const available = await this.runtime.isAvailable();

    if (!available) {
      return {
        available: false,
        running: false,
        error: 'Apple Container CLI not available',
      };
    }

    return {
      available: true,
      running: true,
      info: {
        isolation: this.isolation,
        rosettaEnabled: this.enableRosetta,
        platform: 'macOS',
      },
    };
  }

  async start(image: string, options: ContainerOptions = {}): Promise<ContainerStartResult> {
    try {
      // Convert unified options to legacy format
      const legacyOptions = this.toLegacyOptions(options);
      
      const result = await this.runtime.start(image, legacyOptions);
      
      return {
        success: result.success,
        id: result.id,
        name: result.name,
        error: result.error,
      };
    } catch (error) {
      logger.error('Failed to start Apple container', { 
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
      const result = await this.runtime.stop(containerId);
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop container',
      };
    }
  }

  async remove(containerId: string): Promise<OperationResult> {
    try {
      const result = await this.runtime.remove(containerId);
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove container',
      };
    }
  }

  async list(options: ListOptions = {}): Promise<ContainerListResult> {
    try {
      const result = await this.runtime.list();
      
      if (!result.success) {
        return {
          success: false,
          containers: [],
          error: result.error,
        };
      }

      // Filter containers if options specified
      let containers = result.containers.map(c => ({
        ...c,
        state: this.mapState(c.state),
      }));

      if (options.state) {
        containers = containers.filter(c => c.state === options.state);
      }

      if (options.limit) {
        containers = containers.slice(0, options.limit);
      }

      return {
        success: true,
        containers,
      };
    } catch (error) {
      return {
        success: false,
        containers: [],
        error: error instanceof Error ? error.message : 'Failed to list containers',
      };
    }
  }

  async logs(containerId: string, options: LogOptions = {}): Promise<ContainerLogsResult> {
    try {
      const result = await this.runtime.logs(containerId);
      
      let logs = result.logs;

      // Apply tail if specified
      if (options.tail && logs) {
        const lines = logs.split('\n');
        logs = lines.slice(-options.tail).join('\n');
      }

      return {
        success: result.success,
        logs,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        logs: '',
        error: error instanceof Error ? error.message : 'Failed to get logs',
      };
    }
  }

  async inspect(containerId: string): Promise<ContainerInfo | null> {
    try {
      const info = await this.runtime.inspect(containerId);
      
      if (!info) return null;

      return {
        ...info,
        state: this.mapState(info.state),
      };
    } catch (error) {
      logger.error('Failed to inspect container', {
        id: containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async exec(containerId: string, command: string[]): Promise<ExecResult> {
    // Apple Container CLI doesn't support exec yet
    // This is a placeholder implementation
    logger.warn('Exec not supported for Apple containers yet', { containerId });
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: 'Exec not supported for Apple containers',
      error: 'Exec not supported for Apple containers',
    };
  }

  async stats(containerId: string): Promise<ContainerStats | null> {
    // Apple Container CLI doesn't provide stats yet
    // This is a placeholder implementation
    logger.warn('Stats not supported for Apple containers yet', { containerId });
    return null;
  }

  /**
   * Convert unified options to legacy format
   */
  private toLegacyOptions(options: ContainerOptions): any {
    return {
      name: options.name,
      ports: options.ports,
      env: options.env,
      volumes: options.volumes,
      detached: options.detached,
      rm: options.rm,
      cpus: options.cpus,
      memory: options.memory,
      args: options.command,
    };
  }

  /**
   * Map legacy state to unified state
   */
  private mapState(state: string): any {
    const stateMap: Record<string, any> = {
      'created': 'created',
      'running': 'running',
      'stopped': 'exited',
      'exited': 'exited',
      'paused': 'paused',
    };

    return stateMap[state.toLowerCase()] || 'exited';
  }
}
