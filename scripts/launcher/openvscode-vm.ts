/**
 * OpenVSCode VM Configuration
 *
 * Configuration types and utilities for running OpenVSCode Server
 * in a lightweight VM using Apple Virtualization Framework.
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = resolve(import.meta.dir, '..', '..');
const DEFAULT_VFKIT_DIR = join(PROJECT_ROOT, '.vfkit', 'vms');

export interface VMPorts {
  ide: number;
  ssh: number;
  debug: number;
  health: number;
}

export interface VMResources {
  cpuCount: number;
  memoryMB: number;
  diskSizeMB?: number;
}

export interface VMNetwork {
  type: 'nat' | 'bridged' | 'host-only';
  macAddress?: string;
  portForwarding: boolean;
  portMappings?: Array<{ host: number; guest: number; protocol?: 'tcp' | 'udp' }>;
}

export interface OpenVSCodeServerConfig {
  host: string;
  port: number;
  disableConnectionToken: boolean;
  disableTelemetry: boolean;
  extensions?: string[];
  workspacePath: string;
}

export interface OpenVSCodeVMConfig {
  name: string;
  vmDirectory: string;
  kernelPath: string;
  initramfsPath: string;
  diskPath?: string;
  kernelArgs: string;
  resources: VMResources;
  network: VMNetwork;
  ports: VMPorts;
  server: OpenVSCodeServerConfig;
  enableConsoleLogging: boolean;
  logDirectory: string;
}

export function getDefaultPorts(): VMPorts {
  return {
    ide: 3000,
    ssh: 2222,
    debug: 9229,
    health: 8080,
  };
}

export function getDefaultResources(): VMResources {
  return {
    cpuCount: 2,
    memoryMB: 2048,
    diskSizeMB: 4096,
  };
}

export function getDefaultNetwork(ports: VMPorts): VMNetwork {
  return {
    type: 'nat',
    portForwarding: true,
    portMappings: [
      { host: ports.ide, guest: 3000, protocol: 'tcp' },
      { host: ports.ssh, guest: 22, protocol: 'tcp' },
      { host: ports.debug, guest: 9229, protocol: 'tcp' },
      { host: ports.health, guest: 8080, protocol: 'tcp' },
    ],
  };
}

export function getDefaultServerConfig(workspacePath?: string): OpenVSCodeServerConfig {
  return {
    host: '0.0.0.0',
    port: 3000,
    disableConnectionToken: true,
    disableTelemetry: true,
    extensions: [
      'ms-vscode.vscode-typescript-next',
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
    ],
    workspacePath: workspacePath ?? '/workspace',
  };
}

export interface CreateVMConfigOptions {
  name: string;
  cpuCount?: number;
  memoryMB?: number;
  ports?: Partial<VMPorts>;
  workspacePath?: string;
  vmBaseDirectory?: string;
  kernelPath?: string;
  initramfsPath?: string;
}

export function createVMConfig(options: CreateVMConfigOptions): OpenVSCodeVMConfig {
  const vmBaseDir = options.vmBaseDirectory ?? DEFAULT_VFKIT_DIR;
  const vmDir = join(vmBaseDir, options.name);

  const alpineKernelDir = join(vmBaseDir, 'vibecode-alpine', 'kernel');
  const defaultKernelPath = join(alpineKernelDir, 'vmlinuz');
  const defaultInitramfsPath = join(alpineKernelDir, 'initramfs');

  const ports: VMPorts = {
    ...getDefaultPorts(),
    ...options.ports,
  };

  const resources: VMResources = {
    ...getDefaultResources(),
    cpuCount: options.cpuCount ?? getDefaultResources().cpuCount,
    memoryMB: options.memoryMB ?? getDefaultResources().memoryMB,
  };

  return {
    name: options.name,
    vmDirectory: vmDir,
    kernelPath: options.kernelPath ?? defaultKernelPath,
    initramfsPath: options.initramfsPath ?? defaultInitramfsPath,
    diskPath: join(vmDir, 'disk', 'root.img'),
    kernelArgs: buildKernelArgs(ports),
    resources,
    network: getDefaultNetwork(ports),
    ports,
    server: getDefaultServerConfig(options.workspacePath),
    enableConsoleLogging: true,
    logDirectory: join(vmDir, 'logs'),
  };
}

function buildKernelArgs(ports: VMPorts): string {
  const args = [
    'console=hvc0',
    'root=/dev/vda',
    'rw',
    'quiet',
    `openvscode_port=${ports.ide}`,
    'init=/init',
  ];
  return args.join(' ');
}

export function validateConfig(config: OpenVSCodeVMConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!existsSync(config.kernelPath)) {
    errors.push(`Kernel not found: ${config.kernelPath}`);
  }

  if (!existsSync(config.initramfsPath)) {
    errors.push(`Initramfs not found: ${config.initramfsPath}`);
  }

  if (config.resources.cpuCount < 1 || config.resources.cpuCount > 8) {
    errors.push(`Invalid CPU count: ${config.resources.cpuCount} (must be 1-8)`);
  }

  if (config.resources.memoryMB < 512 || config.resources.memoryMB > 16384) {
    errors.push(`Invalid memory: ${config.resources.memoryMB}MB (must be 512-16384MB)`);
  }

  const portValues = [config.ports.ide, config.ports.ssh, config.ports.debug, config.ports.health];
  const uniquePorts = new Set(portValues);
  if (uniquePorts.size !== portValues.length) {
    errors.push('Port conflict: all ports must be unique');
  }

  for (const port of portValues) {
    if (port < 1 || port > 65535) {
      errors.push(`Invalid port number: ${port}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function generateSwiftConfig(config: OpenVSCodeVMConfig): string {
  return `
import Foundation
import Virtualization

struct OpenVSCodeVMConfig {
    let name: String = "${config.name}"
    let cpuCount: Int = ${config.resources.cpuCount}
    let memorySize: UInt64 = ${config.resources.memoryMB} * 1024 * 1024
    let kernelPath: String = "${config.kernelPath}"
    let initramfsPath: String = "${config.initramfsPath}"
    let kernelArgs: String = "${config.kernelArgs}"
    let vmDirectory: URL = URL(fileURLWithPath: "${config.vmDirectory}")
    let logDirectory: URL = URL(fileURLWithPath: "${config.logDirectory}")

    let idePort: Int = ${config.ports.ide}
    let sshPort: Int = ${config.ports.ssh}
    let debugPort: Int = ${config.ports.debug}
    let healthPort: Int = ${config.ports.health}
}
`.trim();
}

export function generatePackageSwift(): string {
  return `
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenVSCodeVM",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "OpenVSCodeVM",
            path: "Sources"
        )
    ]
)
`.trim();
}

export function generateEntitlements(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
</dict>
</plist>`;
}

export const SIZE_COMPARISON = {
  bunBuild: {
    size: '97 MB',
    description: 'Bun-based ultra-minimal build (working)',
    target: '14 MB',
  },
  currentMain: {
    size: '~175 MB',
    description: 'Current main branch build',
  },
  savings: '45% reduction (97MB vs 175MB)',
} as const;

export const PERFORMANCE_COMPARISON = {
  bunStartup: {
    time: '~100ms',
    description: 'Bun runtime initialization',
  },
  nodeStartup: {
    time: '~1000ms',
    description: 'Node.js runtime initialization',
  },
  improvement: '10x faster startup',
} as const;

export type { OpenVSCodeVMConfig, VMPorts, VMResources, VMNetwork, OpenVSCodeServerConfig };
