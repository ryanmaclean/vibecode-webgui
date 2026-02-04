/**
 * OpenVSCode VM Configuration
 *
 * Configuration types and utilities for running OpenVSCode Server
 * in a lightweight VM using Apple Virtualization Framework.
 *
 * This module provides:
 * - VM configuration types and defaults
 * - Port forwarding configuration
 * - Resource allocation settings
 * - Integration with Apple VZ framework
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';

// Project root for default paths
const PROJECT_ROOT = resolve(import.meta.dir, '..', '..');
const DEFAULT_VFKIT_DIR = join(PROJECT_ROOT, '.vfkit', 'vms');

/**
 * VM port configuration
 */
export interface VMPorts {
  /** OpenVSCode Server IDE port */
  ide: number;
  /** SSH port for remote access */
  ssh: number;
  /** Debug port for remote debugging */
  debug: number;
  /** Health check endpoint port */
  health: number;
}

/**
 * VM resource configuration
 */
export interface VMResources {
  /** Number of virtual CPUs */
  cpuCount: number;
  /** Memory allocation in megabytes */
  memoryMB: number;
  /** Disk size in megabytes (optional, uses overlay by default) */
  diskSizeMB?: number;
}

/**
 * VM network configuration
 */
export interface VMNetwork {
  /** Network attachment type */
  type: 'nat' | 'bridged' | 'host-only';
  /** MAC address (auto-generated if not specified) */
  macAddress?: string;
  /** Enable port forwarding */
  portForwarding: boolean;
  /** Port mappings (host:guest) */
  portMappings?: Array<{ host: number; guest: number; protocol?: 'tcp' | 'udp' }>;
}

/**
 * OpenVSCode Server configuration within VM
 */
export interface OpenVSCodeServerConfig {
  /** Server host binding */
  host: string;
  /** Server port */
  port: number;
  /** Disable connection token for local development */
  disableConnectionToken: boolean;
  /** Disable telemetry */
  disableTelemetry: boolean;
  /** Extensions to pre-install */
  extensions?: string[];
  /** Workspace path inside VM */
  workspacePath: string;
}

/**
 * Complete VM configuration for OpenVSCode
 */
export interface OpenVSCodeVMConfig {
  /** VM name identifier */
  name: string;
  /** VM directory path */
  vmDirectory: string;
  /** Path to Linux kernel (vmlinuz) */
  kernelPath: string;
  /** Path to initramfs */
  initramfsPath: string;
  /** Path to root disk image (optional) */
  diskPath?: string;
  /** Kernel command line arguments */
  kernelArgs: string;
  /** Resource allocation */
  resources: VMResources;
  /** Network configuration */
  network: VMNetwork;
  /** Port configuration */
  ports: VMPorts;
  /** OpenVSCode Server settings */
  server: OpenVSCodeServerConfig;
  /** Enable console output logging */
  enableConsoleLogging: boolean;
  /** Log directory path */
  logDirectory: string;
}

/**
 * Get default port configuration
 */
export function getDefaultPorts(): VMPorts {
  return {
    ide: 3000,
    ssh: 2222,
    debug: 9229,
    health: 8080,
  };
}

/**
 * Get default resource configuration
 */
export function getDefaultResources(): VMResources {
  return {
    cpuCount: 2,
    memoryMB: 2048,
    diskSizeMB: 4096,
  };
}

/**
 * Get default network configuration with port forwarding
 */
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

/**
 * Get default OpenVSCode Server configuration
 */
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

/**
 * Configuration options for creating a VM config
 */
export interface CreateVMConfigOptions {
  /** VM name */
  name: string;
  /** Number of CPUs */
  cpuCount?: number;
  /** Memory in MB */
  memoryMB?: number;
  /** Custom ports */
  ports?: Partial<VMPorts>;
  /** Workspace path on host */
  workspacePath?: string;
  /** VM base directory */
  vmBaseDirectory?: string;
  /** Custom kernel path */
  kernelPath?: string;
  /** Custom initramfs path */
  initramfsPath?: string;
}

/**
 * Create a complete VM configuration with sensible defaults
 */
export function createVMConfig(options: CreateVMConfigOptions): OpenVSCodeVMConfig {
  const vmBaseDir = options.vmBaseDirectory ?? DEFAULT_VFKIT_DIR;
  const vmDir = join(vmBaseDir, options.name);

  // Use vibecode-alpine kernel as default (shared across VMs)
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

/**
 * Build kernel command line arguments
 */
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

/**
 * Validate VM configuration
 */
export function validateConfig(config: OpenVSCodeVMConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check kernel exists
  if (!existsSync(config.kernelPath)) {
    errors.push(`Kernel not found: ${config.kernelPath}`);
  }

  // Check initramfs exists
  if (!existsSync(config.initramfsPath)) {
    errors.push(`Initramfs not found: ${config.initramfsPath}`);
  }

  // Validate resources
  if (config.resources.cpuCount < 1 || config.resources.cpuCount > 8) {
    errors.push(`Invalid CPU count: ${config.resources.cpuCount} (must be 1-8)`);
  }

  if (config.resources.memoryMB < 512 || config.resources.memoryMB > 16384) {
    errors.push(`Invalid memory: ${config.resources.memoryMB}MB (must be 512-16384MB)`);
  }

  // Validate ports
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

/**
 * Generate Swift code for VM configuration
 * Used to create the Swift Package for Apple VZ integration
 */
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

    // Port mappings
    let idePort: Int = ${config.ports.ide}
    let sshPort: Int = ${config.ports.ssh}
    let debugPort: Int = ${config.ports.debug}
    let healthPort: Int = ${config.ports.health}
}
`.trim();
}

/**
 * Generate Package.swift for VM launcher
 */
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

/**
 * Generate entitlements.plist for VM virtualization
 */
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

/**
 * Size comparison with current builds
 * Based on issue #1157 findings
 */
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

/**
 * Performance comparison
 */
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

// Export types for external use
export type { OpenVSCodeVMConfig, VMPorts, VMResources, VMNetwork, OpenVSCodeServerConfig };
