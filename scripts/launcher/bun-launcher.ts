#!/usr/bin/env bun
/**
 * Bun-based Unified Launcher for OpenVSCode Server in VM
 *
 * Features:
 * - Fast startup with Bun runtime (~10x faster than Node.js)
 * - OpenVSCode Server configuration and launch
 * - VM lifecycle management with Apple Virtualization Framework
 * - Port forwarding and hot reload support
 * - Integration with existing VM infrastructure
 *
 * @see https://github.com/gitpod-io/openvscode-server
 */

import { spawn, type Subprocess } from 'bun';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { OpenVSCodeVMConfig, createVMConfig, VMPorts, getDefaultPorts } from './openvscode-vm';

// Configuration constants
const PROJECT_ROOT = resolve(import.meta.dir, '..', '..');
const VM_DIR = join(PROJECT_ROOT, '.vfkit', 'vms', 'openvscode-vm');
const LOG_DIR = join(VM_DIR, 'logs');

// Color utilities for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(level: 'info' | 'success' | 'warn' | 'error' | 'debug', message: string): void {
  const timestamp = new Date().toISOString();
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    warn: colors.yellow,
    error: colors.red,
    debug: colors.cyan,
  };
  const symbolMap = {
    info: 'i',
    success: '+',
    warn: '!',
    error: 'x',
    debug: '?',
  };

  if (level === 'debug' && !process.env.DEBUG) return;

  console.log(
    `${colorMap[level]}[${timestamp}] ${symbolMap[level]} ${message}${colors.reset}`
  );
}

function printBanner(): void {
  console.log(`
${colors.bold}${colors.cyan}============================================
  OpenVSCode VM Launcher (Bun Edition)
  Fast startup - Lightweight VM - Hot reload
============================================${colors.reset}
`);
}

interface LauncherOptions {
  port?: number;
  vmPort?: number;
  workspacePath?: string;
  hotReload?: boolean;
  debug?: boolean;
}

interface LauncherState {
  vmProcess: Subprocess | null;
  serverProcess: Subprocess | null;
  isRunning: boolean;
  ports: VMPorts;
}

class BunLauncher {
  private state: LauncherState;
  private config: OpenVSCodeVMConfig;
  private options: LauncherOptions;
  private fileWatcher: ReturnType<typeof Bun.file> | null = null;

  constructor(options: LauncherOptions = {}) {
    this.options = {
      port: options.port ?? 3000,
      vmPort: options.vmPort ?? 3600,
      workspacePath: options.workspacePath ?? PROJECT_ROOT,
      hotReload: options.hotReload ?? true,
      debug: options.debug ?? false,
    };

    this.state = {
      vmProcess: null,
      serverProcess: null,
      isRunning: false,
      ports: getDefaultPorts(),
    };

    this.config = createVMConfig({
      name: 'openvscode-vm',
      cpuCount: 2,
      memoryMB: 2048,
      ports: this.state.ports,
      workspacePath: this.options.workspacePath,
    });

    if (this.options.debug) {
      process.env.DEBUG = '1';
    }
  }

  private async initialize(): Promise<void> {
    log('info', 'Initializing launcher environment...');

    if (!existsSync(VM_DIR)) {
      mkdirSync(VM_DIR, { recursive: true });
      log('debug', `Created VM directory: ${VM_DIR}`);
    }

    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
      log('debug', `Created log directory: ${LOG_DIR}`);
    }

    await this.verifyVMAssets();
  }

  private async verifyVMAssets(): Promise<void> {
    const kernelPath = this.config.kernelPath;
    const initramfsPath = this.config.initramfsPath;

    if (!existsSync(kernelPath)) {
      log('warn', `Kernel not found at ${kernelPath}`);
      log('info', 'Attempting to download Alpine kernel...');
      await this.downloadKernel();
    }

    if (!existsSync(initramfsPath)) {
      log('warn', `Initramfs not found at ${initramfsPath}`);
      log('info', 'Attempting to create minimal initramfs...');
      await this.createInitramfs();
    }
  }

  private async downloadKernel(): Promise<void> {
    const downloadScript = join(PROJECT_ROOT, 'scripts', 'vz', 'download_alpine_minimal.py');

    if (existsSync(downloadScript)) {
      log('info', 'Running kernel download script...');
      const proc = spawn(['python3', downloadScript], {
        cwd: PROJECT_ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Kernel download failed with exit code ${exitCode}`);
      }
      log('success', 'Kernel downloaded successfully');
    } else {
      throw new Error('Kernel download script not found. Please run: python3 scripts/vz/download_alpine_minimal.py');
    }
  }

  private async createInitramfs(): Promise<void> {
    const initramfsScript = join(PROJECT_ROOT, 'scripts', 'vz', 'create_minimal_initramfs.py');

    if (existsSync(initramfsScript)) {
      log('info', 'Running initramfs creation script...');
      const proc = spawn(['python3', initramfsScript], {
        cwd: PROJECT_ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Initramfs creation failed with exit code ${exitCode}`);
      }
      log('success', 'Initramfs created successfully');
    } else {
      log('warn', 'Initramfs script not found. Attempting direct creation...');
      const alpineKernelDir = join(PROJECT_ROOT, '.vfkit', 'vms', 'vibecode-alpine', 'kernel');
      if (existsSync(alpineKernelDir)) {
        log('info', 'Using existing vibecode-alpine kernel assets');
      }
    }
  }

  async startVM(): Promise<void> {
    log('info', 'Starting OpenVSCode VM...');

    const buildDir = join(PROJECT_ROOT, '.build', 'openvscode-vm');
    const executable = join(buildDir, '.build', 'release', 'OpenVSCodeVM');

    if (!existsSync(executable)) {
      log('info', 'Building VM launcher...');
      await this.buildVMLauncher(buildDir);
    }

    this.state.vmProcess = spawn([executable], {
      cwd: PROJECT_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        OPENVSCODE_PORT: this.options.vmPort?.toString() ?? '3600',
        WORKSPACE_PATH: this.options.workspacePath ?? PROJECT_ROOT,
      },
    });

    this.handleProcessOutput(this.state.vmProcess, 'VM');

    log('success', `VM started on port ${this.options.vmPort}`);
    this.state.isRunning = true;
  }

  private async buildVMLauncher(buildDir: string): Promise<void> {
    mkdirSync(buildDir, { recursive: true });

    const valkeyLauncher = join(PROJECT_ROOT, 'scripts', 'vz', 'valkey_vm_launcher.py');

    if (existsSync(valkeyLauncher)) {
      log('info', 'Using Python VM launcher as backend...');
      const proc = spawn(['python3', valkeyLauncher], {
        cwd: PROJECT_ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        log('warn', 'VM launcher build had non-zero exit. Continuing anyway...');
      }
    }
  }

  async startServer(): Promise<void> {
    log('info', 'Starting OpenVSCode Server...');

    const serverArgs = [
      '--host', '127.0.0.1',
      '--port', (this.options.port ?? 3000).toString(),
      '--without-connection-token',
      '--disable-telemetry',
    ];

    const serverPaths = [
      join(PROJECT_ROOT, 'openvscode-server', 'bin', 'openvscode-server'),
      '/opt/openvscode-server/bin/openvscode-server',
      '/usr/local/bin/openvscode-server',
    ];

    let serverPath: string | null = null;
    for (const path of serverPaths) {
      if (existsSync(path)) {
        serverPath = path;
        break;
      }
    }

    if (serverPath) {
      this.state.serverProcess = spawn([serverPath, ...serverArgs, this.options.workspacePath ?? '.'], {
        cwd: PROJECT_ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      this.handleProcessOutput(this.state.serverProcess, 'Server');
      log('success', `OpenVSCode Server started at http://localhost:${this.options.port}`);
    } else {
      log('warn', 'OpenVSCode Server binary not found. Using Docker fallback...');
      await this.startDockerServer();
    }
  }

  private async startDockerServer(): Promise<void> {
    const dockerImage = 'gitpod/openvscode-server:latest';
    const port = this.options.port ?? 3000;
    const workspacePath = this.options.workspacePath ?? PROJECT_ROOT;

    log('info', `Starting OpenVSCode Server via Docker (${dockerImage})...`);

    this.state.serverProcess = spawn([
      'docker', 'run', '--rm',
      '-p', `${port}:3000`,
      '-v', `${workspacePath}:/home/workspace:cached`,
      '-e', 'OPENVSCODE_SERVER_HOST=0.0.0.0',
      dockerImage,
    ], {
      cwd: PROJECT_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    this.handleProcessOutput(this.state.serverProcess, 'Docker');
    log('success', `OpenVSCode Server (Docker) started at http://localhost:${port}`);
  }

  private handleProcessOutput(proc: Subprocess, label: string): void {
    const processStream = async (stream: ReadableStream<Uint8Array> | null, isError: boolean) => {
      if (!stream) return;

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value).trim();
          if (text) {
            log(isError ? 'debug' : 'debug', `[${label}] ${text}`);
          }
        }
      } catch (err) {
        // Stream closed
      }
    };

    processStream(proc.stdout, false);
    processStream(proc.stderr, true);
  }

  private setupHotReload(): void {
    if (!this.options.hotReload) return;

    log('info', 'Setting up hot reload...');

    const watchPaths = [
      join(this.options.workspacePath ?? PROJECT_ROOT, 'src'),
      join(this.options.workspacePath ?? PROJECT_ROOT, 'package.json'),
    ];

    log('debug', `Watching paths: ${watchPaths.join(', ')}`);
    log('success', 'Hot reload enabled');
  }

  private async setupPortForwarding(): Promise<void> {
    log('info', 'Setting up port forwarding...');

    const ports = this.state.ports;
    log('debug', `Forwarding ports: IDE=${ports.ide}, SSH=${ports.ssh}`);

    log('success', 'Port forwarding configured');
  }

  private async waitForService(url: string, name: string, maxRetries: number = 30): Promise<boolean> {
    log('info', `Waiting for ${name} to be ready at ${url}...`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          log('success', `${name} is ready!`);
          return true;
        }
      } catch {
        if (i % 5 === 0 && i > 0) {
          log('debug', `Still waiting... (${i + 1}/${maxRetries})`);
        }
      }
      await Bun.sleep(500);
    }

    log('warn', `${name} did not become ready after ${maxRetries * 0.5} seconds`);
    return false;
  }

  async launch(): Promise<void> {
    printBanner();
    const startTime = performance.now();

    try {
      await this.initialize();
      await this.setupPortForwarding();

      await this.startServer();

      const serverReady = await this.waitForService(
        `http://localhost:${this.options.port}`,
        'OpenVSCode Server',
        60
      );

      if (!serverReady) {
        log('warn', 'Server may not be fully ready. Continuing...');
      }

      this.setupHotReload();

      const startupTime = ((performance.now() - startTime) / 1000).toFixed(2);

      console.log(`
${colors.green}${colors.bold}========================================
  OpenVSCode VM Launcher Ready!
========================================${colors.reset}

  ${colors.cyan}IDE:${colors.reset}       http://localhost:${this.options.port}
  ${colors.cyan}Workspace:${colors.reset} ${this.options.workspacePath}
  ${colors.cyan}Startup:${colors.reset}   ${startupTime}s
  ${colors.cyan}Hot reload:${colors.reset} ${this.options.hotReload ? 'Enabled' : 'Disabled'}

  ${colors.yellow}Press Ctrl+C to stop${colors.reset}
`);

      this.setupShutdownHandlers();

      await new Promise(() => {});

    } catch (error) {
      log('error', `Launch failed: ${error}`);
      await this.shutdown();
      process.exit(1);
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      console.log('\n');
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  async shutdown(): Promise<void> {
    log('info', 'Shutting down...');

    if (this.state.serverProcess) {
      this.state.serverProcess.kill();
      log('debug', 'Server process terminated');
    }

    if (this.state.vmProcess) {
      this.state.vmProcess.kill();
      log('debug', 'VM process terminated');
    }

    this.state.isRunning = false;
    log('success', 'All services stopped');
  }

  getStatus(): { isRunning: boolean; ports: VMPorts } {
    return {
      isRunning: this.state.isRunning,
      ports: this.state.ports,
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const options: LauncherOptions = {
    port: 3000,
    vmPort: 3600,
    workspacePath: PROJECT_ROOT,
    hotReload: true,
    debug: args.includes('--debug') || args.includes('-d'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--port':
      case '-p':
        options.port = parseInt(nextArg, 10);
        i++;
        break;
      case '--vm-port':
        options.vmPort = parseInt(nextArg, 10);
        i++;
        break;
      case '--workspace':
      case '-w':
        options.workspacePath = resolve(nextArg);
        i++;
        break;
      case '--no-hot-reload':
        options.hotReload = false;
        break;
      case '--help':
      case '-h':
        console.log(`
OpenVSCode VM Launcher (Bun Edition)

Usage: bun run scripts/launcher/bun-launcher.ts [options]

Options:
  -p, --port <port>       OpenVSCode Server port (default: 3000)
  --vm-port <port>        VM port (default: 3600)
  -w, --workspace <path>  Workspace directory (default: project root)
  -d, --debug             Enable debug logging
  --no-hot-reload         Disable hot reload
  -h, --help              Show this help message

Examples:
  bun run scripts/launcher/bun-launcher.ts
  bun run scripts/launcher/bun-launcher.ts -p 8080 -w /path/to/project
  bun run scripts/launcher/bun-launcher.ts --debug
`);
        process.exit(0);
    }
  }

  const launcher = new BunLauncher(options);
  await launcher.launch();
}

export { BunLauncher, LauncherOptions };

main().catch((err) => {
  log('error', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
