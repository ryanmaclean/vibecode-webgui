/**
 * Docker/Colima Detection Service
 *
 * Detects Docker Desktop, Colima, Podman, or other container runtimes
 * on macOS, Linux, and Windows systems.
 *
 * This module provides backend logic that can be used in:
 * - Next.js API routes (current)
 * - Tauri backend (future integration)
 * - CLI tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export enum DockerType {
  DockerDesktop = 'DockerDesktop',
  Colima = 'Colima',
  Podman = 'Podman',
  NotInstalled = 'NotInstalled',
}

export interface DockerStatus {
  dockerType: DockerType;
  version?: string;
  running: boolean;
  socketPath?: string;
  contextName?: string;
}

export interface ContainerRuntime {
  type: DockerType;
  command: string;
  socketPath: string;
}

/**
 * Detects the active container runtime
 */
export async function detectDockerRuntime(): Promise<DockerStatus> {
  const runtimes: ContainerRuntime[] = getPossibleRuntimes();

  for (const runtime of runtimes) {
    const status = await checkRuntime(runtime);
    if (status.running) {
      return status;
    }
  }

  // No running runtime found
  return {
    dockerType: DockerType.NotInstalled,
    running: false,
  };
}

/**
 * Gets list of possible container runtimes based on OS
 */
function getPossibleRuntimes(): ContainerRuntime[] {
  const os = platform();
  const home = homedir();

  const runtimes: ContainerRuntime[] = [];

  // Docker Desktop (all platforms)
  runtimes.push({
    type: DockerType.DockerDesktop,
    command: 'docker',
    socketPath: getDockerDesktopSocket(os),
  });

  // Colima (macOS and Linux)
  if (os === 'darwin' || os === 'linux') {
    runtimes.push({
      type: DockerType.Colima,
      command: 'docker',
      socketPath: join(home, '.colima', 'default', 'docker.sock'),
    });
  }

  // Podman (all platforms)
  runtimes.push({
    type: DockerType.Podman,
    command: 'podman',
    socketPath: getPodmanSocket(os, home),
  });

  return runtimes;
}

/**
 * Gets Docker Desktop socket path based on OS
 */
function getDockerDesktopSocket(os: string): string {
  switch (os) {
    case 'darwin':
      return '/var/run/docker.sock';
    case 'linux':
      return '/var/run/docker.sock';
    case 'win32':
      return '//./pipe/docker_engine';
    default:
      return '/var/run/docker.sock';
  }
}

/**
 * Gets Podman socket path based on OS
 */
function getPodmanSocket(os: string, home: string): string {
  switch (os) {
    case 'darwin':
      return join(home, '.local', 'share', 'containers', 'podman', 'machine', 'podman.sock');
    case 'linux':
      return `/run/user/${process.getuid?.() ?? 1000}/podman/podman.sock`;
    case 'win32':
      return '//./pipe/podman-machine-default';
    default:
      return join(home, '.local', 'share', 'containers', 'podman', 'podman.sock');
  }
}

/**
 * Checks if a specific runtime is available and running
 */
async function checkRuntime(runtime: ContainerRuntime): Promise<DockerStatus> {
  try {
    // First check if socket/pipe exists
    if (runtime.socketPath && !existsSync(runtime.socketPath)) {
      return {
        dockerType: runtime.type,
        running: false,
      };
    }

    // Try to execute version command
    const { stdout, stderr } = await execAsync(`${runtime.command} version --format '{{.Server.Version}}'`);

    if (stderr && !stdout) {
      return {
        dockerType: runtime.type,
        running: false,
      };
    }

    const version = stdout.trim();

    // Get context information for Docker
    let contextName: string | undefined;
    if (runtime.command === 'docker') {
      try {
        const contextResult = await execAsync('docker context show');
        contextName = contextResult.stdout.trim();
      } catch {
        // Context command failed, not critical
      }
    }

    // Determine actual type based on context
    const actualType = determineDockerType(runtime.type, contextName, runtime.socketPath);

    return {
      dockerType: actualType,
      version,
      running: true,
      socketPath: runtime.socketPath,
      contextName,
    };
  } catch (error) {
    return {
      dockerType: runtime.type,
      running: false,
    };
  }
}

/**
 * Determines the actual Docker type based on context and socket path
 */
function determineDockerType(
  defaultType: DockerType,
  contextName: string | undefined,
  socketPath: string
): DockerType {
  // Check if using Colima context
  if (contextName?.includes('colima')) {
    return DockerType.Colima;
  }

  // Check if socket path indicates Colima
  if (socketPath.includes('.colima')) {
    return DockerType.Colima;
  }

  // Check if using Docker Desktop context
  if (contextName === 'desktop-linux' || contextName === 'default') {
    return DockerType.DockerDesktop;
  }

  return defaultType;
}

/**
 * Checks if Docker/Colima is installed but not running
 */
export async function isDockerInstalled(): Promise<boolean> {
  try {
    // Check for docker command
    await execAsync('which docker');
    return true;
  } catch {
    try {
      // Check for colima command
      await execAsync('which colima');
      return true;
    } catch {
      try {
        // Check for podman command
        await execAsync('which podman');
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Gets Docker daemon status
 */
export async function getDockerDaemonStatus(): Promise<{
  accessible: boolean;
  error?: string;
}> {
  try {
    await execAsync('docker info');
    return { accessible: true };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Lists available Docker contexts
 */
export async function listDockerContexts(): Promise<
  Array<{
    name: string;
    current: boolean;
    dockerEndpoint: string;
  }>
> {
  try {
    const { stdout } = await execAsync('docker context ls --format "{{.Name}}|{{.Current}}|{{.DockerEndpoint}}"');

    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [name, current, dockerEndpoint] = line.split('|');
        return {
          name,
          current: current === 'true',
          dockerEndpoint,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Attempts to start Colima if installed but not running
 */
export async function startColima(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Check if Colima is installed
    await execAsync('which colima');

    // Start Colima with default settings
    await execAsync('colima start --cpu 4 --memory 8 --disk 100');

    return {
      success: true,
      message: 'Colima started successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start Colima',
    };
  }
}

/**
 * Comprehensive Docker status report
 */
export async function getDockerStatusReport(): Promise<{
  runtime: DockerStatus;
  installed: boolean;
  daemonStatus: { accessible: boolean; error?: string };
  contexts: Array<{ name: string; current: boolean; dockerEndpoint: string }>;
}> {
  const [runtime, installed, daemonStatus, contexts] = await Promise.all([
    detectDockerRuntime(),
    isDockerInstalled(),
    getDockerDaemonStatus(),
    listDockerContexts(),
  ]);

  return {
    runtime,
    installed,
    daemonStatus,
    contexts,
  };
}
