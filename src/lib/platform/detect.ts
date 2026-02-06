/**
 * Platform Detection Module for VibeCode
 *
 * Detects the operating system, architecture, and available capabilities.
 * Provides platform-specific configuration and setup instructions.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Supported operating systems
 */
export type OperatingSystem = 'linux' | 'macos' | 'windows' | 'unknown';

/**
 * Supported architectures
 */
export type Architecture = 'x64' | 'arm64' | 'unknown';

/**
 * Linux distribution information
 */
export interface LinuxDistroInfo {
  id: string;
  name: string;
  version: string;
  versionCodename?: string;
  prettyName: string;
}

/**
 * Platform capabilities
 */
export interface PlatformCapabilities {
  hasDocker: boolean;
  hasKvm: boolean;
  hasHypervisor: boolean;
  hasWsl: boolean;
  hasNode: boolean;
  hasGit: boolean;
  hasQemu: boolean;
  nodeVersion?: string;
  dockerVersion?: string;
}

/**
 * Display server types for Linux
 */
export type DisplayServer = 'x11' | 'wayland' | 'tty' | 'unknown';

/**
 * Complete platform information
 */
export interface PlatformInfo {
  os: OperatingSystem;
  arch: Architecture;
  distro?: LinuxDistroInfo;
  desktopEnvironment?: string;
  displayServer?: DisplayServer;
  capabilities: PlatformCapabilities;
  isTauri: boolean;
  isElectron: boolean;
  isBrowser: boolean;
}

/**
 * Detect the current operating system
 */
export function detectOS(): OperatingSystem {
  const platform = os.platform();

  switch (platform) {
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return 'unknown';
  }
}

/**
 * Detect the current architecture
 */
export function detectArch(): Architecture {
  const arch = os.arch();

  switch (arch) {
    case 'x64':
    case 'amd64':
      return 'x64';
    case 'arm64':
    case 'aarch64':
      return 'arm64';
    default:
      return 'unknown';
  }
}

/**
 * Parse /etc/os-release for Linux distribution info
 */
export function getLinuxDistroInfo(): LinuxDistroInfo | undefined {
  if (detectOS() !== 'linux') {
    return undefined;
  }

  try {
    const osReleasePath = '/etc/os-release';
    if (!fs.existsSync(osReleasePath)) {
      return undefined;
    }

    const content = fs.readFileSync(osReleasePath, 'utf-8');
    const lines = content.split('\n');
    const info: Record<string, string> = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        info[key] = valueParts.join('=').replace(/^"|"$/g, '');
      }
    }

    return {
      id: info['ID'] || 'unknown',
      name: info['NAME'] || 'Linux',
      version: info['VERSION_ID'] || 'unknown',
      versionCodename: info['VERSION_CODENAME'],
      prettyName: info['PRETTY_NAME'] || 'Linux',
    };
  } catch {
    return undefined;
  }
}

/**
 * Detect the desktop environment on Linux
 */
export function detectDesktopEnvironment(): string | undefined {
  if (detectOS() !== 'linux') {
    return undefined;
  }

  // Check environment variables first (safe, no command execution)
  const xdgDesktop = process.env.XDG_CURRENT_DESKTOP;
  if (xdgDesktop) {
    return xdgDesktop;
  }

  const desktopSession = process.env.DESKTOP_SESSION;
  if (desktopSession) {
    return desktopSession;
  }

  // Detect by running processes using execFileSync (safe from injection)
  const desktopProcesses: Record<string, string> = {
    'gnome-shell': 'GNOME',
    'plasmashell': 'KDE Plasma',
    'xfce4-session': 'XFCE',
    'cinnamon-session': 'Cinnamon',
    'mate-session': 'MATE',
    'lxqt-session': 'LXQt',
    'budgie-wm': 'Budgie',
    'sway': 'Sway',
    'i3': 'i3',
    'hyprland': 'Hyprland',
  };

  for (const [processName, deName] of Object.entries(desktopProcesses)) {
    try {
      const result = execFileSync('pgrep', ['-x', processName], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (result.trim()) {
        return deName;
      }
    } catch {
      // Process not found, continue
    }
  }

  return undefined;
}

/**
 * Detect the display server on Linux
 */
export function detectDisplayServer(): DisplayServer {
  if (detectOS() !== 'linux') {
    return 'unknown';
  }

  if (process.env.WAYLAND_DISPLAY) {
    return 'wayland';
  }

  if (process.env.DISPLAY) {
    return 'x11';
  }

  if (process.env.XDG_SESSION_TYPE === 'tty') {
    return 'tty';
  }

  return 'unknown';
}

/**
 * Check if a command exists using 'which' (Unix) or 'where' (Windows)
 * Uses execFileSync to prevent command injection
 */
function commandExists(command: string): boolean {
  const osType = detectOS();

  try {
    if (osType === 'windows') {
      execFileSync('where', [command], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } else {
      execFileSync('which', [command], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get command version using execFileSync (safe from injection)
 */
function getCommandVersion(command: string, versionArg = '--version'): string | undefined {
  try {
    const output = execFileSync(command, [versionArg], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

/**
 * Check if KVM is available and accessible
 */
export function checkKvmAvailable(): boolean {
  if (detectOS() !== 'linux') {
    return false;
  }

  try {
    // Check if /dev/kvm exists and is readable
    const kvmDevice = '/dev/kvm';
    if (!fs.existsSync(kvmDevice)) {
      return false;
    }

    // Try to access /dev/kvm
    fs.accessSync(kvmDevice, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Hypervisor.framework is available (macOS)
 */
export function checkHypervisorAvailable(): boolean {
  if (detectOS() !== 'macos') {
    return false;
  }

  try {
    const output = execFileSync('sysctl', ['-n', 'kern.hv_support'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.trim() === '1';
  } catch {
    return false;
  }
}

/**
 * Check if WSL is available (Windows)
 */
export function checkWslAvailable(): boolean {
  if (detectOS() !== 'windows') {
    return false;
  }

  try {
    execFileSync('wsl', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect platform capabilities
 */
export function detectCapabilities(): PlatformCapabilities {
  const osType = detectOS();

  return {
    hasDocker: commandExists('docker'),
    hasKvm: osType === 'linux' && checkKvmAvailable(),
    hasHypervisor: osType === 'macos' && checkHypervisorAvailable(),
    hasWsl: osType === 'windows' && checkWslAvailable(),
    hasNode: commandExists('node'),
    hasGit: commandExists('git'),
    hasQemu: commandExists('qemu-system-x86_64') || commandExists('qemu-system-aarch64'),
    nodeVersion: getCommandVersion('node', '--version'),
    dockerVersion: getCommandVersion('docker', '--version'),
  };
}

/**
 * Check if running in Tauri
 */
export function isTauriEnvironment(): boolean {
  // Check for Tauri-specific globals
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).__TAURI__) {
    return true;
  }

  // Check for Tauri environment variable
  if (process.env.TAURI_ENV_PLATFORM) {
    return true;
  }

  return false;
}

/**
 * Check if running in Electron
 */
export function isElectronEnvironment(): boolean {
  // Check for Electron process
  if (typeof process !== 'undefined' && process.versions && (process.versions as Record<string, unknown>).electron) {
    return true;
  }

  return false;
}

/**
 * Check if running in browser
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && !isTauriEnvironment() && !isElectronEnvironment();
}

/**
 * Get complete platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const osType = detectOS();

  return {
    os: osType,
    arch: detectArch(),
    distro: osType === 'linux' ? getLinuxDistroInfo() : undefined,
    desktopEnvironment: osType === 'linux' ? detectDesktopEnvironment() : undefined,
    displayServer: osType === 'linux' ? detectDisplayServer() : undefined,
    capabilities: detectCapabilities(),
    isTauri: isTauriEnvironment(),
    isElectron: isElectronEnvironment(),
    isBrowser: isBrowserEnvironment(),
  };
}

/**
 * Get setup instructions for the current platform
 */
export function getSetupInstructions(): string {
  const platformInfo = getPlatformInfo();
  let instructions = '# VibeCode Setup Instructions\n\n';

  switch (platformInfo.os) {
    case 'linux':
      instructions += getLinuxSetupInstructions(platformInfo);
      break;
    case 'macos':
      instructions += getMacOSSetupInstructions(platformInfo);
      break;
    case 'windows':
      instructions += getWindowsSetupInstructions(platformInfo);
      break;
    default:
      instructions += 'Unknown platform. Please refer to the documentation.\n';
  }

  return instructions;
}

/**
 * Get Linux-specific setup instructions
 */
function getLinuxSetupInstructions(platformInfo: PlatformInfo): string {
  const distroId = platformInfo.distro?.id || 'unknown';
  let instructions = `## Linux (${platformInfo.distro?.prettyName || 'Unknown Distribution'})\n\n`;

  // Package manager commands
  let installCmd = '';
  let updateCmd = '';

  switch (distroId) {
    case 'ubuntu':
    case 'debian':
    case 'pop':
    case 'linuxmint':
      updateCmd = 'sudo apt update';
      installCmd = 'sudo apt install';
      break;
    case 'fedora':
    case 'rhel':
    case 'centos':
    case 'rocky':
      updateCmd = 'sudo dnf check-update';
      installCmd = 'sudo dnf install';
      break;
    case 'arch':
    case 'manjaro':
    case 'endeavouros':
      updateCmd = 'sudo pacman -Sy';
      installCmd = 'sudo pacman -S';
      break;
    default:
      instructions += 'Please use your distribution\'s package manager to install:\n';
      instructions += '- qemu-system-x86 or qemu-kvm\n';
      instructions += '- docker and docker-compose\n';
      instructions += '- nodejs and npm\n';
      instructions += '- git\n\n';
      return instructions;
  }

  instructions += '### Install Dependencies\n\n```bash\n';
  instructions += `${updateCmd}\n\n`;

  // QEMU/KVM
  if (!platformInfo.capabilities.hasQemu || !platformInfo.capabilities.hasKvm) {
    switch (distroId) {
      case 'ubuntu':
      case 'debian':
      case 'pop':
      case 'linuxmint':
        instructions += '# Install QEMU/KVM\n';
        instructions += `${installCmd} qemu-system-x86 qemu-utils libvirt-daemon-system\n\n`;
        break;
      case 'fedora':
      case 'rhel':
      case 'centos':
      case 'rocky':
        instructions += '# Install QEMU/KVM\n';
        instructions += `${installCmd} qemu-kvm qemu-img libvirt\n\n`;
        break;
      case 'arch':
      case 'manjaro':
        instructions += '# Install QEMU/KVM\n';
        instructions += `${installCmd} qemu libvirt virt-manager\n\n`;
        break;
    }
  }

  // Docker
  if (!platformInfo.capabilities.hasDocker) {
    switch (distroId) {
      case 'ubuntu':
      case 'debian':
        instructions += '# Install Docker\n';
        instructions += `${installCmd} docker.io docker-compose\n`;
        instructions += 'sudo usermod -aG docker $USER\n\n';
        break;
      case 'fedora':
        instructions += '# Install Docker\n';
        instructions += `${installCmd} docker docker-compose\n`;
        instructions += 'sudo usermod -aG docker $USER\n\n';
        break;
      case 'arch':
        instructions += '# Install Docker\n';
        instructions += `${installCmd} docker docker-compose\n`;
        instructions += 'sudo usermod -aG docker $USER\n\n';
        break;
    }
  }

  // Node.js
  if (!platformInfo.capabilities.hasNode) {
    instructions += '# Install Node.js\n';
    instructions += `${installCmd} nodejs npm\n\n`;
  }

  instructions += '```\n\n';

  // KVM setup
  if (!platformInfo.capabilities.hasKvm) {
    instructions += '### Enable KVM Access\n\n```bash\n';
    instructions += '# Add user to kvm group\n';
    instructions += 'sudo usermod -aG kvm $USER\n\n';
    instructions += '# Load KVM modules\n';
    instructions += 'sudo modprobe kvm\n';
    instructions += 'sudo modprobe kvm_intel  # For Intel CPUs\n';
    instructions += '# OR\n';
    instructions += 'sudo modprobe kvm_amd    # For AMD CPUs\n\n';
    instructions += '# Log out and back in for changes to take effect\n';
    instructions += '```\n\n';
  }

  return instructions;
}

/**
 * Get macOS-specific setup instructions
 */
function getMacOSSetupInstructions(platformInfo: PlatformInfo): string {
  let instructions = '## macOS Setup\n\n';

  instructions += '### Install Dependencies\n\n```bash\n';

  if (!platformInfo.capabilities.hasDocker) {
    instructions += '# Install Docker Desktop\n';
    instructions += 'brew install --cask docker\n\n';
  }

  if (!platformInfo.capabilities.hasNode) {
    instructions += '# Install Node.js\n';
    instructions += 'brew install node\n\n';
  }

  if (!platformInfo.capabilities.hasGit) {
    instructions += '# Install Git\n';
    instructions += 'brew install git\n\n';
  }

  instructions += '```\n\n';

  if (!platformInfo.capabilities.hasHypervisor) {
    instructions += '### Note on Virtualization\n\n';
    instructions += 'VibeCode uses Apple\'s Hypervisor.framework for VM support on macOS.\n';
    instructions += 'This is built into macOS 10.10+ and requires no additional setup.\n\n';
  }

  return instructions;
}

/**
 * Get Windows-specific setup instructions
 */
function getWindowsSetupInstructions(platformInfo: PlatformInfo): string {
  let instructions = '## Windows Setup\n\n';

  if (!platformInfo.capabilities.hasWsl) {
    instructions += '### Install WSL 2\n\n```powershell\n';
    instructions += '# Open PowerShell as Administrator\n';
    instructions += 'wsl --install\n\n';
    instructions += '# After restart, set WSL 2 as default\n';
    instructions += 'wsl --set-default-version 2\n';
    instructions += '```\n\n';
  }

  if (!platformInfo.capabilities.hasDocker) {
    instructions += '### Install Docker Desktop\n\n';
    instructions += '1. Download Docker Desktop from https://www.docker.com/products/docker-desktop\n';
    instructions += '2. Run the installer\n';
    instructions += '3. Enable WSL 2 backend in Docker Desktop settings\n\n';
  }

  instructions += '### Install Development Tools\n\n```powershell\n';
  instructions += '# Using winget\n';

  if (!platformInfo.capabilities.hasGit) {
    instructions += 'winget install Git.Git\n';
  }

  if (!platformInfo.capabilities.hasNode) {
    instructions += 'winget install OpenJS.NodeJS.LTS\n';
  }

  instructions += '```\n\n';

  return instructions;
}

/**
 * Check if all required dependencies are installed
 */
export function checkAllRequirements(): { satisfied: boolean; missing: string[] } {
  const platformInfo = getPlatformInfo();
  const missing: string[] = [];

  if (!platformInfo.capabilities.hasDocker) {
    missing.push('Docker');
  }

  if (!platformInfo.capabilities.hasNode) {
    missing.push('Node.js');
  }

  if (!platformInfo.capabilities.hasGit) {
    missing.push('Git');
  }

  // Platform-specific requirements
  if (platformInfo.os === 'linux' && !platformInfo.capabilities.hasKvm) {
    missing.push('KVM (for VM support)');
  }

  if (platformInfo.os === 'windows' && !platformInfo.capabilities.hasWsl) {
    missing.push('WSL 2 (for Linux container support)');
  }

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

// Export a singleton for easy access
export const platform = getPlatformInfo();
