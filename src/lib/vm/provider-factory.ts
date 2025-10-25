/**
 * VM Provider Factory
 * Auto-detects and creates appropriate VM provider for current platform
 */

import { VMProvider, SystemInfo } from './types';
import { VfkitProvider } from './providers/vfkit';
import { LimaProvider } from './providers/lima';
import { QEMUProvider } from './providers/qemu';
import { WSL2Provider } from './providers/wsl2';
import { logger } from '@/lib/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export class ProviderFactory {
  /**
   * Auto-detect and return best VM provider for current platform
   */
  static async detectProvider(): Promise<VMProvider> {
    const sysInfo = await this.getSystemInfo();
    
    logger.info('Detecting VM provider', { sysInfo });
    
    // macOS
    if (sysInfo.os === 'darwin') {
      // Apple Silicon: Try vfkit first (best performance)
      if (sysInfo.isAppleSilicon) {
        if (await this.hasVfkit()) {
          logger.info('Using vfkit provider (Apple Silicon)');
          return new VfkitProvider();
        }
      }
      
      // Fallback to Lima (works on both Intel and Apple Silicon)
      if (await this.hasLima()) {
        logger.info('Using Lima provider (macOS)');
        return new LimaProvider();
      }
      
      throw new Error('No VM provider found. Install vfkit or Lima:\n' +
        '  brew install vfkit\n' +
        '  brew install lima');
    }
    
    // Linux
    if (sysInfo.os === 'linux') {
      // Try KVM/QEMU first (best performance on Linux)
      if (await this.hasKVM()) {
        logger.info('Using QEMU with KVM acceleration');
        return new QEMUProvider({ kvm: true });
      }
      
      // Fallback to Lima
      if (await this.hasLima()) {
        logger.info('Using Lima provider (Linux)');
        return new LimaProvider();
      }
      
      // Fallback to QEMU without KVM
      if (await this.hasQEMU()) {
        logger.warn('Using QEMU without KVM (slower performance)');
        return new QEMUProvider({ kvm: false });
      }
      
      throw new Error('No VM provider found. Install QEMU or Lima:\n' +
        '  sudo apt install qemu-system-aarch64 qemu-kvm  # Debian/Ubuntu\n' +
        '  sudo dnf install qemu-kvm  # Fedora\n' +
        '  Or install Lima: https://lima-vm.io/');
    }
    
    // Windows
    if (sysInfo.os === 'win32') {
      // Try WSL2 first
      if (await this.hasWSL2()) {
        logger.info('Using WSL2 provider');
        return new WSL2Provider();
      }
      
      // Fallback to QEMU
      if (await this.hasQEMU()) {
        logger.info('Using QEMU provider (Windows)');
        return new QEMUProvider({ kvm: false });
      }
      
      throw new Error('No VM provider found. Install WSL2 or QEMU:\n' +
        '  wsl --install\n' +
        '  Or download QEMU: https://www.qemu.org/download/');
    }
    
    // BSD
    if (sysInfo.os === 'freebsd') {
      // Try bhyve first (native BSD hypervisor)
      if (await this.hasBhyve()) {
        logger.info('Using bhyve provider (FreeBSD)');
        // TODO: Implement BhyveProvider
        throw new Error('bhyve provider not yet implemented');
      }
      
      // Fallback to QEMU
      if (await this.hasQEMU()) {
        logger.info('Using QEMU provider (BSD)');
        return new QEMUProvider({ kvm: false });
      }
      
      throw new Error('No VM provider found. Install QEMU:\n' +
        '  pkg install qemu');
    }
    
    throw new Error(`Unsupported platform: ${sysInfo.os}`);
  }
  
  /**
   * Get specific provider by name
   */
  static async getProvider(name: string): Promise<VMProvider> {
    switch (name.toLowerCase()) {
      case 'vfkit':
        if (!await this.hasVfkit()) {
          throw new Error('vfkit not found. Install: brew install vfkit');
        }
        return new VfkitProvider();
        
      case 'lima':
        if (!await this.hasLima()) {
          throw new Error('Lima not found. Install: brew install lima');
        }
        return new LimaProvider();
        
      case 'qemu':
        if (!await this.hasQEMU()) {
          throw new Error('QEMU not found');
        }
        return new QEMUProvider({ kvm: await this.hasKVM() });
        
      case 'wsl2':
        if (!await this.hasWSL2()) {
          throw new Error('WSL2 not found. Install: wsl --install');
        }
        return new WSL2Provider();
        
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }
  
  /**
   * Get system information
   */
  static async getSystemInfo(): Promise<SystemInfo> {
    const platform = os.platform();
    const arch = os.arch();
    
    // Detect Apple Silicon
    const isAppleSilicon = platform === 'darwin' && arch === 'arm64';
    
    // Detect available providers
    const availableProviders: string[] = [];
    if (await this.hasVfkit()) availableProviders.push('vfkit');
    if (await this.hasLima()) availableProviders.push('lima');
    if (await this.hasQEMU()) availableProviders.push('qemu');
    if (await this.hasWSL2()) availableProviders.push('wsl2');
    
    // Determine recommended provider
    let recommendedProvider = '';
    if (platform === 'darwin' && isAppleSilicon && availableProviders.includes('vfkit')) {
      recommendedProvider = 'vfkit';
    } else if (availableProviders.includes('lima')) {
      recommendedProvider = 'lima';
    } else if (platform === 'linux' && await this.hasKVM()) {
      recommendedProvider = 'qemu';
    } else if (platform === 'win32' && availableProviders.includes('wsl2')) {
      recommendedProvider = 'wsl2';
    } else if (availableProviders.length > 0) {
      recommendedProvider = availableProviders[0];
    }
    
    return {
      os: platform as any,
      arch: arch === 'arm64' ? 'arm64' : 'x86_64',
      isAppleSilicon,
      availableProviders,
      recommendedProvider
    };
  }
  
  /**
   * Check if command exists
   */
  private static async commandExists(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check if vfkit is installed
   */
  private static async hasVfkit(): Promise<boolean> {
    return await this.commandExists('vfkit');
  }
  
  /**
   * Check if Lima is installed
   */
  private static async hasLima(): Promise<boolean> {
    return await this.commandExists('limactl');
  }
  
  /**
   * Check if QEMU is installed
   */
  private static async hasQEMU(): Promise<boolean> {
    return await this.commandExists('qemu-system-aarch64') ||
           await this.commandExists('qemu-system-x86_64');
  }
  
  /**
   * Check if KVM is available
   */
  private static async hasKVM(): Promise<boolean> {
    try {
      await fs.access('/dev/kvm');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check if WSL2 is available
   */
  private static async hasWSL2(): Promise<boolean> {
    if (os.platform() !== 'win32') return false;
    
    try {
      const { stdout } = await execAsync('wsl --status');
      return stdout.includes('WSL 2');
    } catch {
      return false;
    }
  }
  
  /**
   * Check if bhyve is available (FreeBSD)
   */
  private static async hasBhyve(): Promise<boolean> {
    return await this.commandExists('bhyve');
  }
}
