/**
 * Web IDE Abstraction Layer
 * Issue #878: Support OpenVSCode Server, Code-Server, and Eclipse Theia
 */

import { spawn } from 'child_process';

/**
 * IDE type supported
 */
export type IDEType = 'openvscode' | 'code-server' | 'theia';

/**
 * IDE configuration
 */
export interface IDEConfig {
  port: number;
  workspacePath: string;
  extensions?: string[];
  auth?: {
    type: 'none' | 'password' | 'token';
    value?: string;
  };
  env?: Record<string, string>;
}

/**
 * IDE status
 */
export interface IDEStatus {
  running: boolean;
  url: string;
  pid?: number;
  uptime?: number;
}

/**
 * Web IDE interface
 */
export interface WebIDE {
  readonly type: IDEType;
  readonly name: string;
  readonly defaultImage: string;

  start(config: IDEConfig): Promise<void>;
  stop(): Promise<void>;
  getURL(config: IDEConfig): string;
  healthCheck(config: IDEConfig): Promise<boolean>;
  getStatus(): Promise<IDEStatus>;
  getContainerArgs(config: IDEConfig): string[];
}

/**
 * Run command safely using spawn
 */
function runCommand(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
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
 * Base class for Web IDEs
 */
abstract class BaseWebIDE implements WebIDE {
  abstract readonly type: IDEType;
  abstract readonly name: string;
  abstract readonly defaultImage: string;
  protected containerId?: string;
  protected startTime?: Date;

  abstract getContainerArgs(config: IDEConfig): string[];

  async start(config: IDEConfig): Promise<void> {
    const args = this.getContainerArgs(config);
    const result = await runCommand('docker', ['run', '-d', ...args]);
    if (result.exitCode === 0) {
      this.containerId = result.stdout.trim().substring(0, 12);
      this.startTime = new Date();
    }
  }

  async stop(): Promise<void> {
    if (this.containerId) {
      await runCommand('docker', ['stop', this.containerId]);
      await runCommand('docker', ['rm', this.containerId]);
      this.containerId = undefined;
      this.startTime = undefined;
    }
  }

  getURL(config: IDEConfig): string {
    return `http://localhost:${config.port}`;
  }

  async healthCheck(config: IDEConfig): Promise<boolean> {
    try {
      const result = await runCommand('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', this.getURL(config)]);
      return result.stdout === '200';
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<IDEStatus> {
    const running = !!this.containerId;
    return {
      running,
      url: running ? `Container ${this.containerId}` : 'Not running',
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
    };
  }
}

/**
 * OpenVSCode Server implementation
 * Default IDE, maintained by Gitpod
 */
export class OpenVSCodeServer extends BaseWebIDE {
  readonly type: IDEType = 'openvscode';
  readonly name = 'OpenVSCode Server';
  readonly defaultImage = 'gitpod/openvscode-server:latest';

  getContainerArgs(config: IDEConfig): string[] {
    const args = [
      '-p', `${config.port}:3000`,
      '-v', `${config.workspacePath}:/home/workspace:cached`,
    ];

    // Add environment variables
    if (config.env) {
      Object.entries(config.env).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });
    }

    args.push(this.defaultImage);

    return args;
  }

  getURL(config: IDEConfig): string {
    return `http://localhost:${config.port}/?folder=/home/workspace`;
  }
}

/**
 * Code-Server implementation
 * VS Code fork by Coder with built-in auth
 */
export class CodeServer extends BaseWebIDE {
  readonly type: IDEType = 'code-server';
  readonly name = 'Code-Server';
  readonly defaultImage = 'codercom/code-server:latest';

  getContainerArgs(config: IDEConfig): string[] {
    const args = [
      '-p', `${config.port}:8080`,
      '-v', `${config.workspacePath}:/home/coder/project:cached`,
    ];

    // Configure authentication
    if (config.auth?.type === 'password' && config.auth.value) {
      args.push('-e', `PASSWORD=${config.auth.value}`);
    } else if (config.auth?.type === 'none') {
      args.push('-e', 'PASSWORD=');
      args.push('--entrypoint', '/usr/bin/code-server');
      args.push(this.defaultImage);
      args.push('--auth', 'none');
      return args;
    }

    // Add environment variables
    if (config.env) {
      Object.entries(config.env).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });
    }

    args.push(this.defaultImage);

    return args;
  }

  getURL(config: IDEConfig): string {
    return `http://localhost:${config.port}/?folder=/home/coder/project`;
  }
}

/**
 * Eclipse Theia implementation
 * Modular IDE framework from Eclipse Foundation
 */
export class EclipseTheia extends BaseWebIDE {
  readonly type: IDEType = 'theia';
  readonly name = 'Eclipse Theia';
  readonly defaultImage = 'theiaide/theia:latest';

  getContainerArgs(config: IDEConfig): string[] {
    const args = [
      '-p', `${config.port}:3000`,
      '-v', `${config.workspacePath}:/home/project:cached`,
    ];

    // Add environment variables
    if (config.env) {
      Object.entries(config.env).forEach(([key, value]) => {
        args.push('-e', `${key}=${value}`);
      });
    }

    args.push(this.defaultImage);

    return args;
  }

  getURL(config: IDEConfig): string {
    return `http://localhost:${config.port}`;
  }
}

/**
 * Factory to create IDE based on type
 */
export function createIDE(type: IDEType): WebIDE {
  switch (type) {
    case 'openvscode':
      return new OpenVSCodeServer();
    case 'code-server':
      return new CodeServer();
    case 'theia':
      return new EclipseTheia();
    default:
      return new OpenVSCodeServer();
  }
}

/**
 * Get all available IDE types
 */
export function getAvailableIDEs(): Array<{ type: IDEType; name: string; description: string }> {
  return [
    {
      type: 'openvscode',
      name: 'OpenVSCode Server',
      description: 'Full VS Code experience in browser (Gitpod)',
    },
    {
      type: 'code-server',
      name: 'Code-Server',
      description: 'VS Code fork with built-in auth (Coder)',
    },
    {
      type: 'theia',
      name: 'Eclipse Theia',
      description: 'Customizable IDE framework (Eclipse Foundation)',
    },
  ];
}

/**
 * IDE feature comparison
 */
export const IDE_FEATURES = {
  openvscode: {
    vsCodeExtensions: 'full',
    builtInAuth: false,
    memoryUsage: 'high',
    customization: 'low',
    license: 'MIT',
  },
  'code-server': {
    vsCodeExtensions: 'open-vsx',
    builtInAuth: true,
    memoryUsage: 'medium',
    customization: 'medium',
    license: 'MIT',
  },
  theia: {
    vsCodeExtensions: 'partial',
    builtInAuth: false,
    memoryUsage: 'medium',
    customization: 'high',
    license: 'EPL-2.0',
  },
} as const;
